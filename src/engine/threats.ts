import { NODE_IDS, RULES, THREAT_ORDER, VENT_NODES, threatDef } from './content';
import { addInfection, cardOf, isInfection, capabilityCount } from './deck';
import { NEST, addNoise, alert, whereabouts } from './noise';
import { killLine, lostYou, shrugLine, stalledLine, wardLine, woundLine } from './voice';
import { distance, loudestNode, stepToward } from './graph';
import { nextInt } from './rng';
import { resolveRun } from './scoring';
import { cloneState, noiseFloor } from './state';
import type { Forecast, ForecastEntry, GameState, Location, NodeId, Threat, Uid } from './types';

/**
 * A wound with nothing to choose from takes a capability at random. Infection
 * is never eligible: it is the weight a wound leaves behind, not a thing a
 * wound can take away.
 */
export function burnRandomOwned(state: GameState): Uid | undefined {
  const piles: ('deck' | 'discard' | 'hand')[] = ['deck', 'discard', 'hand'];
  for (const pile of piles) {
    const list = state.player[pile];
    const indices = list.map((_, i) => i).filter((i) => !isInfection(list[i] as Uid));
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
 * One wound: give up a capability for the rest of the run, and take an
 * infection card into the deck. The choice of what to give up is the player's
 * whenever there is one to make. Infection is not a capability and cannot be
 * offered up, so a hand of nothing but infection has no choice in it and the
 * ship takes something out of the kit instead.
 */
export function wound(state: GameState, count: number, source: string): void {
  if (count > 0 && state.player.wardsThisTurn === 0 && capabilityCount(state) > 0) {
    state.feed.push({ turn: state.turn, kind: 'alarm', text: woundLine(state, source, count > 1) });
  }
  for (let i = 0; i < count; i++) {
    if (state.status !== 'active') return;
    if (state.player.wardsThisTurn > 0) {
      state.player.wardsThisTurn -= 1;
      state.feed.push({ turn: state.turn, kind: 'player', text: wardLine(state) });
      continue;
    }
    if (capabilityCount(state) === 0) {
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: `>> ${source} reaches you, and there is nothing left to give up.`,
      });
      resolveRun(state, 'attrition');
      return;
    }
    state.stats.wounds += 1;
    const got = addInfection(state);
    state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text:
        `>> It is in the wound. ${cardOf(got).name} goes into your kit and will keep coming back ` +
        'to hand until the medbay cuts it out.',
    });
    if (state.player.hand.some((u) => !isInfection(u))) {
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

export function threatsHere(state: GameState): Threat[] {
  return state.threats.filter((t) => t.node === state.player.node);
}

function nearestVentTo(state: GameState, target: NodeId): NodeId {
  let best = VENT_NODES[0] as NodeId;
  let bestD = Infinity;
  for (const v of VENT_NODES) {
    const d = distance(state, v, target, false);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/** Where it is drifting when it has lost you entirely: toward any noise at all. */
function wanderGoal(state: GameState): NodeId | null {
  const loud = loudestNode(state);
  return (state.ship.noise[loud] ?? 0) > noiseFloor(state.depth, loud) ? loud : null;
}

/**
 * What this threat believes and therefore where it is going. Nothing here
 * reads the player's true position except the HUNTER inside its lock range and
 * the MOTHER, which is the whole point of both of them.
 */
function reacquire(state: GameState, t: Threat): void {
  const def = threatDef(t.type);
  const player = state.player.node;
  if (def.behaviour === 'mother') {
    if (player !== 'vents') {
      t.target = player;
      t.stance = 'hunting';
      t.cold = 0;
    } else if (t.target === null) {
      t.target = NEST;
    }
    return;
  }
  if (def.behaviour === 'hunter' && player !== 'vents') {
    const d = distance(state, whereabouts(state, t), player, false);
    if (d <= (def.lockRange ?? 2)) {
      t.target = player;
      t.stance = 'hunting';
      t.cold = 0;
    }
  }
}

/** One activation's worth of walking. */
function moveThreat(state: GameState, t: Threat): void {
  const def = threatDef(t.type);
  const player = state.player.node;
  const burrow = def.behaviour === 'burrow';

  if (t.node === 'vents') {
    // Out of the ducts, at the hatch closest to whatever it is going to.
    if (burrow && player === 'vents') return; // it is in there with you
    const aim = t.target ?? wanderGoal(state) ?? NEST;
    t.node = nearestVentTo(state, aim);
    return;
  }

  if (burrow && player === 'vents') {
    t.node = 'vents';
    return;
  }

  const goal = t.target ?? wanderGoal(state);
  if (goal === null) return;

  for (let i = 0; i < def.speed; i++) {
    if (t.node === goal) break;
    const next = stepToward(state, t.node as NodeId, goal, !burrow);
    if (next === t.node) {
      // A dropped bulkhead. The MOTHER takes the door apart; everything else
      // has to go the long way, and the long way takes an hour.
      if (def.behaviour === 'mother') {
        const through = stepToward(state, t.node as NodeId, goal, false);
        if (through !== t.node) {
          t.node = through;
          t.stalled = RULES.motherSealStall;
          state.feed.push({
            turn: state.turn,
            kind: 'alarm',
            text: '>> Something is taking a bulkhead apart. It is not quick about it. It does not need to be.',
          });
        }
      }
      break;
    }
    t.node = next;
  }

  // A CRAWLER that has further to go drops back into the ducts, where the
  // bridge can flood it.
  if (
    burrow &&
    t.node !== goal &&
    VENT_NODES.includes(t.node as NodeId) &&
    t.node !== player
  ) {
    t.node = 'vents';
  }
}

function activate(state: GameState, t: Threat): void {
  if (state.status !== 'active') return;
  if (!state.threats.includes(t)) return;
  const def = threatDef(t.type);

  if (t.stalled > 0) {
    t.stalled -= 1;
    state.feed.push({ turn: state.turn, kind: 'threat', text: stalledLine(state, t) });
    return;
  }

  reacquire(state, t);
  moveThreat(state, t);

  if (def.behaviour === 'burrow' && t.node === 'reactor') {
    if (state.ship.reactorOutput > 0) {
      state.ship.reactorOutput -= 1;
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: `>> A CRAWLER is in the reactor. Output drops to ${state.ship.reactorOutput} an hour.`,
      });
    }
    return;
  }

  if (t.node === state.player.node) {
    // A CRAWLER can meet you in the ducts, which is nowhere on the map: there
    // is no compartment for it to remember, only you.
    if (state.player.node !== 'vents') t.target = state.player.node;
    t.stance = 'hunting';
    t.cold = 0;
    wound(state, def.damage, def.name);
    return;
  }

  // It got where it was going and you were not there. This is the whole of
  // hiding: it casts about for an hour, and then it gives up on you.
  if (t.target !== null && t.node === t.target) {
    t.cold += 1;
    if (t.stance === 'hunting') {
      t.stance = 'searching';
      state.feed.push({ turn: state.turn, kind: 'threat', text: shrugLine(state, t) });
    } else if (t.cold > RULES.searchStance.hoursSearching) {
      t.target = null;
      t.stance = 'wandering';
      state.stats.threatsShaken += 1;
      state.feed.push({ turn: state.turn, kind: 'threat', text: lostYou(state, t) });
    }
  }
}

/** Threat phase: crawlers, hunters, strays, the MOTHER last, ids ascending. */
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

/** Kill a threat and return its token to the bag. The MOTHER does not die. */
export function killThreat(state: GameState, id: string): boolean {
  const i = state.threats.findIndex((t) => t.id === id);
  if (i < 0) return false;
  const t = state.threats[i] as Threat;
  if (threatDef(t.type).unkillable === true) {
    state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text: '>> You put everything you have into it and it does not care. Nothing aboard kills a MOTHER. Cost it time instead.',
    });
    return false;
  }
  state.threats.splice(i, 1);
  state.bag[t.type as 'contact' | 'drifter' | 'burrower'] =
    (state.bag[t.type as 'contact' | 'drifter' | 'burrower'] ?? 0) + 1;
  state.stats.threatsKilled += 1;
  state.feed.push({ turn: state.turn, kind: 'player', text: killLine(state, t.type) });
  return true;
}

/** Hold everything in a compartment where it stands. */
export function stallAt(state: GameState, where: Location, hours: number): number {
  let n = 0;
  for (const t of state.threats) {
    if (t.node !== where) continue;
    t.stalled = Math.max(t.stalled, hours);
    n += 1;
  }
  return n;
}

// ---------------------------------------------------------------------------
// Perception and forecast. §3.5: the player sees what a person in a corridor
// would see, and knows what the things it can see are about to do.
// ---------------------------------------------------------------------------

/**
 * Every threat the player can currently make out: in this compartment, one
 * bulkhead away, or turned up by a listen this hour. In the ducts you perceive
 * only what is in the ducts with you.
 */
export function perceivedIds(state: GameState): Set<string> {
  const out = new Set<string>();
  const here = state.player.node;
  for (const t of state.threats) {
    if (t.seenTurn === state.turn) {
      out.add(t.id);
      continue;
    }
    if (here === 'vents') {
      if (t.node === 'vents') out.add(t.id);
      continue;
    }
    if (t.node === 'vents') continue;
    if (distance(state, here, t.node, false) <= RULES.perceiveRange) out.add(t.id);
  }
  return out;
}

/** Mark what the player can make out right now, so the schematic can hold it. */
export function noteSightings(state: GameState): void {
  for (const id of perceivedIds(state)) {
    const t = state.threats.find((x) => x.id === id);
    if (t === undefined) continue;
    t.seenNode = t.node;
    t.seenTurn = state.turn;
  }
}

/** A listen turns up everything within range, wherever it is. */
export function revealWithin(state: GameState, range: number): Threat[] {
  const here = state.player.node;
  const from: NodeId = here === 'vents' ? NEST : here;
  const found: Threat[] = [];
  for (const t of state.threats) {
    const at = whereabouts(state, t);
    if (distance(state, from, at, false) <= range) {
      t.seenNode = t.node;
      t.seenTurn = state.turn;
      found.push(t);
    }
  }
  return found;
}

/**
 * What happens if the hour ends exactly as it stands. Runs the real threat
 * phase against a copy and reports the difference, so a hit is never something
 * the player could not have seen coming — §3.3.
 */
export function forecast(state: GameState): Forecast {
  const perceived = perceivedIds(state);
  const before = state.threats.map((t) => ({ id: t.id, type: t.type, node: t.node }));
  const draft = cloneState(state);
  // Movement only. The noise phase is deliberately not simulated: what comes
  // out of the bag is not something the player is entitled to know in advance.
  threatPhase(draft);
  const moves: ForecastEntry[] = [];
  for (const was of before) {
    const now = draft.threats.find((t) => t.id === was.id);
    if (now === undefined) continue;
    moves.push({
      id: was.id,
      type: was.type,
      from: was.node,
      to: now.node,
      reaches: now.node === state.player.node,
      perceived: perceived.has(was.id),
    });
  }
  const willDraw = NODE_IDS.filter((id) => (state.ship.noise[id] ?? 0) >= RULES.noiseThreshold);
  return {
    moves,
    willDraw,
    danger: moves.some((m) => m.reaches && m.perceived),
  };
}

export { addNoise, alert };
