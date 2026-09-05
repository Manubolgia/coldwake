import { describe, expect, it } from 'vitest';
import narration from '../src/content/narration.json';
import guidance from '../src/content/guidance.json';
import {
  CARDS,
  OBJECTIVES,
  RULES,
  contactLine,
  endingReport,
  initialState,
  legalActions,
  reduce,
  setInvariantChecking,
  sweepReport,
  threatDef,
} from '../src/engine';
import type { Ending, GameState, Objective } from '../src/engine/types';
import { at, fresh, put, spawn } from './helpers';

setInvariantChecking(false);

/**
 * The ship does not know it is a board game. It also never mentions a blank:
 * a blank is a weight in a spawn urn, it has no referent aboard a ship, and
 * "of what is still unaccounted for aboard, 5 are nothing at all" was the
 * single worst line in the old game.
 */
const FORBIDDEN = [
  /\bbag\b/i,
  /\btoken\b/i,
  /\bcard\b/i,
  // "deck plate" is a floor; "your deck" is a board game.
  /\bdeck\b(?! plate)/i,
  /\bturn\b/i,
  /\bblank\b/i,
  /\bunaccounted\b/i,
  /\bAP\b/,
  /\bnode\b/i,
  /\bdraw pile\b/i,
];

function offend(text: string): RegExp | null {
  for (const r of FORBIDDEN) if (r.test(text)) return r;
  return null;
}

describe('the ship never breaks character', () => {
  it('keeps board-game vocabulary out of every narration pool', () => {
    for (const [pool, lines] of Object.entries(narration as Record<string, string[]>)) {
      for (const line of lines) {
        expect(offend(line), `${pool}: ${line}`).toBe(null);
      }
    }
  });

  it('never says blank or unaccounted for anywhere a player can read it', () => {
    const surfaces: string[] = [
      ...Object.values(narration as Record<string, string[]>).flat(),
      ...(guidance.advisories as { text: string }[]).map((a) => a.text),
      ...CARDS.map((c) => c.text),
      ...Object.values(RULES.endings).flatMap((e) => [e.verdict, e.how]),
      ...Object.values(RULES.objectives).flatMap((o) => [o.line, o.how]),
    ];
    for (const s of surfaces) {
      expect(/\bblank\b/i.test(s), s).toBe(false);
      expect(/\bunaccounted\b/i.test(s), s).toBe(false);
    }
  });

  it('keeps it out of everything the ship says during a run', () => {
    for (let i = 0; i < 12; i++) {
      let s: GameState = initialState(`voice${i}`, 'engineer', 2, 'run');
      let guard = 0;
      while (s.status === 'active' && guard++ < 120) {
        const legal = legalActions(s);
        s = reduce(s, legal[guard % legal.length] as never);
      }
      for (const line of s.feed) {
        // Card names are proper nouns and are allowed; the words are not.
        const text = line.text.replace(/[A-Z][A-Z' -]{2,}/g, '');
        expect(offend(text), text).toBe(null);
      }
    }
  });
});

describe('a listen answers the question a person would ask', () => {
  it('says what it is, where it is, how far off and whether it is coming', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'drifter', 'spine_b', 'cryobay');
    const report = sweepReport(s, s.threats, RULES.listenRange);
    expect(report).toContain('HUNTER');
    expect(report).toContain('SPINE-B');
    expect(report).toMatch(/compartments off|one compartment away/);
    expect(report).toContain('coming straight here');
  });

  it('says so in one clause when there is nothing within earshot', () => {
    const report = sweepReport(fresh(), [], RULES.listenRange);
    expect(report.length).toBeLessThan(200);
    expect(report).not.toContain(';');
  });

  it('never counts anything that is not a creature', () => {
    const s = spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a', 'spine_a');
    const report = sweepReport(s, s.threats, RULES.listenRange);
    expect(/\d+ (are|is) nothing/.test(report)).toBe(false);
  });

  it('describes what each contact is doing, not just where it stands', () => {
    const hunting = spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a', 'cryobay');
    const wandering = spawn(at(fresh(), 'cryobay'), 'contact', 'spine_a', null);
    expect(contactLine(hunting, hunting.threats[0]!, 'cryobay')).toContain('coming straight here');
    expect(contactLine(wandering, wandering.threats[0]!, 'cryobay')).toContain('nothing to follow');
  });
});

describe('every ending says why it happened', () => {
  it('names the rule that fired, on this run\'s numbers, for all seven', () => {
    const endings: Ending[] = [
      'escaped',
      'carrier',
      'overload',
      'relay',
      'specimen',
      'killed',
      'adrift',
    ];
    for (const e of endings) {
      const s = put(fresh('engineer', 2, 'why', 'run'), (x) => {
        x.status = e;
        x.result = {
          ending: e,
          objective: 'run',
          declared: false,
          score: 100,
          turn: 11,
          infection: 3,
          cause: e === 'killed' ? 'attrition' : e === 'adrift' ? 'timeout' : 'objective',
        };
      });
      const r = endingReport(s);
      expect(r.verdict.length, e).toBeGreaterThan(20);
      expect(r.why.length, e).toBeGreaterThan(20);
      expect(r.instead.length, e).toBeGreaterThan(20);
      expect(offend(r.why.replace(/[A-Z][A-Z' -]{2,}/g, '')), `${e}: ${r.why}`).toBe(null);
    }
  });

  it('tells a losing run which of the other three routes were still open', () => {
    const s = put(fresh(), (x) => {
      x.status = 'adrift';
      x.result = {
        ending: 'adrift',
        objective: 'run',
        declared: false,
        score: 20,
        turn: 18,
        infection: 2,
        cause: 'timeout',
      };
    });
    const r = endingReport(s);
    expect(r.instead).toMatch(/overload/i);
    expect(r.instead).toMatch(/relay/i);
    expect(r.instead).toMatch(/specimen/i);
  });
});

describe('the run opens by saying what it is for', () => {
  it('prints the declared objective and exactly what it takes', () => {
    for (const o of OBJECTIVES) {
      const s = initialState('brief', 'engineer', 2, o as Objective);
      const opening = s.feed.map((l) => l.text).join('\n');
      expect(opening).toContain(RULES.objectives[o].name);
      // And says the other three are still winnable.
      expect(opening).toMatch(/other three/);
    }
  });
});

describe('every action tells you what happened', () => {
  it('reports a result for each thing the player can do', () => {
    let s = initialState('says', 'security', 1, 'run');
    const seen = new Set<string>();
    let guard = 0;
    while (s.status === 'active' && guard++ < 400) {
      const legal = legalActions(s);
      const pick = legal[guard % legal.length]!;
      const before = s.feed.length;
      const next = reduce(s, pick);
      if (pick.t !== 'endTurn') {
        expect(next.feed.length, pick.t).toBeGreaterThan(before);
      }
      seen.add(pick.t);
      s = next;
    }
    expect(seen.size).toBeGreaterThan(6);
  });

  it('names what a wound took from you', () => {
    const s = spawn(at(fresh(), 'spine_a'), 'contact', 'spine_a', 'spine_a');
    const hit = reduce(s, { t: 'endTurn' });
    const burn = legalActions(hit)[0]!;
    const paid = reduce(hit, burn);
    const text = paid.feed.map((l) => l.text).join('\n');
    expect(text).toContain('you cannot do that any more');
  });

  it('says the MOTHER cannot be killed at the moment you try', () => {
    const s = spawn(at(fresh('security'), 'spine_a'), 'mother', 'spine_a');
    const armed = put(s, (x) => {
      const uid = [...x.player.deck, ...x.player.discard, ...x.player.hand].find((u) =>
        u.startsWith('suppress@'),
      );
      x.player.deck = x.player.deck.filter((u) => u !== uid);
      x.player.discard = x.player.discard.filter((u) => u !== uid);
      x.player.hand = [uid as string];
    });
    const swung = reduce(armed, {
      t: 'play',
      uid: armed.player.hand[0] as string,
      threat: armed.threats[0]!.id,
    });
    expect(swung.feed.map((l) => l.text).join('\n')).toContain('Nothing aboard kills a MOTHER');
    expect(swung.threats.length).toBe(1);
  });

  it('gives every creature a listen line that matches its own name', () => {
    for (const t of ['contact', 'drifter', 'burrower'] as const) {
      const s = spawn(at(fresh(), 'cryobay'), t, 'spine_a', 'cryobay');
      expect(sweepReport(s, s.threats, 3)).toContain(threatDef(t).name);
    }
  });
});
