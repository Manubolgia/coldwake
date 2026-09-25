import type { GameState } from './types';

export function neighbours(s: Pick<GameState, 'edges'>, room: string): string[] {
  const out: string[] = [];
  for (const [a, b] of s.edges) {
    if (a === room) out.push(b);
    else if (b === room) out.push(a);
  }
  return out;
}

/** Breadth-first distances from `from` to every reachable room. */
export function distances(s: Pick<GameState, 'edges'>, from: string): Record<string, number> {
  const dist: Record<string, number> = { [from]: 0 };
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of neighbours(s, cur)) {
      if (dist[n] === undefined) {
        dist[n] = dist[cur]! + 1;
        queue.push(n);
      }
    }
  }
  return dist;
}

export function distance(s: Pick<GameState, 'edges'>, a: string, b: string): number {
  return distances(s, a)[b] ?? 99;
}

/** The neighbour of `from` that is one step closer to `to` (ties broken by order). */
export function stepToward(s: Pick<GameState, 'edges'>, from: string, to: string): string {
  if (from === to) return from;
  const dist = distances(s, to);
  let best = from;
  let bestD = dist[from] ?? 99;
  for (const n of neighbours(s, from)) {
    const d = dist[n] ?? 99;
    if (d < bestD) {
      best = n;
      bestD = d;
    }
  }
  return best;
}
