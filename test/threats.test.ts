import { describe, expect, it } from 'vitest';
import {
  RULES,
  earshot,
  forecast,
  hiveWake,
  killThreat,
  legalActions,
  perceivedIds,
  reduce,
  threatDef,
} from '../src/engine';
import { at, clearBoard, endTurn, fresh, has, put, spawn, withHand } from './helpers';

describe('a sound is a place, not an alarm', () => {
  it('carries as far as it is loud, up to what the creature can hear', () => {
    expect(earshot('contact', 3)).toBe(threatDef('contact').hearing);
    expect(earshot('contact', 1)).toBe(1);
    expect(earshot('drifter', 3)).toBe(3);
    // The MOTHER hears the whole ship, and hears nothing when you are silent.
    expect(earshot('mother', 1)).toBeGreaterThan(10);
    expect(earshot('mother', 0)).toBe(0);
  });

  it('tells everything in range where the noise was, not where you are', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'contact', 'spine_b');
    const walked = reduce(s, { t: 'move', to: 'spine_a' });
    const t = walked.threats[0];
    expect(t?.target).toBe('spine_a');
    expect(t?.stance).toBe('hunting');
  });

  it('tells nothing at all when you creep out of earshot', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'contact', 'spine_c');
    const crept = reduce(s, { t: 'creep', to: 'spine_a' });
    expect(crept.threats[0]?.target).toBe(null);
  });
});

describe('threats lose you', () => {
  it('arrives at the noise, finds nothing, and starts searching', () => {
    // It is going to spine_a; the player is not there any more.
    const s = put(spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a', 'spine_a'), (x) => {
      x.player.ap = 0;
    });
    const after = endTurn(s);
    expect(after.threats[0]?.stance).toBe('searching');
  });

  it('gives up on you entirely after searching, and that is worth something', () => {
    let s = put(spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a', 'spine_a'), (x) => {
      x.player.ap = 0;
    });
    for (let i = 0; i < 3; i++) {
      s = put(endTurn(s), (x) => {
        x.player.ap = 0;
        // Keep the ship silent so nothing re-acquires from the wander.
        for (const id of Object.keys(x.ship.noise)) x.ship.noise[id] = 0;
      });
    }
    expect(s.threats[0]?.target).toBe(null);
    expect(s.threats[0]?.stance).toBe('wandering');
    expect(s.stats.threatsShaken).toBeGreaterThan(0);
  });

  it('keeps a HUNTER on you inside its lock range whatever you do', () => {
    const def = threatDef('drifter');
    const s = put(spawn(at(fresh(), 'spine_a'), 'drifter', 'spine_b'), (x) => {
      x.player.ap = 0;
    });
    expect(def.lockRange).toBeGreaterThan(0);
    const after = endTurn(s);
    expect(after.threats[0]?.target).toBe('spine_a');
  });
});

describe('the MOTHER', () => {
  it('gets up when the hold fills, and only once', () => {
    const s = put(fresh(), (x) => {
      x.ship.hive = hiveWake(1) - 1;
      x.player.ap = 0;
    });
    const after = endTurn(s);
    expect(after.ship.motherWoken).toBe(true);
    expect(after.threats.filter((t) => t.type === 'mother').length).toBe(1);
    const later = endTurn(put(after, (x) => { x.player.ap = 0; }));
    expect(later.threats.filter((t) => t.type === 'mother').length).toBe(1);
  });

  it('cannot be killed by anything aboard', () => {
    const s = spawn(at(clearBoard(fresh()), 'spine_a'), 'mother', 'spine_a');
    const before = s.threats.length;
    const after = structuredClone(s);
    expect(killThreat(after, after.threats[0]!.id)).toBe(false);
    expect(after.threats.length).toBe(before);
    expect(after.stats.threatsKilled).toBe(0);
  });

  it('is held, not stopped, by flooding the vents', () => {
    const s = put(at(spawn(clearBoard(fresh()), 'mother', 'vents'), 'bridge'), (x) => {
      x.ship.power = RULES.powerCap;
    });
    const purged = reduce(s, { t: 'purgeVents' });
    const mother = purged.threats.find((t) => t.type === 'mother');
    expect(mother).toBeDefined();
    expect(mother?.stalled).toBe(RULES.motherPurgeStall);
  });

  it('does not count against the board cap', () => {
    // Otherwise waking her would quietly delete something else aboard.
    const s = spawn(spawn(clearBoard(fresh()), 'mother', 'ore_hold'), 'contact', 'cryobay');
    expect(() => endTurn(put(s, (x) => { x.player.ap = 0; }))).not.toThrow();
  });
});

describe('you see what a person in a corridor would see', () => {
  it('perceives this compartment and the ones next door, and nothing further', () => {
    const s = spawn(spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a'), 'contact', 'comms');
    const seen = perceivedIds(s);
    expect(seen.size).toBe(1);
  });

  it('turns up everything within range on a listen', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'contact', 'spine_c');
    const listened = reduce(s, { t: 'listen' });
    expect(perceivedIds(listened).size).toBe(1);
    expect(listened.stats.listens).toBe(1);
  });
});

describe('the forecast is the promise the game makes', () => {
  it('says where a visible contact will be if the hour ends now', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a', 'cryobay');
    const f = forecast(s);
    const move = f.moves.find((m) => m.from === 'spine_a');
    expect(move?.to).toBe('cryobay');
    expect(move?.reaches).toBe(true);
    expect(move?.perceived).toBe(true);
    expect(f.danger).toBe(true);
  });

  it('never invents information about something you cannot perceive', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'contact', 'comms', 'comms');
    expect(forecast(s).moves.every((m) => !m.perceived)).toBe(true);
    expect(forecast(s).danger).toBe(false);
  });

  it('changes nothing about the state it reads', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'drifter', 'spine_a', 'cryobay');
    const before = JSON.stringify(s);
    forecast(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  /**
   * The property the whole rework turns on: no wound arrives without the
   * forecast having named it the hour before. A hit is a decision, not an event.
   */
  it('names every wound before it lands', () => {
    for (let i = 0; i < 40; i++) {
      let s = fresh('engineer', 2, `fc${i}`);
      let guard = 0;
      while (s.status === 'active' && guard++ < 200) {
        const predicted = forecast(s);
        const woundsBefore = s.stats.wounds;
        const next = endTurn(s);
        const landed = next.stats.wounds - woundsBefore;
        // A wound in the compartment the player was standing in, from something
        // the player could see, must have been in the forecast.
        if (landed > 0 && predicted.moves.some((m) => m.perceived)) {
          expect(predicted.danger || predicted.moves.some((m) => m.reaches)).toBe(true);
        }
        s = put(next, (x) => {
          x.player.ap = 0;
        });
      }
    }
  });

  it('warns about compartments loud enough to draw', () => {
    const s = put(fresh(), (x) => {
      x.ship.noise.cryobay = RULES.noiseThreshold;
    });
    expect(forecast(s).willDraw).toContain('cryobay');
  });
});

describe('the tools that buy you time', () => {
  it('holds everything in a compartment where it stands', () => {
    const s = withHand(
      spawn(at(fresh('security'), 'spine_a'), 'contact', 'spine_a', 'spine_a'),
      ['last_stand'],
    );
    const after = reduce(s, { t: 'play', uid: s.player.hand[0] as string });
    expect(after.threats[0]?.stalled).toBeGreaterThan(0);
  });

  it('pulls everything that can hear it toward the noise instead', () => {
    const s = withHand(spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a', 'cryobay'), [
      'scrap_charge',
    ]);
    const after = reduce(s, { t: 'play', uid: s.player.hand[0] as string, to: 'spine_b' });
    expect(after.threats[0]?.target).toBe('spine_b');
  });

  it('is what a purge is for: every CRAWLER in the ducts at once', () => {
    const s = put(
      at(spawn(spawn(clearBoard(fresh()), 'burrower', 'vents'), 'burrower', 'vents'), 'bridge'),
      (x) => {
        x.ship.power = RULES.powerCap;
      },
    );
    expect(has(s, { t: 'purgeVents' })).toBe(true);
    const after = reduce(s, { t: 'purgeVents' });
    expect(after.threats.length).toBe(0);
    expect(after.stats.threatsKilled).toBe(2);
  });
});

describe('nothing ever leaves the player with no move', () => {
  it('always offers something while the run is active', () => {
    for (let i = 0; i < 25; i++) {
      let s = fresh('surveyor', 3, `zz${i}`);
      let guard = 0;
      while (s.status === 'active' && guard++ < 400) {
        expect(legalActions(s).length).toBeGreaterThan(0);
        s = endTurn(put(s, (x) => { x.player.ap = 0; }));
      }
    }
  });
});
