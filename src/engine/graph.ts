import { ADJACENCY, NODE_IDS, NODE_INDEX, edgeKey } from './content';
import type { GameState, NodeId, SealedEdge } from './types';

export function sealedSet(sealed: readonly SealedEdge[], turn: number): Set<string> {
  const s = new Set<string>();
  for (const e of sealed) {
    if (e.expiresTurn > turn) s.add(edgeKey(e.edge[0], e.edge[1]));
  }
  return s;
}

export function isSealed(state: GameState, a: NodeId, b: NodeId): boolean {
  return sealedSet(state.ship.sealedEdges, state.turn).has(edgeKey(a, b));
}

/** Neighbours in canonical order, optionally honouring seals. */
export function neighbours(state: GameState, from: NodeId, respectSeals = true): NodeId[] {
  const adj = ADJACENCY[from] ?? [];
  if (!respectSeals) return adj;
  const sealed = sealedSet(state.ship.sealedEdges, state.turn);
  return adj.filter((n) => !sealed.has(edgeKey(from, n)));
}

// One cache per state object. States are immutable and short-lived, so this is
// always correct and saves a great deal of repeated breadth-first search in the
// bots, which evaluate every legal action at every decision.
const distanceCache = new WeakMap<GameState, Map<string, Map<NodeId, number>>>();

/** BFS distances from a node. Unreachable nodes are absent from the map. */
export function distances(state: GameState, from: NodeId, respectSeals = true): Map<NodeId, number> {
  const key = `${from}|${respectSeals ? 1 : 0}`;
  let perState = distanceCache.get(state);
  if (perState === undefined) {
    perState = new Map();
    distanceCache.set(state, perState);
  }
  const hit = perState.get(key);
  if (hit !== undefined) return hit;
  const computed = computeDistances(state, from, respectSeals);
  perState.set(key, computed);
  return computed;
}

function computeDistances(state: GameState, from: NodeId, respectSeals: boolean): Map<NodeId, number> {
  const dist = new Map<NodeId, number>([[from, 0]]);
  const queue: NodeId[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift() as NodeId;
    const d = dist.get(cur) ?? 0;
    for (const n of neighbours(state, cur, respectSeals)) {
      if (!dist.has(n)) {
        dist.set(n, d + 1);
        queue.push(n);
      }
    }
  }
  return dist;
}

export function distance(state: GameState, a: NodeId, b: NodeId, respectSeals = true): number {
  const d = distances(state, a, respectSeals).get(b);
  return d === undefined ? Infinity : d;
}

/**
 * One step from `from` toward `to`. Deterministic: shortest path first, then
 * canonical node order as the tie-break. Returns `from` when there is no route.
 */
export function stepToward(
  state: GameState,
  from: NodeId,
  to: NodeId,
  respectSeals = true,
): NodeId {
  if (from === to) return from;
  const dist = distances(state, to, respectSeals);
  const here = dist.get(from);
  if (here === undefined) return from;
  const candidates = neighbours(state, from, respectSeals)
    .filter((n) => (dist.get(n) ?? Infinity) < here)
    .sort((a, b) => {
      const da = dist.get(a) ?? Infinity;
      const db = dist.get(b) ?? Infinity;
      return da !== db ? da - db : NODE_INDEX[a]! - NODE_INDEX[b]!;
    });
  return candidates[0] ?? from;
}

/** The loudest node. Ties break on canonical map order. */
export function loudestNode(state: GameState): NodeId {
  let best = NODE_IDS[0] as NodeId;
  let bestNoise = -1;
  for (const id of NODE_IDS) {
    const n = state.ship.noise[id] ?? 0;
    if (n > bestNoise) {
      bestNoise = n;
      best = id;
    }
  }
  return best;
}
