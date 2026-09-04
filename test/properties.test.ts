import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  RULES,
  TOTAL_TOKENS,
  assertInvariants,
  hashState,
  initialState,
  legalActions,
  reduce,
  replay,
  roleDeck,
  turnLimit,
} from '../src/engine';
import type { Action, Depth, GameState, RoleId } from '../src/engine/types';

const ROLES: RoleId[] = ['engineer', 'security', 'medic', 'surveyor', 'pilot'];
const DEPTHS: Depth[] = [1, 2, 3, 4, 5];

/** Play a random legal line, recording it, and check the invariants throughout. */
function randomRun(
  seed: string,
  role: RoleId,
  depth: Depth,
  pick: (n: number, step: number) => number,
): { state: GameState; actions: Action[] } {
  let state = initialState(seed, role, depth);
  const actions: Action[] = [];
  let step = 0;
  while (state.status === 'active' && step < 1500) {
    const legal = legalActions(state);
    expect(legal.length).toBeGreaterThan(0);
    const action = legal[pick(legal.length, step)] as Action;
    state = reduce(state, action);
    assertInvariants(state);
    actions.push(action);
    step += 1;
  }
  return { state, actions };
}

const mulberry = (seed: number) => {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('properties (gates 1.3-1.8)', () => {
  it('never breaks token or card conservation, or any bound', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e6 }), fc.constantFrom(...ROLES), fc.constantFrom(...DEPTHS), (n, role, depth) => {
        const rand = mulberry(n + 1);
        const { state } = randomRun(`p${n}`, role, depth, (len) => Math.floor(rand() * len));
        const bag = Object.values(state.bag).reduce((a, b) => a + b, 0);
        const reserve = Object.values(state.reserve).reduce((a, b) => a + b, 0);
        expect(bag + reserve + state.threats.length).toBe(TOTAL_TOKENS);
        const p = state.player;
        const acquired = [...p.hand, ...p.deck, ...p.discard, ...p.burned].filter((u) =>
          u.startsWith('salv_'),
        ).length;
        expect(p.hand.length + p.deck.length + p.discard.length + p.burned.length).toBe(
          roleDeck(role).length + p.panicsGained + acquired,
        );
        expect(state.ship.power).toBeGreaterThanOrEqual(0);
        expect(state.ship.power).toBeLessThanOrEqual(RULES.powerCap);
        expect(state.ship.shuttleCharge).toBeGreaterThanOrEqual(0);
        expect(state.ship.reactorOutput).toBeGreaterThanOrEqual(0);
        expect(state.ship.reactorOutput).toBeLessThanOrEqual(RULES.reactorOutputMax);
        for (const n2 of Object.values(state.ship.noise)) {
          expect(n2).toBeGreaterThanOrEqual(0);
          expect(n2).toBeLessThanOrEqual(RULES.noiseMax);
        }
      }),
      { numRuns: 120 },
    );
  });

  it('always terminates by the turn limit', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e6 }), fc.constantFrom(...DEPTHS), (n, depth) => {
        const rand = mulberry(n + 7);
        const { state } = randomRun(`t${n}`, 'engineer', depth, (len) => Math.floor(rand() * len));
        expect(state.status).not.toBe('active');
        expect(state.turn).toBeLessThanOrEqual(turnLimit(depth) + 1);
      }),
      { numRuns: 60 },
    );
  });

  it('has no zombie states: empty legal actions means the run is over', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e6 }), (n) => {
        const rand = mulberry(n + 11);
        let state = initialState(`z${n}`, 'surveyor', 3);
        while (state.status === 'active') {
          const legal = legalActions(state);
          expect(legal.length > 0).toBe(true);
          state = reduce(state, legal[Math.floor(rand() * legal.length)] as Action);
        }
        expect(legalActions(state)).toHaveLength(0);
      }),
      { numRuns: 40 },
    );
  });

  it('replays a log to an identical state hash', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1e6 }), fc.constantFrom(...ROLES), (n, role) => {
        const rand = mulberry(n + 13);
        const { state, actions } = randomRun(`r${n}`, role, 2, (len) => Math.floor(rand() * len));
        const again = replay(initialState(`r${n}`, role, 2), actions);
        expect(hashState(again)).toBe(hashState(state));
      }),
      { numRuns: 60 },
    );
  });

  it('is deterministic for the same seed and the same choices', () => {
    const a = randomRun('same', 'medic', 4, (len, step) => (step * 7) % len);
    const b = randomRun('same', 'medic', 4, (len, step) => (step * 7) % len);
    expect(hashState(a.state)).toBe(hashState(b.state));
  });
});
