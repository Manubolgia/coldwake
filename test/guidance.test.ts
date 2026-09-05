import { describe, expect, it } from 'vitest';
import { RULES, infectionThreshold, reduce } from '../src/engine';
import { ADVISORIES, TRIGGER_NAMES, newAdvisories } from '../src/ui/guidance';
import { at, fresh, put, spawn, withInfection } from './helpers';

describe('the advisory voice', () => {
  it('opens by explaining what the four strips are for, one line at a time', () => {
    // One advisory per call, never a wall of them: a bad hour teaches one thing.
    const fired = new Set<string>();
    const first = newAdvisories(fresh(), fired);
    expect(first.length).toBe(1);
    expect(first[0]?.text).toMatch(/four/i);
    let guard = 0;
    while (newAdvisories(fresh(), fired).length > 0 && guard++ < 40);
    expect(newAdvisories(fresh(), fired)).toEqual([]);
  });

  it('says nothing at all once the run is over', () => {
    const done = put(fresh(), (s) => {
      s.status = 'adrift';
    });
    expect(newAdvisories(done, new Set())).toEqual([]);
  });

  it('explains a wound the first time one lands, and not again', () => {
    const fired = new Set<string>();
    const s = spawn(at(fresh(), 'spine_a'), 'contact', 'spine_a', 'spine_a');
    newAdvisories(s, fired);
    const hit = reduce(s, { t: 'endTurn' });
    const lines = [];
    for (let i = 0; i < 6; i++) lines.push(...newAdvisories(hit, fired));
    const wound = lines.filter((l) => l.text.includes('capability'));
    expect(wound.length).toBe(1);
  });

  it('names the forecast as the thing that stops a wound', () => {
    const fired = new Set<string>();
    const s = spawn(at(fresh(), 'spine_a'), 'contact', 'spine_b', 'spine_a');
    const lines = [];
    for (let i = 0; i < 10; i++) lines.push(...newAdvisories(s, fired));
    expect(lines.some((l) => /under the schematic/i.test(l.text))).toBe(true);
  });

  it('warns before the CARRIER line rather than after it', () => {
    const fired = new Set<string>();
    const s = withInfection(fresh(), infectionThreshold(1) - 1);
    const lines = [];
    for (let i = 0; i < 12; i++) lines.push(...newAdvisories(s, fired));
    expect(lines.some((l) => /CARRIER/.test(l.text))).toBe(true);
  });

  it('tells a run whose shuttle has gone that three routes are still open', () => {
    const fired = new Set<string>();
    const s = put(fresh(), (x) => {
      x.turn = RULES.turnLimit - 1;
      x.ship.shuttleCharge = 0;
      x.ship.power = 0;
      x.ship.reactorOutput = 0;
    });
    const lines = [];
    for (let i = 0; i < 30; i++) lines.push(...newAdvisories(s, fired));
    expect(lines.some((l) => /overload|relay|specimen/i.test(l.text))).toBe(true);
  });

  it('has a trigger the evaluator knows for every advisory it ships', () => {
    for (const a of ADVISORIES) {
      expect(TRIGGER_NAMES, a.id).toContain(a.trigger);
    }
  });
});
