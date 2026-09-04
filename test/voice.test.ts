import { describe, expect, it } from 'vitest';
import { CARDS, SALVAGE, initialState, legalActions, reduce, roleDeck } from '../src/engine';
import { sweepReport } from '../src/engine/voice';
import guidanceJson from '../src/content/guidance.json';
import rolesJson from '../src/content/roles.json';
import type { Action, Depth, GameState, RoleId } from '../src/engine/types';
import { at, endTurn, fresh, put, spawn } from './helpers';

/**
 * The fiction does not know it is a board game. Anything the player can read —
 * card text, salvage logs, role blurbs, advisories, and every line the ship
 * says during a run — is checked against the vocabulary that would give it away.
 */
const FORBIDDEN =
  /\b(cards?|decks?|tokens?|bag|nodes?|turns?|AP|hit ?points?|dice|d6|no roll|tiles?|discard|shuffle|draw pile)\b/i;

function playerFacingStrings(): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [];
  for (const c of CARDS) out.push({ where: `card ${c.id}`, text: c.text }, { where: `name ${c.id}`, text: c.name });
  for (const s of SALVAGE.deck) if (s.log) out.push({ where: `log ${s.card}`, text: s.log });
  for (const a of guidanceJson.advisories) out.push({ where: `advisory ${a.id}`, text: a.text });
  for (const r of rolesJson.roles) {
    out.push({ where: `role ${r.id}`, text: r.strength }, { where: `role ${r.id}`, text: r.weakness });
  }
  return out;
}

describe('the ship never breaks character', () => {
  it('keeps board-game vocabulary out of every written string', () => {
    const offenders = playerFacingStrings().filter((s) => FORBIDDEN.test(s.text));
    expect(offenders.map((o) => `${o.where}: ${o.text}`)).toEqual([]);
  });

  it('keeps it out of everything the ship says during a run', () => {
    const seen = new Set<string>();
    for (const depth of [1, 3, 5] as Depth[]) {
      for (const role of ['engineer', 'security', 'medic', 'surveyor', 'pilot'] as RoleId[]) {
        let s = initialState(`voice-${role}-${depth}`, role, depth);
        let step = 0;
        while (s.status === 'active' && step < 400) {
          const legal = legalActions(s);
          s = reduce(s, legal[(step * 7) % legal.length] as Action);
          step += 1;
        }
        for (const line of s.feed) seen.add(line.text);
      }
    }
    const offenders = [...seen].filter((t) => FORBIDDEN.test(t));
    expect(offenders).toEqual([]);
    expect(seen.size).toBeGreaterThan(30);
  });
});

describe('every action tells you what happened', () => {
  it('reports a result for each thing the player can do', () => {
    const base = put(fresh('security'), (s) => {
      s.ship.power = 10;
    });
    const cases: { label: string; state: GameState; action: Action }[] = [
      { label: 'move', state: base, action: { t: 'move', to: 'spine_a' } },
      { label: 'creep', state: base, action: { t: 'creep', to: 'spine_a' } },
      { label: 'listen', state: base, action: { t: 'listen' } },
      { label: 'search', state: base, action: { t: 'search' } },
      { label: 'discard', state: base, action: { t: 'discard', uid: base.player.hand[0] as string } },
      { label: 'repair', state: put(at(base, 'reactor'), (s) => (s.ship.reactorOutput = 0)), action: { t: 'repair' } },
      { label: 'seal', state: at(base, 'spine_b'), action: { t: 'seal', edge: ['spine_b', 'reactor'] } },
      { label: 'purgeVents', state: at(base, 'bridge'), action: { t: 'purgeVents' } },
      { label: 'carryScan', state: at(base, 'medbay'), action: { t: 'carryScan', index: 0 } },
      { label: 'purgeBlood', state: at(base, 'medbay'), action: { t: 'purgeBlood', index: 0 } },
      { label: 'chargeShuttle', state: at(base, 'shuttle_bay'), action: { t: 'chargeShuttle', n: 3 } },
      { label: 'beacon', state: at(base, 'comms'), action: { t: 'beacon' } },
      { label: 'ventEnter', state: at(base, 'medbay'), action: { t: 'ventEnter' } },
    ];
    for (const c of cases) {
      const after = reduce(c.state, c.action);
      expect(after.feed.length, `${c.label} said nothing`).toBeGreaterThan(c.state.feed.length);
      const said = after.feed.slice(c.state.feed.length).map((l) => l.text).join(' ');
      expect(said.length, `${c.label} said nothing legible`).toBeGreaterThan(8);
    }
  });

  it('reports what a listen actually heard, not that you listened', () => {
    const s = fresh();
    const heard = reduce(s, { t: 'listen' }).feed.at(-1)?.text ?? '';
    expect(heard).toContain('SWEEP');
    expect(heard).toMatch(/NOTHING|MOVING|HEAVY|WALLS|SINGING/);
    expect(sweepReport(s)).toBe(heard);
  });

  it('names what a wound took from you', () => {
    let s = spawn(at(fresh(), 'spine_a'), 'drifter', 'spine_a');
    s = put(s, (x) => {
      x.ship.noise.spine_a = 3;
    });
    s = endTurn(s);
    const said = s.feed.map((l) => l.text).join(' ');
    expect(said).toMatch(/CANNOT DO THAT ANY MORE|NOTHING LEFT TO GIVE/);
    expect(roleDeck('engineer').length).toBe(12);
  });
});
