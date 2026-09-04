import { TOTAL_TOKENS, initialState, legalActions, reduce, threatDef } from '../src/engine';
import type {
  Action,
  Depth,
  GameState,
  NodeId,
  RoleId,
  ThreatType,
  TokenType,
  Uid,
} from '../src/engine/types';

/**
 * A run at its first turn with the board cleared: every depth now places
 * something at the nest on setup, and a rule test wants to state its own
 * starting position. The opening draw itself is asserted in the depth test.
 */
export function fresh(role: RoleId = 'engineer', depth: Depth = 1, seed = 'test'): GameState {
  return clearBoard(initialState(seed, role, depth));
}

/** Return every threat on the board to the bag, keeping conservation. */
export function clearBoard(state: GameState): GameState {
  return put(state, (s) => {
    for (const t of s.threats) s.bag[t.type] = (s.bag[t.type] ?? 0) + 1;
    s.threats = [];
    s.stats.bagDraws = 0;
    s.feed = [];
  });
}

/**
 * Direct state surgery for tests. Every helper here keeps the §7 invariants
 * intact, so a failure is always the engine's fault and never the fixture's.
 */
export function put(state: GameState, patch: (s: GameState) => void): GameState {
  const copy = structuredClone(state);
  patch(copy);
  return copy;
}

const sum = (r: Record<string, number>): number => Object.values(r).reduce((a, b) => a + b, 0);

export function setTokens(
  state: GameState,
  bag: Partial<Record<TokenType, number>>,
  reserve: Partial<Record<TokenType, number>>,
): GameState {
  const zero = { blank: 0, contact: 0, drifter: 0, burrower: 0, chorus: 0 };
  const b = { ...zero, ...bag };
  const r = { ...zero, ...reserve };
  const total = sum(b) + sum(r) + state.threats.length;
  if (total !== TOTAL_TOKENS) {
    throw new Error(`fixture breaks token conservation: ${total} != ${TOTAL_TOKENS}`);
  }
  return put(state, (s) => {
    s.bag = b;
    s.reserve = r;
  });
}

/** Move named copies out of the deck into hand; everything else is discarded. */
export function withHand(state: GameState, cardIds: string[]): GameState {
  return put(state, (s) => {
    const pool = [...s.player.hand, ...s.player.deck, ...s.player.discard];
    const taken: Uid[] = [];
    for (const id of cardIds) {
      const i = pool.findIndex((u) => u.startsWith(`${id}@`));
      if (i < 0) throw new Error(`${id} is not in this role's deck`);
      taken.push(pool.splice(i, 1)[0] as Uid);
    }
    s.player.hand = taken;
    s.player.deck = [];
    s.player.discard = pool;
  });
}

/** Burn everything except the named cards, which end up in hand. */
export function handOnly(state: GameState, cardIds: string[]): GameState {
  return put(state, (s) => {
    const pool = [...s.player.hand, ...s.player.deck, ...s.player.discard];
    const taken: Uid[] = [];
    for (const id of cardIds) {
      const i = pool.findIndex((u) => u.startsWith(`${id}@`));
      if (i >= 0) {
        taken.push(pool.splice(i, 1)[0] as Uid);
      } else {
        s.player.panicsGained += 1;
        taken.push(`${id}@${1000 + s.player.panicsGained}`);
      }
    }
    s.player.burned.push(...pool);
    s.player.hand = taken;
    s.player.deck = [];
    s.player.discard = [];
  });
}

export function spawn(state: GameState, type: ThreatType, node: NodeId | 'vents'): GameState {
  return put(state, (s) => {
    if ((s.bag[type] ?? 0) > 0) s.bag[type] -= 1;
    else if ((s.reserve[type] ?? 0) > 0) s.reserve[type] -= 1;
    else if ((s.bag.blank ?? 0) > 0) s.bag.blank -= 1;
    else if ((s.reserve.blank ?? 0) > 0) s.reserve.blank -= 1;
    else throw new Error('no token available to place');
    s.threats.push({ id: `x${s.nextThreatId}`, type, node, hp: threatDef(type).hp });
    s.nextThreatId += 1;
  });
}

export function at(state: GameState, node: NodeId | 'vents'): GameState {
  return put(state, (s) => {
    s.player.node = node;
  });
}

export function has(state: GameState, action: Action): boolean {
  const key = JSON.stringify(action);
  return legalActions(state).some((a) => JSON.stringify(a) === key);
}

export function playCard(state: GameState, cardId: string, extra: Partial<Action> = {}): GameState {
  const uid = state.player.hand.find((u) => u.startsWith(`${cardId}@`));
  if (!uid) throw new Error(`${cardId} not in hand`);
  return reduce(state, { t: 'play', uid, ...extra } as Action);
}

/** End the turn, resolving any wound the threat phase inflicts. */
export function endTurn(state: GameState): GameState {
  let s = reduce(state, { t: 'endTurn' });
  while (s.status === 'active' && s.phase === 'wound') {
    const burn = legalActions(s)[0];
    if (!burn) break;
    s = reduce(s, burn);
  }
  return s;
}
