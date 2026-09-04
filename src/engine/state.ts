import {
  DEPTHS,
  MAP,
  NODE_IDS,
  RULES,
  SALVAGE,
  THREATS,
  TOKEN_TYPES,
  depthDef,
  node,
  roleDeck,
  roleDef,
} from './content';
import { cardIdOf, drawOne, makeUid } from './deck';
import { bagDraw } from './noise';
import { seedFrom, shuffle } from './rng';
import type { CardId, Depth, GameState, NodeId, RoleId, TokenType, Uid } from './types';

export const TOTAL_TOKENS = TOKEN_TYPES.reduce(
  (sum, t) => sum + (THREATS.bag[t] ?? 0) + (THREATS.reserve[t] ?? 0),
  0,
);

export function emptyTokens(): Record<TokenType, number> {
  return { blank: 0, contact: 0, drifter: 0, burrower: 0, chorus: 0 };
}

export function shuttleRequirement(role: RoleId, depth: Depth): number {
  const roleOverride = roleDef(role).shuttleRequired;
  const base = depthDef(depth).shuttleRequired;
  // The pilot's discount is a flat delta from the depth-1 baseline, so it still
  // costs more at depth 5.
  if (roleOverride === undefined) return base;
  return base - (RULES.shuttleRequired - roleOverride);
}

export function turnLimit(depth: Depth): number {
  return depthDef(depth).turnLimit;
}

export function oreHoldFloor(depth: Depth): number {
  return depthDef(depth).oreHoldFloor;
}

export function noiseFloor(depth: Depth, id: NodeId): number {
  return id === MAP.nest ? oreHoldFloor(depth) : node(id).noiseFloor;
}

function buildDeck(role: RoleId): CardId[] {
  return roleDeck(role);
}

export function initialState(seed: string, role: RoleId, depth: Depth): GameState {
  const dd = depthDef(depth);
  let rng = seedFrom(`${seed}|${role}|${depth}`);

  // Deck: one uid per physical copy, then shuffled.
  const counts = new Map<CardId, number>();
  const deckIds = buildDeck(role);
  const uids: Uid[] = deckIds.map((id) => {
    const n = (counts.get(id) ?? 0) + 1;
    counts.set(id, n);
    return makeUid(id, n);
  });
  const [deck, rng1] = shuffle(uids, rng);
  rng = rng1;

  // CARRY deck: clean/infested per depth, shuffled, then the face-down draw.
  const carryPool: ('clean' | 'infested')[] = [
    ...Array.from({ length: dd.carry.clean }, () => 'clean' as const),
    ...Array.from({ length: dd.carry.infested }, () => 'infested' as const),
  ];
  const [carryDeck, rng2] = shuffle(carryPool, rng);
  rng = rng2;
  const carry = carryDeck.splice(0, dd.carry.startCards).map((id) => ({ id, revealed: false }));

  // Salvage: the fixed deck shuffled and dealt two per node.
  const [salvageDeck, rng3] = shuffle(
    SALVAGE.deck.map((s, i) => `${s.card}#${i}`),
    rng,
  );
  rng = rng3;
  const salvage: Record<NodeId, string[]> = {};
  let cursor = 0;
  for (const id of NODE_IDS) {
    salvage[id] = salvageDeck.slice(cursor, cursor + SALVAGE.perNode);
    cursor += SALVAGE.perNode;
  }

  // Bag: base contents plus the depth's promotions out of the reserve.
  const bag = { ...THREATS.bag };
  const reserve = { ...THREATS.reserve };
  for (const t of TOKEN_TYPES) {
    // Positive promotes reserve into the bag; negative pulls tokens back out,
    // which is how deeper runs get a bag with fewer blanks in it.
    const delta = dd.bag[t] ?? 0;
    const moved =
      delta >= 0 ? Math.min(delta, reserve[t] ?? 0) : -Math.min(-delta, bag[t] ?? 0);
    bag[t] = (bag[t] ?? 0) + moved;
    reserve[t] = (reserve[t] ?? 0) - moved;
  }

  const noise: Record<NodeId, number> = {};
  for (const id of NODE_IDS) noise[id] = noiseFloor(depth, id);

  const state: GameState = {
    seed,
    rng,
    turn: 1,
    depth,
    role,
    player: {
      node: MAP.start,
      ap: RULES.apPerTurn,
      hand: [],
      deck,
      discard: [],
      burned: [],
      spent: [],
      carry,
      pendingWounds: 0,
      wardsThisTurn: 0,
      combatPenalty: 0,
      panicsGained: 0,
    },
    ship: {
      power: 0,
      shuttleCharge: 0,
      reactorOutput: dd.reactorOutputStart,
      noise,
      sealedEdges: [],
      searched: [],
      salvage,
      scuttleArmed: false,
      scuttleArmedTurn: 0,
      beaconSent: false,
    },
    bag,
    reserve,
    threats: [],
    carryDeck,
    bagKnownTurn: 0,
    nextThreatId: 1,
    phase: 'action',
    resumeEndTurn: false,
    stats: {
      threatsKilled: 0,
      wounds: 0,
      scans: 0,
      bagDraws: 0,
      salvageScore: 0,
      ventTransits: 0,
    },
    log: [],
    feed: [],
    status: 'active',
  };

  drawUpToHandSize(state);
  for (let i = 0; i < dd.startingDraws; i++) bagDraw(state, MAP.nest);
  state.feed.push({
    turn: 1,
    kind: 'sys',
    text:
      `COLD WAKE. YOU HAVE ${turnLimit(depth)} HOURS BEFORE THE ORBIT CLOSES. ` +
      `THE SHUTTLE WILL NOT LIFT ON LESS THAN ${shuttleRequirement(role, depth)} POWER.`,
  });
  return state;
}

/** Draw phase. Blackout adds noise the moment it is drawn (§5.3). */
export function drawUpToHandSize(state: GameState): void {
  while (state.player.hand.length < RULES.handSize) {
    const { uid } = drawOne(state);
    if (uid === undefined) break;
    if (cardIdOf(uid) === 'panic_blackout' && typeof state.player.node === 'string' && state.player.node !== 'vents') {
      state.ship.noise[state.player.node] = Math.min(
        RULES.noiseMax,
        (state.ship.noise[state.player.node] ?? 0) + 1,
      );
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: '>> YOUR VISION GOES. YOU PUT A HAND OUT AND KNOCK SOMETHING OVER.',
      });
    }
  }
}


/**
 * A hand-written deep copy of the known shape. `structuredClone` is correct but
 * roughly three times slower here, and the reducer clones on every single
 * action — the simulation harness runs tens of millions of these.
 */
export function cloneState(state: GameState): GameState {
  const p = state.player;
  const ship = state.ship;
  const salvage: Record<NodeId, string[]> = {};
  for (const id in ship.salvage) salvage[id] = (ship.salvage[id] as string[]).slice();
  const clone: GameState = {
    seed: state.seed,
    rng: state.rng,
    turn: state.turn,
    depth: state.depth,
    role: state.role,
    player: {
      node: p.node,
      ap: p.ap,
      hand: p.hand.slice(),
      deck: p.deck.slice(),
      discard: p.discard.slice(),
      burned: p.burned.slice(),
      spent: p.spent.slice(),
      carry: p.carry.map((c) => ({ id: c.id, revealed: c.revealed })),
      pendingWounds: p.pendingWounds,
      wardsThisTurn: p.wardsThisTurn,
      combatPenalty: p.combatPenalty,
      panicsGained: p.panicsGained,
    },
    ship: {
      power: ship.power,
      shuttleCharge: ship.shuttleCharge,
      reactorOutput: ship.reactorOutput,
      noise: { ...ship.noise },
      sealedEdges: ship.sealedEdges.map((e) => ({
        edge: [e.edge[0], e.edge[1]] as [NodeId, NodeId],
        expiresTurn: e.expiresTurn,
      })),
      searched: ship.searched.slice(),
      salvage,
      scuttleArmed: ship.scuttleArmed,
      scuttleArmedTurn: ship.scuttleArmedTurn,
      beaconSent: ship.beaconSent,
    },
    bag: { ...state.bag },
    reserve: { ...state.reserve },
    threats: state.threats.map((t) =>
      t.fed === undefined
        ? { id: t.id, type: t.type, node: t.node, hp: t.hp }
        : { id: t.id, type: t.type, node: t.node, hp: t.hp, fed: t.fed },
    ),
    carryDeck: state.carryDeck.slice(),
    bagKnownTurn: state.bagKnownTurn,
    nextThreatId: state.nextThreatId,
    phase: state.phase,
    resumeEndTurn: state.resumeEndTurn,
    stats: { ...state.stats },
    log: state.log.slice(),
    feed: state.feed.slice(),
    status: state.status,
  };
  if (state.result !== undefined) clone.result = { ...state.result };
  return clone;
}

/** Stable hash of the whole state, used by determinism tests and goldens. */
export function hashState(state: GameState): string {
  const json = JSON.stringify(state, (key, value: unknown) => {
    if (key === 'feed') return undefined;
    return value;
  });
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < json.length; i++) {
    const ch = json.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0');
}

export const DEPTH_LIST = DEPTHS;
