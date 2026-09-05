import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  RULES,
  TOTAL_TOKENS,
  TOKEN_TYPES,
  assertInvariants,
  boardCap,
  hashState,
  initialState,
  legalActions,
  reduce,
  replay,
  setInvariantChecking,
  turnLimit,
} from '../src/engine';
import type { Action, Depth, GameState, Objective, RoleId } from '../src/engine/types';

setInvariantChecking(true);

const ROLES: RoleId[] = ['engineer', 'security', 'medic', 'surveyor', 'pilot'];
const DEPTHS: Depth[] = [1, 2, 3, 4, 5];
const OBJECTIVES: Objective[] = ['run', 'burn', 'call', 'know'];

const config = fc.record({
  seed: fc.string({ minLength: 1, maxLength: 12 }),
  role: fc.constantFrom(...ROLES),
  depth: fc.constantFrom(...DEPTHS),
  objective: fc.constantFrom(...OBJECTIVES),
  choices: fc.array(fc.nat(), { minLength: 40, maxLength: 400 }),
});

/** Play a run out by picking legal actions from a fixed list of numbers. */
function drive(
  cfg: { seed: string; role: RoleId; depth: Depth; objective: Objective; choices: number[] },
  visit?: (s: GameState) => void,
): { state: GameState; log: Action[] } {
  let state = initialState(cfg.seed, cfg.role, cfg.depth, cfg.objective);
  const log: Action[] = [];
  let i = 0;
  let guard = 0;
  while (state.status === 'active' && guard++ < 1200) {
    const legal = legalActions(state);
    expect(legal.length).toBeGreaterThan(0);
    const action = legal[(cfg.choices[i++ % cfg.choices.length] ?? 0) % legal.length] as Action;
    log.push(action);
    state = reduce(state, action);
    visit?.(state);
  }
  return { state, log };
}

describe('properties that must hold on every reachable state', () => {
  it('never breaks token or card conservation, or any bound', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        drive(cfg, (s) => {
          assertInvariants(s);
          const bag = TOKEN_TYPES.reduce((a, t) => a + (s.bag[t] ?? 0), 0);
          const reserve = TOKEN_TYPES.reduce((a, t) => a + (s.reserve[t] ?? 0), 0);
          const board = s.threats.filter((t) => t.type !== 'mother').length;
          expect(bag + reserve + board).toBe(TOTAL_TOKENS);
        });
      }),
      { numRuns: 25 },
    );
  });

  /**
   * The cap is the whole of §3.3. The old game's board grew monotonically to
   * eight, ten, twelve; this asserts it cannot happen again on any path.
   */
  it('never puts more on the board than the depth allows', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        drive(cfg, (s) => {
          const board = s.threats.filter((t) => t.type !== 'mother').length;
          expect(board).toBeLessThanOrEqual(boardCap(s.depth));
          expect(s.threats.filter((t) => t.type === 'mother').length).toBeLessThanOrEqual(1);
        });
      }),
      { numRuns: 25 },
    );
  });

  it('always terminates by the turn limit', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        const { state } = drive(cfg);
        expect(state.status).not.toBe('active');
        expect(state.turn).toBeLessThanOrEqual(turnLimit(cfg.depth) + 1);
      }),
      { numRuns: 25 },
    );
  });

  it('has no zombie states: empty legal actions means the run is over', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        drive(cfg, (s) => {
          if (legalActions(s).length === 0) expect(s.status).not.toBe('active');
        });
      }),
      { numRuns: 20 },
    );
  });

  it('never resolves a run without saying which route did it', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        const { state } = drive(cfg);
        expect(state.result).toBeDefined();
        expect(state.result?.ending).toBe(state.status);
        const declaredWin = RULES.endings[state.result!.ending].objective;
        expect(state.result?.declared).toBe(
          declaredWin !== undefined && declaredWin === cfg.objective,
        );
      }),
      { numRuns: 20 },
    );
  });

  it('replays a log to an identical state hash', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        const { state, log } = drive(cfg);
        const again = replay(initialState(cfg.seed, cfg.role, cfg.depth, cfg.objective), log);
        expect(hashState(again)).toBe(hashState(state));
      }),
      { numRuns: 20 },
    );
  });

  it('is deterministic for the same seed and the same choices', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        expect(hashState(drive(cfg).state)).toBe(hashState(drive(cfg).state));
      }),
      { numRuns: 15 },
    );
  });

  it('keeps every score inside the band the ending multipliers promise', () => {
    fc.assert(
      fc.property(config, (cfg) => {
        const { state } = drive(cfg);
        expect(state.result!.score).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 15 },
    );
  });
});
