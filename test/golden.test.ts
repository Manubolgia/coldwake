import { describe, expect, it } from 'vitest';
import fixtures from './golden/replays.json';
import { hashState, initialState, replay } from '../src/engine';
import type { Action, Depth, Objective, RoleId } from '../src/engine/types';

type Fixture = {
  seed: string;
  role: RoleId;
  depth: Depth;
  objective: Objective;
  bot: string;
  actions: Action[];
  ending: string;
  score: number;
  hash: string;
};

describe('golden replays', () => {
  const list = fixtures as unknown as Fixture[];

  it('has thirty committed fixtures', () => {
    expect(list.length).toBe(30);
  });

  for (const f of list) {
    it(`${f.seed} (${f.role} d${f.depth} ${f.objective}, ${f.bot}) still ends in ${f.ending}`, () => {
      const final = replay(initialState(f.seed, f.role, f.depth, f.objective), f.actions);
      expect(final.status).toBe(f.ending);
      expect(final.result?.score).toBe(f.score);
      expect(hashState(final)).toBe(f.hash);
    });
  }

  it('covers every objective and a spread of endings across the fixture set', () => {
    expect(new Set(list.map((f) => f.objective)).size).toBe(4);
    expect(new Set(list.map((f) => f.ending)).size).toBeGreaterThanOrEqual(4);
  });
});
