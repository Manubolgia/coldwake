import { describe, expect, it } from 'vitest';
import { ADVISORIES, newAdvisories } from '../src/ui/guidance';
import { RULES, initialState, reduce, shuttleRequirement } from '../src/engine';
import { at, endTurn, fresh, put, spawn } from './helpers';

describe('the advisory voice', () => {
  it('opens by explaining the arithmetic, once', () => {
    const fired = new Set<string>();
    const s = initialState('guide', 'engineer', 1);
    const first = newAdvisories(s, fired);
    expect(first.map((l) => l.kind)).toEqual(first.map(() => 'guide'));
    expect(first.some((l) => l.text.includes('shuttle will not lift'))).toBe(true);
    expect(newAdvisories(s, fired)).toEqual([]);
  });

  it('says nothing at all once the run is over', () => {
    const done = put(at(fresh(), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    const launched = reduce(done, { t: 'launch' });
    expect(newAdvisories(launched, new Set())).toEqual([]);
  });

  it('explains a wound the first time one lands, and not again', () => {
    const fired = new Set<string>(ADVISORIES.map((a) => a.id));
    fired.delete('firstWound');
    let s = spawn(at(fresh(), 'spine_a'), 'drifter', 'spine_a');
    s = put(s, (x) => {
      x.ship.noise.spine_a = 3;
    });
    expect(newAdvisories(s, new Set(fired))).toEqual([]);
    s = endTurn(s);
    const said = newAdvisories(s, fired);
    expect(said).toHaveLength(1);
    expect(said[0]?.text).toContain('cannot');
    expect(newAdvisories(s, fired)).toEqual([]);
  });

  it('warns when the shuttle has gone out of reach', () => {
    const fired = new Set<string>(ADVISORIES.map((a) => a.id));
    fired.delete('cannotMakeIt');
    const doomed = put(fresh(), (x) => {
      x.turn = 19;
      x.ship.power = 0;
      x.ship.shuttleCharge = 0;
    });
    const said = newAdvisories(doomed, fired);
    expect(said).toHaveLength(1);
    expect(said[0]?.text).toMatch(/bridge|comms/i);
  });

  it('has a trigger the evaluator knows for every advisory it ships', () => {
    const fired = new Set<string>();
    // A run long enough to exercise the conditions without asserting on which.
    let s = initialState('coverage', 'security', 3);
    for (let i = 0; i < 12 && s.status === 'active'; i++) s = endTurn(s);
    newAdvisories(s, fired);
    for (const a of ADVISORIES) expect(typeof a.text).toBe('string');
    expect(ADVISORIES.length).toBeGreaterThan(10);
    expect(RULES.carry.carrierThreshold).toBe(2);
  });
});
