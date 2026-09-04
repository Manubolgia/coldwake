/**
 * Seeded PRNG (mulberry32). The whole state is a single uint32 so it survives
 * JSON.stringify -> parse untouched, which is what makes replays byte-identical.
 * Nothing in here touches Math.random or Date.now.
 */

export type RngState = number;

/** FNV-1a over the seed string, so any string seed becomes a uint32. */
export function seedFrom(seed: string): RngState {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Avoid the degenerate 0 state.
  return (h >>> 0) || 0x9e3779b9;
}

/** One step. Returns the float in [0,1) and the next state. */
export function next(state: RngState): [number, RngState] {
  let t = (state + 0x6d2b79f5) | 0;
  const s = t >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, s];
}

/** Integer in [0, n). n must be > 0. */
export function nextInt(state: RngState, n: number): [number, RngState] {
  const [v, s] = next(state);
  return [Math.floor(v * n), s];
}

/** A six-sided die. */
export function rollD6(state: RngState): [number, RngState] {
  const [v, s] = nextInt(state, 6);
  return [v + 1, s];
}

/** Fisher-Yates. Returns a new array; never mutates the input. */
export function shuffle<T>(items: readonly T[], state: RngState): [T[], RngState] {
  const out = items.slice();
  let s = state;
  for (let i = out.length - 1; i > 0; i--) {
    const [j, ns] = nextInt(s, i + 1);
    s = ns;
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return [out, s];
}

/** Uniform pick. Returns undefined for an empty list. */
export function pick<T>(items: readonly T[], state: RngState): [T | undefined, RngState] {
  if (items.length === 0) return [undefined, state];
  const [i, s] = nextInt(state, items.length);
  return [items[i], s];
}
