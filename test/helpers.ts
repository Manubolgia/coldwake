import {
  TOTAL_TOKENS,
  initialState,
  noiseFloor,
  isInfection,
  legalActions,
  reduce,
  threatDef,
} from '../src/engine';
import type {
  Action,
  Depth,
  GameState,
  Location,
  NodeId,
  Objective,
  RoleId,
  ThreatType,
  TokenType,
  Uid,
} from '../src/engine/types';

/**
 * A run at its first hour with the board cleared: every depth places something
 * at the nest on setup, and a rule test wants to state its own starting
 * position. The opening draw itself is asserted in the depth test.
 */
export function fresh(
  role: RoleId = 'engineer',
  depth: Depth = 1,
  seed = 'test',
  objective: Objective = 'run',
): GameState {
  return clearBoard(initialState(seed, role, depth, objective));
}

/** Return every threat on the board to the bag, keeping conservation. */
export function clearBoard(state: GameState): GameState {
  return put(state, (s) => {
    for (const t of s.threats) {
      if (t.type === 'mother') continue;
      s.bag[t.type as TokenType] = (s.bag[t.type as TokenType] ?? 0) + 1;
    }
    s.threats = [];
    s.stats.bagDraws = 0;
    s.feed = [];
  });
}

/**
 * Direct state surgery for tests. Every helper here keeps the invariants
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
  const zero = { blank: 0, contact: 0, drifter: 0, burrower: 0 };
  const b = { ...zero, ...bag };
  const r = { ...zero, ...reserve };
  const onBoard = state.threats.filter((t) => t.type !== 'mother').length;
  const total = sum(b) + sum(r) + onBoard;
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
        s.player.infectionsGained += 1;
        taken.push(`${id}@${1000 + s.player.infectionsGained}`);
      }
    }
    s.player.burned.push(...pool);
    s.player.hand = taken;
    s.player.deck = [];
    s.player.discard = [];
  });
}

/**
 * A hand of exactly `real` capabilities and `infected` fresh infection cards,
 * with everything else pushed back into the kit. Conservation-safe: the
 * infection is counted the way the reducer counts it.
 */
export function handMix(state: GameState, real: number, infected: number): GameState {
  return put(state, (s) => {
    const kept = s.player.hand.filter((u) => !isInfection(u)).slice(0, real);
    s.player.deck.push(...s.player.hand.filter((u) => !kept.includes(u)));
    s.player.hand = kept;
    for (let i = 0; i < infected; i++) {
      s.player.infectionsGained += 1;
      s.player.hand.push(`inf_fever@${1000 + s.player.infectionsGained}`);
    }
  });
}

/** Put a threat on the board, with its memory stated rather than inferred. */
export function spawn(
  state: GameState,
  type: ThreatType,
  node: Location,
  target: NodeId | null = null,
): GameState {
  return put(state, (s) => {
    if (type !== 'mother') {
      const t = type as TokenType;
      if ((s.bag[t] ?? 0) > 0) s.bag[t] -= 1;
      else if ((s.reserve[t] ?? 0) > 0) s.reserve[t] -= 1;
      else if ((s.bag.blank ?? 0) > 0) s.bag.blank -= 1;
      else if ((s.reserve.blank ?? 0) > 0) s.reserve.blank -= 1;
      else throw new Error('no token available to place');
    } else {
      s.ship.motherWoken = true;
    }
    s.threats.push({
      id: `x${s.nextThreatId}`,
      type,
      node,
      hp: threatDef(type).hp,
      target,
      stance: target === null ? 'wandering' : 'hunting',
      cold: 0,
      stalled: 0,
      seenNode: null,
      seenTurn: -1,
    });
    s.nextThreatId += 1;
  });
}

/** N infection cards shuffled into the deck, the way a wound puts them there. */
export function withInfection(state: GameState, n: number): GameState {
  return put(state, (s) => {
    for (let i = 0; i < n; i++) {
      s.player.infectionsGained += 1;
      s.player.deck.push(`inf_fever@${1000 + s.player.infectionsGained}`);
    }
  });
}

/** Hold the ship still for an hour without breaking any compartment's floor. */
export function hush(state: GameState): GameState {
  return put(state, (s) => {
    s.player.ap = 0;
    for (const id of Object.keys(s.ship.noise)) {
      s.ship.noise[id] = noiseFloor(s.depth, id);
    }
  });
}

export function at(state: GameState, node: Location): GameState {
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
