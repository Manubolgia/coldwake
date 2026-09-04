import {
  MAP,
  NODE_IDS,
  RULES,
  distance,
  distances,
  isPanic,
  ownedCards,
  shuttleRequirement,
  turnLimit,
} from '../engine';
import type { GameState, NodeId } from '../engine/types';

export const ENDING_VALUE: Record<string, number> = {
  clean_break: 260,
  scuttle: 150,
  carrier: 110,
  beacon: 60,
  lost: 0,
};

export function terminalValue(state: GameState): number {
  const r = state.result;
  if (!r) return 0;
  return (ENDING_VALUE[r.ending] ?? 0) + r.score * 0.15;
}

function threatPressure(state: GameState): number {
  let here = 0;
  let near = 0;
  for (const t of state.threats) {
    if (t.node === state.player.node) here += 1;
    else if (
      t.node !== 'vents' &&
      state.player.node !== 'vents' &&
      distance(state, t.node, state.player.node) <= 1
    ) {
      near += 1;
    }
  }
  return here * 9 + near * 3;
}

/**
 * Noise anywhere near the player is a threat waiting to spawn, so it is scored
 * by distance. Without this, moving looks free: the noise a move makes lands on
 * the node you just left.
 */
const NOISE_WEIGHT = [0.9, 0.5, 0.22, 0.1, 0.05];

function noisePressure(state: GameState): number {
  if (state.player.node === 'vents') return 0;
  const dist = distances(state, state.player.node, false);
  let total = 0;
  for (const id of NODE_IDS) {
    const d = dist.get(id);
    if (d === undefined) continue;
    total += (state.ship.noise[id] ?? 0) * (NOISE_WEIGHT[Math.min(d, NOISE_WEIGHT.length - 1)] ?? 0);
  }
  return total;
}

/** Immediate, myopic value. GreedyBot uses this and nothing else. */
export function evaluateImmediate(state: GameState): number {
  if (state.status !== 'active') return terminalValue(state);
  const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
  const owned = ownedCards(state);
  const panics = owned.filter((u) => isPanic(u)).length;
  const turnsLeft = turnLimit(state.depth) - state.turn;
  return (
    state.ship.shuttleCharge * 4 +
    Math.min(state.ship.power, Math.max(need, 0)) * 2.5 +
    // Output is worth every point of power it will still produce.
    state.ship.reactorOutput * Math.min(turnsLeft, 8) * 1.1 +
    state.player.ap * 0.6 +
    (owned.length - panics) * 1.2 -
    panics * 1.5 +
    state.ship.searched.length * 1.5 -
    noisePressure(state) -
    threatPressure(state) -
    state.player.carry.filter((c) => c.revealed && c.id === 'infested').length * 9 -
    // An unread sample is worth roughly a third of a known infection, so
    // reading one that comes back clean is a real gain.
    state.player.carry.filter((c) => !c.revealed).length * 8 +
    (state.ship.scuttleArmed ? 8 : 0) +
    (state.ship.beaconSent ? 4 : 0)
  );
}

/**
 * GreedyBot's evaluator: the immediate picture plus a weak pull toward the
 * door. It knows where the exit is; it has no idea when to use it.
 */
export function evaluateGreedy(state: GameState): number {
  if (state.status !== 'active') return terminalValue(state);
  const d =
    state.player.node === 'vents' ? 3 : distance(state, state.player.node, MAP.escape, false);
  return evaluateImmediate(state) - (Number.isFinite(d) ? d * 0.6 : 3);
}

/**
 * Can the run still reach the shuttle before the orbit does? A degraded reactor
 * is assumed repairable, because it is: that is what the reactor room is for.
 */
export function launchFeasible(state: GameState): boolean {
  const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
  if (need <= 0) return true;
  const turnsLeft = turnLimit(state.depth) - state.turn;
  if (turnsLeft < 1) return false;
  const output =
    state.ship.reactorOutput < RULES.reactorOutputMax ? RULES.reactorOutputMax : state.ship.reactorOutput;
  const repairTurns = state.ship.reactorOutput < RULES.reactorOutputMax ? 2 : 0;
  const projected = state.ship.power + Math.max(0, turnsLeft - repairTurns) * output;
  // A margin, so the plan does not flip back and forth as power rises and falls.
  return projected >= need - 2;
}

/** Where the run should be heading right now. */
export function objective(state: GameState): NodeId {
  const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
  const knownInfested = state.player.carry.filter((c) => c.revealed && c.id === 'infested').length;
  // Two confirmed infections means the shuttle is no longer an escape. Take
  // the reactor with you instead.
  if (knownInfested >= RULES.carry.carrierThreshold && !state.ship.scuttleArmed) return 'bridge';
  if (need <= 0) return MAP.escape;
  // Two wounds in and still blind: the medbay is worth the detour, because a
  // confirmed infection changes which ending you are playing for.
  const unread = state.player.carry.filter((c) => !c.revealed).length;
  const turnsLeft = turnLimit(state.depth) - state.turn;
  const toMedbay =
    state.player.node === 'vents' ? 9 : distance(state, state.player.node, 'medbay', false);
  if (unread >= 3 && turnsLeft > 7 && toMedbay <= 3 && launchFeasible(state)) return 'medbay';
  if (!launchFeasible(state)) {
    if (!state.ship.scuttleArmed && state.ship.power >= (RULES.systemActions.armScuttle?.power ?? 5)) {
      return 'bridge';
    }
    if (!state.ship.beaconSent) return 'comms';
    return state.ship.scuttleArmed ? MAP.escape : 'bridge';
  }
  if (state.ship.reactorOutput < RULES.reactorOutputMax && turnsLeft > 6) {
    return 'reactor';
  }
  return MAP.escape;
}

/** Strategic value: the immediate picture plus where the run is going. */
export function evaluateStrategic(state: GameState): number {
  if (state.status !== 'active') return terminalValue(state);
  let v = evaluateImmediate(state);
  const goal = objective(state);
  const d =
    state.player.node === 'vents' ? 2 : distance(state, state.player.node, goal, false);
  v -= Number.isFinite(d) ? d * 2 : 8;
  const turnsLeft = turnLimit(state.depth) - state.turn;
  if (!launchFeasible(state)) {
    // The shuttle is gone. What is left is what the run resolves into: an armed
    // reactor is worth far more than power nobody will ever bank.
    v -= 12;
    v -= Math.min(state.ship.power, 10) * 2.5;
    v += state.ship.scuttleArmed ? 55 : 0;
    v += state.ship.beaconSent ? 22 : 0;
  }
  // Late in the run, banked power is the only power that counts.
  if (turnsLeft <= 3) v -= state.ship.power * 1.5;
  return v;
}
