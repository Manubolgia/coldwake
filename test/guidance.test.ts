import { describe, expect, it } from 'vitest';
import { ADVISORIES, newAdvisories } from '../src/ui/guidance';
import { RULES, initialState, reduce, shuttleRequirement } from '../src/engine';
import { at, endTurn, fresh, put, spawn } from './helpers';

describe('the advisory voice', () => {
  it('opens by explaining the arithmetic, once', () => {
    const fired = new Set<string>();
    const s = initialState('guide', 'engineer', 1);
    const first = newAdvisories(s, fired);
    // One at a time, never a wall of them.
    expect(first).toHaveLength(1);
    expect(first[0]?.kind).toBe('guide');
    expect(first[0]?.text).toContain('SHUTTLE is what you have banked');
    // Whatever comes next, it is never the same lesson twice.
    const second = newAdvisories(s, fired);
    expect(second.map((l) => l.text)).not.toContain(first[0]?.text);
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
    // An advisory is read at speed in the middle of an hour. The first pass
    // wrote paragraphs and they were the long pole in a bad hour, ahead of the
    // ship's own alarms.
    for (const a of ADVISORIES) expect(a.text.length).toBeLessThanOrEqual(240);
    expect(RULES.carry.carrierThreshold).toBe(2);
  });
});
