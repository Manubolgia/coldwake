import { describe, expect, it } from 'vitest';
import { playOut } from '../src/game/bot';
import type { Difficulty, RoleId } from '../src/game/types';

const ROLES: RoleId[] = ['engineer', 'marine', 'medic', 'scientist', 'pilot', 'stowaway', 'android'];

describe('whole runs', () => {
  it('every seed, role and difficulty finishes without getting stuck', () => {
    for (const difficulty of ['story', 'standard', 'nightmare'] as Difficulty[]) {
      for (const role of ROLES) {
        for (let i = 0; i < 25; i++) {
          const { result, state } = playOut(`t-${difficulty}-${role}-${i}`, role, difficulty);
          expect(result.status, `${result.seed} did not finish`).not.toBe('playing');
          expect(state.ending).not.toBeNull();
          expect(state.player.hp).toBeGreaterThanOrEqual(0);
          expect(state.player.stress).toBeLessThanOrEqual(state.player.maxStress);
        }
      }
    }
  });

  it('keeps the standard win rate in band for a competent player', () => {
    let won = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const role = ROLES[i % 5]!;
      if (playOut(`band-${i}`, role, 'standard').result.status === 'won') won++;
    }
    const rate = won / n;
    // A bot that reads every preview perfectly; people will do worse at first.
    expect(rate).toBeGreaterThan(0.55);
    expect(rate).toBeLessThan(0.92);
  });

  it('difficulty orders story above nightmare', () => {
    const rate = (d: Difficulty) => {
      let w = 0;
      for (let i = 0; i < 200; i++) if (playOut(`ord-${i}`, 'engineer', d).result.status === 'won') w++;
      return w / 200;
    };
    expect(rate('story')).toBeGreaterThan(rate('nightmare'));
  });
});

describe('endings', () => {
  it('two runs that end the same way rarely read the same', () => {
    const byKind: Record<string, { titles: Set<string>; openings: Set<string>; n: number }> = {};
    for (let i = 0; i < 160; i++) {
      const { state } = playOut(`end-${i}`, ROLES[i % 5]!, 'standard');
      const e = state.ending!;
      const k = e.won ? `won:${e.exit}` : 'lost';
      const b = (byKind[k] ??= { titles: new Set(), openings: new Set(), n: 0 });
      b.titles.add(e.title);
      b.openings.add(e.epilogue[0]!);
      b.n++;
    }
    for (const [k, b] of Object.entries(byKind)) {
      if (b.n < 8) continue;
      expect(b.titles.size, `${k} titles`).toBeGreaterThan(2);
      expect(b.openings.size, `${k} opening lines`).toBeGreaterThan(2);
    }
  });

  it('the same run always gets the same ending', () => {
    const a = playOut('same-ending', 'marine', 'standard').state.ending;
    const b = playOut('same-ending', 'marine', 'standard').state.ending;
    expect(a).toEqual(b);
  });
});
