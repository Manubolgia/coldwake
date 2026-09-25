// Seeded PRNG. The generator's state lives inside GameState, so a saved game
// resumes with exactly the same future, and a seed replays a whole run.

export function hashSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

/** mulberry32 step: returns [value in 0..1, next state]. */
export function step(state: number): [number, number] {
  const next = (state + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return [value, next];
}

/** A mutable cursor over the state, written back by the caller when done. */
export class Rng {
  constructor(public state: number) {}

  next(): number {
    const [v, s] = step(this.state);
    this.state = s;
    return v;
  }

  int(minInclusive: number, maxInclusive: number): number {
    return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
  }

  die(): number {
    return this.int(1, 6);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('pick from empty list');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  weighted<T>(items: readonly { item: T; weight: number }[]): T {
    const total = items.reduce((a, b) => a + Math.max(0, b.weight), 0);
    if (total <= 0) return this.pick(items).item;
    let roll = this.next() * total;
    for (const entry of items) {
      roll -= Math.max(0, entry.weight);
      if (roll < 0) return entry.item;
    }
    return items[items.length - 1]!.item;
  }

  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j]!, out[i]!];
    }
    return out;
  }
}

export function randomSeed(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
