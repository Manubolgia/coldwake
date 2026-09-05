import { describe, expect, it } from 'vitest';
import {
  OBJECTIVES,
  RULES,
  allProgress,
  endingReport,
  fuseTurns,
  infectionThreshold,
  reduce,
  relayHold,
  scoreFor,
  shuttleRequirement,
} from '../src/engine';
import type { Objective } from '../src/engine/types';
import { at, endTurn, fresh, hush, has, put, spawn, withInfection } from './helpers';

/** Fast-forward the ship without giving anything a chance to walk into you. */
function quietHours(state: ReturnType<typeof fresh>, n: number): ReturnType<typeof fresh> {
  let s = state;
  for (let i = 0; i < n; i++) {
    s = endTurn(hush(s));
    if (s.status !== 'active') break;
  }
  return s;
}

describe('all four routes are live, tracked and reachable', () => {
  it('tracks every one of them from the first hour', () => {
    const p = allProgress(fresh());
    expect(p.map((x) => x.objective).sort()).toEqual([...OBJECTIVES].sort());
    for (const x of p) expect(x.label.length).toBeGreaterThan(0);
  });

  it('RUN: banks the charge and flies it out', () => {
    const s = put(at(fresh('engineer', 1, 'run', 'run'), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    const done = reduce(s, { t: 'launch' });
    expect(done.status).toBe('escaped');
    expect(done.result?.declared).toBe(true);
  });

  it('BURN: arms the overload and has to live through the fuse', () => {
    const armed = reduce(
      put(at(fresh('engineer', 1, 'burn', 'burn'), 'bridge'), (x) => {
        x.ship.power = RULES.powerCap;
      }),
      { t: 'armScuttle' },
    );
    expect(armed.ship.scuttleArmed).toBe(true);
    // Not finished the moment it is armed: the fuse has to run.
    expect(quietHours(armed, fuseTurns(1) - 1).status).toBe('active');
    const done = quietHours(armed, fuseTurns(1) + 1);
    expect(done.status).toBe('overload');
    expect(done.result?.declared).toBe(true);
  });

  it('BURN: makes the whole ship louder every hour it counts down', () => {
    const armed = reduce(
      put(at(fresh('engineer', 1, 'burn', 'burn'), 'bridge'), (x) => {
        x.ship.power = RULES.powerCap;
      }),
      { t: 'armScuttle' },
    );
    const after = endTurn(hush(armed));
    expect(after.ship.noise.cryobay).toBeGreaterThan(0);
  });

  it('CALL: broadcasts, then holds the watch hour by hour', () => {
    const sent = reduce(
      put(at(fresh('engineer', 1, 'call', 'call'), 'comms'), (x) => {
        x.ship.power = RULES.powerCap;
      }),
      { t: 'beacon' },
    );
    expect(sent.ship.beaconSent).toBe(true);
    expect(sent.ship.relayHeld).toBe(0);
    const done = quietHours(sent, relayHold(1));
    expect(done.status).toBe('relay');
    expect(done.result?.declared).toBe(true);
  });

  it('CALL: the watch only runs while you are at the set, and never resets', () => {
    // It used to break whenever anything walked into comms, which reads as a
    // rule until you notice comms shares a bulkhead with the nest.
    let s = reduce(
      put(at(fresh('engineer', 1, 'call', 'call'), 'comms'), (x) => {
        x.ship.power = RULES.powerCap;
      }),
      { t: 'beacon' },
    );
    s = quietHours(s, 1);
    expect(s.ship.relayHeld).toBe(1);
    // Something in the room with you costs a capability, not the watch.
    const besieged = endTurn(hush(spawn(s, 'contact', 'comms')));
    expect(besieged.ship.relayHeld).toBe(2);
    // Walking away holds it where it is.
    const away = endTurn(hush(at(s, 'bridge')));
    expect(away.ship.relayHeld).toBe(1);
    expect(away.ship.beaconSent).toBe(true);
  });

  it('CALL: an empty pool holds the watch too', () => {
    let s = reduce(
      put(at(fresh('engineer', 1, 'call', 'call'), 'comms'), (x) => {
        x.ship.power = RULES.powerCap;
      }),
      { t: 'beacon' },
    );
    s = put(s, (x) => {
      x.ship.power = 0;
      x.ship.reactorOutput = 0;
      x.player.ap = 0;
    });
    const after = endTurn(s);
    expect(after.ship.relayHeld).toBe(0);
    expect(after.ship.beaconSent).toBe(true);
  });

  it('KNOW: cuts the specimen out of the nest and puts it up the wire', () => {
    const took = reduce(at(fresh('engineer', 1, 'know', 'know'), 'ore_hold'), {
      t: 'takeSpecimen',
    });
    expect(took.player.carryingSpecimen).toBe(true);
    const atComms = put(at(took, 'comms'), (x) => {
      x.ship.power = RULES.powerCap;
      x.player.ap = RULES.apPerTurn;
    });
    expect(has(atComms, { t: 'upload' })).toBe(true);
    const done = reduce(atComms, { t: 'upload' });
    expect(done.status).toBe('specimen');
    expect(done.result?.declared).toBe(true);
  });

  it('KNOW: the specimen calls to them every hour you carry it', () => {
    const took = hush(
      at(reduce(at(fresh('engineer', 1, 'know', 'know'), 'ore_hold'), { t: 'takeSpecimen' }), 'spine_a'),
    );
    expect(endTurn(took).ship.noise.spine_a).toBeGreaterThan(0);
  });
});

describe('the ending is what you finished, never what you died holding', () => {
  it('pays the declared bonus only for the route you named', () => {
    const declared = put(at(fresh('engineer', 1, 'a', 'run'), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    const other = put(at(fresh('engineer', 1, 'a', 'burn'), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    const a = reduce(declared, { t: 'launch' });
    const b = reduce(other, { t: 'launch' });
    expect(a.result?.ending).toBe('escaped');
    expect(b.result?.ending).toBe('escaped');
    expect(a.result?.declared).toBe(true);
    expect(b.result?.declared).toBe(false);
    expect(a.result!.score).toBeGreaterThan(b.result!.score);
  });

  it('keeps the whole multiplier band inside 0.8 and 1.25', () => {
    // In the old game it ran 0.3x to 1.5x, so the last flag set outweighed
    // every decision taken before it.
    for (const e of Object.values(RULES.endings)) {
      expect(e.multiplier).toBeGreaterThanOrEqual(0.8);
      expect(e.multiplier).toBeLessThanOrEqual(1.25);
    }
    expect(RULES.declaredBonus).toBeLessThanOrEqual(1.25);
  });

  it('finishes on a route you did not declare and still counts it a win', () => {
    const s = reduce(
      put(at(fresh('engineer', 1, 'x', 'run'), 'comms'), (x) => {
        x.ship.power = RULES.powerCap;
      }),
      { t: 'beacon' },
    );
    const done = quietHours(s, relayHold(1));
    expect(done.status).toBe('relay');
    expect(done.result?.declared).toBe(false);
    expect(scoreFor(done, 'relay', false)).toBeLessThan(scoreFor(done, 'relay', true));
  });

  it('says which rule fired, on this run\'s own numbers', () => {
    for (const o of OBJECTIVES) {
      const s = put(fresh('engineer', 1, 'r', o as Objective), (x) => {
        x.turn = 9;
      });
      const report = endingReport(s);
      expect(report.verdict.length).toBeGreaterThan(10);
      expect(report.why.length).toBeGreaterThan(10);
      expect(report.instead.length).toBeGreaterThan(10);
    }
  });

  it('reports where all four trackers stood when the window shut', () => {
    const s = put(fresh(), (x) => {
      x.turn = 1;
      x.player.ap = 0;
    });
    const timedOut = put(s, (x) => {
      x.turn = 18;
    });
    const done = endTurn(timedOut);
    expect(done.status).toBe('adrift');
    expect(endingReport(done).why).toContain('SHUTTLE');
  });

  it('makes the CARRIER a decision rather than a reveal', () => {
    const under = put(at(withInfection(fresh(), infectionThreshold(1) - 1), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    const over = put(at(withInfection(fresh(), infectionThreshold(1)), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    expect(reduce(under, { t: 'launch' }).status).toBe('escaped');
    expect(reduce(over, { t: 'launch' }).status).toBe('carrier');
  });
});
