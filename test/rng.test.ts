import { describe, expect, it } from 'vitest';
import { next, nextInt, rollD6, seedFrom, shuffle } from '../src/engine/rng';

describe('rng (gate 0.2-0.4)', () => {
  it('produces an identical sequence for the same seed', () => {
    const a: number[] = [];
    const b: number[] = [];
    let sa = seedFrom('bellwether');
    let sb = seedFrom('bellwether');
    for (let i = 0; i < 10000; i++) {
      const [va, na] = next(sa);
      const [vb, nb] = next(sb);
      a.push(va);
      b.push(vb);
      sa = na;
      sb = nb;
    }
    expect(a).toEqual(b);
  });

  it('diverges within three values for different seeds', () => {
    let sa = seedFrom('kell-1');
    let sb = seedFrom('kell-2');
    let diverged = false;
    for (let i = 0; i < 3; i++) {
      const [va, na] = next(sa);
      const [vb, nb] = next(sb);
      if (va !== vb) diverged = true;
      sa = na;
      sb = nb;
    }
    expect(diverged).toBe(true);
  });

  it('is uniform enough over 100k draws (chi-square, 10 bins)', () => {
    const bins = new Array<number>(10).fill(0);
    let s = seedFrom('uniformity');
    const n = 100000;
    for (let i = 0; i < n; i++) {
      const [v, ns] = next(s);
      s = ns;
      const bin = Math.min(9, Math.floor(v * 10));
      bins[bin] = (bins[bin] ?? 0) + 1;
    }
    const expected = n / 10;
    const chi = bins.reduce((acc, c) => acc + ((c - expected) ** 2) / expected, 0);
    // 9 degrees of freedom, p=0.001 critical value is 27.88.
    expect(chi).toBeLessThan(27.88);
  });

  it('survives JSON round-trip and continues the same sequence', () => {
    let s = seedFrom('serialise');
    for (let i = 0; i < 50; i++) s = next(s)[1];
    const revived = JSON.parse(JSON.stringify({ s })).s as number;
    const a: number[] = [];
    const b: number[] = [];
    let x = s;
    let y = revived;
    for (let i = 0; i < 20; i++) {
      const [va, nx] = next(x);
      const [vb, ny] = next(y);
      a.push(va);
      b.push(vb);
      x = nx;
      y = ny;
    }
    expect(a).toEqual(b);
  });

  it('rolls d6 in range and shuffles without losing elements', () => {
    let s = seedFrom('dice');
    for (let i = 0; i < 500; i++) {
      const [roll, ns] = rollD6(s);
      s = ns;
      expect(roll).toBeGreaterThanOrEqual(1);
      expect(roll).toBeLessThanOrEqual(6);
    }
    const items = Array.from({ length: 30 }, (_, i) => i);
    const [shuffled] = shuffle(items, seedFrom('shuffle'));
    expect(shuffled.slice().sort((a, b) => a - b)).toEqual(items);
    expect(shuffled).not.toEqual(items);
    const [i0] = nextInt(seedFrom('x'), 5);
    expect(i0).toBeGreaterThanOrEqual(0);
    expect(i0).toBeLessThan(5);
  });
});
