import {
  MAP,
  NODE_IDS,
  RULES,
  playable,
  distance,
  distances,
  fuseTurns,
  infectionCount,
  infectionThreshold,
  isInfection,
  ownedCards,
  relayHold,
  shuttleRequirement,
  threatDef,
  turnLimit,
} from '../engine';
import type { GameState, NodeId, Objective } from '../engine/types';

export const ENDING_VALUE: Record<string, number> = {
  escaped: 260,
  specimen: 260,
  overload: 250,
  relay: 250,
  carrier: 150,
  adrift: 30,
  killed: 0,
};

export function terminalValue(state: GameState): number {
  const r = state.result;
  if (!r) return 0;
  const base = (ENDING_VALUE[r.ending] ?? 0) + r.score * 0.15;
  return r.declared ? base * 1.15 : base;
}

/**
 * What is about to hit you. The forecast the interface shows is exact; this is
 * the cheap version of the same reading, so the bot is graded on information a
 * player actually has rather than on hindsight.
 */
function incoming(state: GameState): number {
  if (state.player.node === 'vents') {
    return state.threats.some((t) => t.node === 'vents') ? 8 : 0;
  }
  const here = state.player.node;
  let risk = 0;
  for (const t of state.threats) {
    if (t.node === 'vents') continue;
    const def = threatDef(t.type);
    const d = distance(state, t.node, here);
    if (!Number.isFinite(d)) continue;
    const coming = t.target === here || def.behaviour === 'mother' || t.stance === 'hunting';
    if (d === 0) risk += def.damage * 9;
    else if (d <= def.speed && coming) risk += def.damage * 7;
    else if (d <= def.speed + 1 && coming) risk += def.damage * 2.5;
  }
  return risk;
}

/** Noise near the player is a draw waiting to happen, so it is scored by distance. */
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

function turnsLeft(state: GameState): number {
  return turnLimit(state.depth) - state.turn;
}

// ---------------------------------------------------------------------------
// The four routes, and choosing between them. A bot that only knew how to run
// for the shuttle would measure one quarter of the game.
// ---------------------------------------------------------------------------

export function runFeasible(state: GameState): boolean {
  const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
  if (need <= 0) return true;
  const left = turnsLeft(state);
  if (left < 1) return false;
  const output =
    state.ship.reactorOutput < RULES.reactorOutputMax ? RULES.reactorOutputMax : state.ship.reactorOutput;
  const repair = state.ship.reactorOutput < RULES.reactorOutputMax ? 2 : 0;
  return state.ship.power + Math.max(0, left - repair) * output >= need - 2;
}

export function burnFeasible(state: GameState): boolean {
  if (state.ship.scuttleArmed) return true;
  const cost = RULES.systemActions.armScuttle?.power ?? 8;
  const left = turnsLeft(state);
  if (left < fuseTurns(state.depth) + 1) return false;
  const output = Math.max(1, state.ship.reactorOutput);
  return state.ship.power + left * output >= cost;
}

export function callFeasible(state: GameState): boolean {
  const need = relayHold(state.depth) - state.ship.relayHeld;
  if (state.ship.beaconSent) return turnsLeft(state) >= need;
  const cost = RULES.systemActions.beacon?.power ?? 3;
  return turnsLeft(state) >= relayHold(state.depth) + 1 && state.ship.power + turnsLeft(state) >= cost;
}

export function knowFeasible(state: GameState): boolean {
  if (state.player.carryingSpecimen) return turnsLeft(state) >= 1;
  if (state.ship.specimenTaken) return false;
  return turnsLeft(state) >= 3;
}

export function feasible(state: GameState, o: Objective): boolean {
  switch (o) {
    case 'run':
      return runFeasible(state);
    case 'burn':
      return burnFeasible(state);
    case 'call':
      return callFeasible(state);
    case 'know':
      return knowFeasible(state);
  }
}

/** The nearest compartment that still has something in it, within reach. */
export function nearestSalvage(state: GameState, within: number): NodeId | null {
  if (state.player.node === 'vents') return null;
  let best: NodeId | null = null;
  let bestD = Infinity;
  for (const id of NODE_IDS) {
    if ((state.ship.salvage[id]?.length ?? 0) === 0) continue;
    const d = distance(state, state.player.node, id, false);
    if (d <= within && d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

function hopsTo(state: GameState, to: NodeId): number {
  if (state.player.node === 'vents') return 2;
  const d = distance(state, state.player.node, to, false);
  return Number.isFinite(d) ? d : 6;
}

/** How attractive each route looks from where the run currently stands. */
export function routeValue(state: GameState, o: Objective): number {
  if (!feasible(state, o)) return -1000;
  // A player who said they came up here to do a thing does that thing until it
  // is plainly gone. A bot that re-picks its favourite route every hour
  // measures one route four times and calls it four.
  const declared = state.objective === o ? 120 : 0;
  switch (o) {
    case 'run': {
      const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
      const infection = infectionCount(state);
      const carrier = infection >= infectionThreshold(state.depth) ? -70 : 0;
      return declared + carrier + 90 - need * 2 - hopsTo(state, MAP.escape) * 2;
    }
    case 'burn': {
      if (state.ship.scuttleArmed) return declared + 200;
      const cost = RULES.systemActions.armScuttle?.power ?? 8;
      return declared + 70 - Math.max(0, cost - state.ship.power) * 3 - hopsTo(state, 'bridge') * 2;
    }
    case 'call': {
      if (state.ship.beaconSent) return declared + 120 + state.ship.relayHeld * 12;
      return declared + 70 - hopsTo(state, 'comms') * 2 - Math.max(0, 3 - state.ship.power) * 3;
    }
    case 'know': {
      if (state.player.carryingSpecimen) return declared + 170 - hopsTo(state, 'comms') * 4;
      return declared + 70 - hopsTo(state, MAP.nest) * 3;
    }
  }
}

/** Which of the four this run is actually chasing right now. */
export function currentRoute(state: GameState): Objective {
  let best: Objective = state.objective;
  let bestValue = -Infinity;
  for (const o of ['run', 'burn', 'call', 'know'] as Objective[]) {
    const v = routeValue(state, o);
    if (v > bestValue) {
      bestValue = v;
      best = o;
    }
  }
  return best;
}

/**
 * Where the run should be standing right now. The ship funds every route, so
 * a run with slack in it goes looking rather than standing on its objective
 * waiting for the reactor to hand it something.
 */
export function objectiveNode(state: GameState): NodeId {
  const route = currentRoute(state);
  const infection = infectionCount(state);
  const left = turnsLeft(state);
  const slack = spareHours(state, route);
  if (slack >= 2) {
    const loot = nearestSalvage(state, Math.min(3, slack));
    if (loot !== null) return loot;
  }
  switch (route) {
    case 'run': {
      const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
      if (need <= 0) return MAP.escape;
      // Over the line and still time to do something about it.
      if (infection >= infectionThreshold(state.depth) && left > 4 && hopsTo(state, 'medbay') <= 3) {
        return 'medbay';
      }
      if (state.ship.reactorOutput < RULES.reactorOutputMax && left > 6) return 'reactor';
      return MAP.escape;
    }
    case 'burn': {
      if (!state.ship.scuttleArmed) {
        if (state.ship.reactorOutput < RULES.reactorOutputMax && left > 8) return 'reactor';
        return 'bridge';
      }
      // Armed. Now live through it, as far from the hold as the ship allows.
      return MAP.start;
    }
    case 'call': {
      if (!state.ship.beaconSent) {
        // Get the broadcast away first; the reactor matters for holding it, and
        // holding it is a problem you do not have yet.
        const cost = RULES.systemActions.beacon?.power ?? 2;
        if (state.ship.power < cost && state.ship.reactorOutput < RULES.reactorOutputMax && left > 8) {
          return 'reactor';
        }
        return 'comms';
      }
      if (state.ship.reactorOutput < RULES.reactorOutputMax && state.ship.power > 3) return 'reactor';
      return 'comms';
    }
    case 'know':
      return state.player.carryingSpecimen ? 'comms' : MAP.nest;
  }
}

/**
 * Hours this route can spare before it has to be walked. Power that has not
 * arrived yet is the usual reason a route is waiting on something.
 */
export function spareHours(state: GameState, route: Objective): number {
  const left = turnsLeft(state);
  switch (route) {
    case 'run': {
      const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
      if (need <= 0) return 0;
      const income = Math.max(1, state.ship.reactorOutput);
      return Math.max(0, Math.min(left - hopsTo(state, MAP.escape) - 1, Math.ceil(need / income) - 1));
    }
    case 'burn': {
      if (state.ship.scuttleArmed) return left;
      const cost = RULES.systemActions.armScuttle?.power ?? 10;
      const short = Math.max(0, cost - state.ship.power);
      return Math.min(
        left - fuseTurns(state.depth) - hopsTo(state, 'bridge') - 1,
        short === 0 ? 0 : Math.ceil(short / Math.max(1, state.ship.reactorOutput)),
      );
    }
    case 'call':
      if (state.ship.beaconSent) return 0;
      return Math.max(0, left - relayHold(state.depth) - hopsTo(state, 'comms') - 1);
    case 'know':
      if (state.player.carryingSpecimen) return 0;
      return Math.max(0, left - hopsTo(state, MAP.nest) - 3);
  }
}

/** Immediate, myopic value. GreedyBot uses this and nothing else. */
export function evaluateImmediate(state: GameState): number {
  if (state.status !== 'active') return terminalValue(state);
  const owned = ownedCards(state);
  const infection = owned.filter(isInfection).length;
  const capability = owned.length - infection;
  // A card in hand you could play now is worth more than the same card three
  // shuffles down the deck. Without this the evaluator cannot see the value of
  // drawing at all, so it never plays a draw card and never sheds a dead one.
  const live = state.player.hand.filter((u) => playable(state, u)).length;
  const dead = state.player.hand.length - live;
  const pressure = incoming(state);
  const wards = Math.min(state.player.wardsThisTurn, 2) * Math.min(pressure, 14) * 0.5;
  const spent = state.player.spent.length * 2.5;
  const left = turnsLeft(state);
  const threshold = infectionThreshold(state.depth);
  return (
    state.ship.shuttleCharge * 3 +
    state.ship.power * 1.6 +
    state.ship.reactorOutput * Math.min(left, 8) * 1.0 +
    // Time is deliberately worth nothing here. An hour's unspent time is gone
    // when the hour turns over, so a bot that prices it hoards it, ends the
    // turn early, and measures a game nobody is playing. Measured: the old
    // evaluator left 2.4 of 4 time unspent every hour.
    capability * 1.4 +
    live * 1.0 -
    dead * 0.8 +
    // Cards are for playing. Valuing only the hand made holding a card strictly
    // better than using it, which is the old game's 88% waste with extra steps.
    state.stats.cardsPlayed * 1.6 -
    // Infection is visible and it compounds: it clogs the hand and it decides
    // the CARRIER line. The last point before the threshold is the expensive one.
    infection * 2.2 -
    Math.max(0, infection - (threshold - 2)) * 6 +
    state.ship.searched.length * 3.0 +
    state.stats.cures * 3 +
    state.stats.threatsShaken * 2 +
    // Knowing where things are is worth an action. Note what this counts:
    // contacts currently in view, not listens performed. Scoring the tally
    // instead made LISTEN a free point every time and the bot stood in one
    // compartment listening four times an hour for seven hours.
    state.threats.filter((t) => t.seenTurn === state.turn).length * 1.4 +
    wards -
    spent -
    noisePressure(state) -
    pressure -
    // The hold filling up is the clock nobody can turn back.
    state.ship.hive * 1.2 -
    (state.ship.motherWoken ? 14 : 0)
  );
}

export function evaluateGreedy(state: GameState): number {
  if (state.status !== 'active') return terminalValue(state);
  const d = state.player.node === 'vents' ? 3 : distance(state, state.player.node, MAP.escape, false);
  return evaluateImmediate(state) - (Number.isFinite(d) ? d * 0.6 : 3);
}

/** Strategic value: the immediate picture plus where the run is going. */
export function evaluateStrategic(state: GameState): number {
  if (state.status !== 'active') return terminalValue(state);
  let v = evaluateImmediate(state);
  const route = currentRoute(state);
  const goal = objectiveNode(state);
  const d = state.player.node === 'vents' ? 2 : distance(state, state.player.node, goal, false);
  v -= Number.isFinite(d) ? d * 2.2 : 8;
  v += routeValue(state, route) * 0.5;

  const left = turnsLeft(state);
  if (route === 'run') {
    const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
    v += Math.min(state.ship.power, Math.max(need, 0)) * 1.2;
    if (left <= 3) v -= state.ship.power * 1.5;
  }
  if (route === 'burn' && state.ship.scuttleArmed) {
    const done = state.turn - state.ship.scuttleArmedTurn;
    v += done * 14;
  }
  if (route === 'call') {
    v += state.ship.relayHeld * 16;
    // The transmitter eats power every hour and dies if the pool runs dry.
    if (state.ship.beaconSent) v += Math.min(state.ship.power, 4) * 3;
    if (state.ship.beaconSent && state.player.node === 'comms') v += 6;
  }
  if (route === 'know' && state.player.carryingSpecimen) v += 40;
  return v;
}

/** Kept for the report: which route the run committed to. */
export function objective(state: GameState): NodeId {
  return objectiveNode(state);
}
