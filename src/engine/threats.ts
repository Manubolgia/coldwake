import { NODE_IDS, NODE_INDEX, THREAT_ORDER, THREATS, VENT_NODES, threatDef } from './content';
import { addPanic, cardOf, isPanic, nonPanicCount } from './deck';
import { addNoise, NEST } from './noise';
import { killLine, sampleLine, wardLine, woundLine } from './voice';
import { distance, loudestNode, stepToward } from './graph';
import { nextInt } from './rng';
import { resolveRun } from './scoring';
import type { GameState, NodeId, Threat, Uid } from './types';

export function drawCarry(state: GameState, n = 1): void {
  for (let i = 0; i < n; i++) {
    const c = state.carryDeck.shift();
    if (c === undefined) return;
    state.player.carry.push({ id: c, revealed: false });
    state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text: sampleLine(state, state.player.carry.length, state.player.carry.filter((x) => !x.revealed).length),
    });
  }
}

export function infestedCount(state: GameState): number {
  return state.player.carry.filter((c) => c.id === 'infested').length;
}

/**
 * A wound with nothing to choose from takes a capability at random. Panic is
 * never eligible: it is the weight a wound leaves behind, not a thing a wound
 * can take away, and letting it pay made wounds cost nothing at all (§4.8).
 */
export function burnRandomOwned(state: GameState): Uid | undefined {
  const piles: ('deck' | 'discard' | 'hand')[] = ['deck', 'discard', 'hand'];
  for (const pile of piles) {
    const list = state.player[pile];
    const indices = list.map((_, i) => i).filter((i) => !isPanic(list[i] as Uid));
    if (indices.length === 0) continue;
    const [pick, rng] = nextInt(state.rng, indices.length);
    state.rng = rng;
    const [uid] = list.splice(indices[pick] as number, 1);
    if (uid !== undefined) state.player.burned.push(uid);
    return uid;
  }
  return undefined;
}

/**
 * §4.8. One wound: give up a capability, gain a panic, draw a face-down blood
 * sample. The choice is the player's whenever there is one to make, so it is
 * queued and owed before anything else happens — but panic is not a capability
 * and cannot be offered up, so a hand of nothing but panic has no choice in it
 * and the ship takes something from the kit instead.
 */
export function wound(state: GameState, count: number, source: string, drawsCarry = true): void {
  if (count > 0 && state.player.wardsThisTurn === 0 && nonPanicCount(state) > 0) {
    state.feed.push({ turn: state.turn, kind: 'alarm', text: woundLine(state, source, count > 1) });
  }
  for (let i = 0; i < count; i++) {
    if (state.status !== 'active') return;
    if (state.player.wardsThisTurn > 0) {
      state.player.wardsThisTurn -= 1;
      state.feed.push({ turn: state.turn, kind: 'player', text: wardLine(state) });
      continue;
    }
    if (nonPanicCount(state) === 0) {
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: `>> ${source} reaches you, and there is nothing left to give up.`,
      });
      resolveRun(state, 'death');
      return;
    }
    state.stats.wounds += 1;
    addPanic(state);
    if (drawsCarry) drawCarry(state, 1);
    if (state.player.hand.some((u) => !isPanic(u))) {
      state.player.pendingWounds += 1;
      state.phase = 'wound';
    } else {
      const taken = burnRandomOwned(state);
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text:
          taken === undefined
            ? '>> Something goes.'
            : `>> Nothing in your hands was any use. ${cardOf(taken).name} — you cannot do that any more.`,
      });
    }
  }
}

function threatsAtPlayer(state: GameState): Threat[] {
  return state.threats.filter((t) => t.node === state.player.node);
}

export function threatsHere(state: GameState): Threat[] {
  return threatsAtPlayer(state);
}

function nearestVentTo(state: GameState, target: NodeId): NodeId {
  let best = VENT_NODES[0] as NodeId;
  let bestD = Infinity;
  for (const v of VENT_NODES) {
    const d = distance(state, v, target, false);
    if (d < bestD || (d === bestD && NODE_INDEX[v]! < NODE_INDEX[best]!)) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

function targetNode(state: GameState, threat: Threat): NodeId {
  const def = threatDef(threat.type);
  const player = state.player.node;
  switch (def.behaviour) {
    case 'loudest': {
      // Converge on noise; with nothing left to hear, hunt.
      const loud = loudestNode(state);
      if (loud !== threat.node) return loud;
      return player === 'vents' ? loud : player;
    }
    case 'hunter': {
      if (player === 'vents') return loudestNode(state);
      if (threat.node === 'vents') return player;
      const d = distance(state, threat.node, player);
      return d <= (def.hunterRange ?? 2) ? player : loudestNode(state);
    }
    case 'burrow':
      return player === 'vents' ? (nearestVentTo(state, NEST) as NodeId) : player;
    case 'nest':
      return NEST;
  }
}

function moveThreat(state: GameState, threat: Threat): void {
  const def = threatDef(threat.type);
  const ignoreSeals = def.behaviour === 'burrow';
  const player = state.player.node;

  if (def.behaviour === 'burrow') {
    // The burrower is the only thing that treats the vents as a road.
    if (player === 'vents') {
      threat.node = 'vents';
      return;
    }
    if (threat.node === 'vents') {
      threat.node = nearestVentTo(state, player);
    } else if (
      distance(state, threat.node, player, false) > def.speed &&
      VENT_NODES.includes(threat.node)
    ) {
      threat.node = 'vents';
      return;
    }
  } else if (threat.node === 'vents') {
    threat.node = nearestVentTo(state, player === 'vents' ? NEST : player);
    return;
  }

  if (threat.node === 'vents') return;
  const goal = targetNode(state, threat);
  let steps = def.speed;
  if (def.behaviour === 'burrow' && threat.node !== goal) steps = def.speed;
  for (let i = 0; i < steps; i++) {
    if (threat.node === goal) break;
    const nextNode = stepToward(state, threat.node as NodeId, goal, !ignoreSeals);
    if (nextNode === threat.node) break;
    threat.node = nextNode;
  }
}

function activate(state: GameState, threat: Threat): void {
  if (state.status !== 'active') return;
  if (!state.threats.includes(threat)) return;
  const def = threatDef(threat.type);

  if (def.behaviour === 'nest') {
    for (const id of NODE_IDS) addNoise(state, id, THREATS.chorusNoisePerTurn);
    state.feed.push({ turn: state.turn, kind: 'threat', text: '>> The hull is singing. Every compartment hears it.' });
  }

  moveThreat(state, threat);

  if (def.behaviour === 'nest' && threat.node === NEST && threat.fed !== true) {
    const moved = Math.min(THREATS.chorusArrivalContacts, state.reserve.contact ?? 0);
    state.reserve.contact -= moved;
    state.bag.contact = (state.bag.contact ?? 0) + moved;
    threat.fed = true;
    state.feed.push({ turn: state.turn, kind: 'alarm', text: '>> The hold answers it. There are more of them now.' });
  }

  if (def.behaviour === 'burrow' && threat.node === 'reactor') {
    if (state.ship.reactorOutput > 0) {
      state.ship.reactorOutput -= 1;
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: `>> Something is in the reactor. Output drops to ${state.ship.reactorOutput} an hour.`,
      });
    }
    return;
  }

  if (threat.node === state.player.node) {
    wound(state, def.damage, def.name);
  }
}

/** §4.8 threat phase: burrowers, drifters, contacts, chorus, ids ascending. */
export function threatPhase(state: GameState, repeats = 1): void {
  for (let r = 0; r < repeats; r++) {
    for (const type of THREAT_ORDER) {
      const ordered = state.threats
        .filter((t) => t.type === type)
        .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
      for (const t of ordered) {
        if (state.status !== 'active') return;
        activate(state, t);
      }
    }
  }
}

/** Kill a threat and return its token to the bag. */
export function killThreat(state: GameState, id: string): boolean {
  const i = state.threats.findIndex((t) => t.id === id);
  if (i < 0) return false;
  const t = state.threats[i] as Threat;
  state.threats.splice(i, 1);
  state.bag[t.type] = (state.bag[t.type] ?? 0) + 1;
  state.stats.threatsKilled += 1;
  state.feed.push({ turn: state.turn, kind: 'player', text: killLine(state, t.type) });
  return true;
}
