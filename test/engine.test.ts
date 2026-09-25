import { describe, expect, it } from 'vitest';
import { getActions } from '../src/game/actions';
import { EXITS } from '../src/game/content/exits';
import { begin, newGame, reduce } from '../src/game/engine';
import { ROOM_COUNT } from '../src/game/generate';
import { distances } from '../src/game/map';
import { bandOf } from '../src/game/rules';
import type { GameState, RoleId } from '../src/game/types';

const fresh = (seed = 'T1', role: RoleId = 'engineer') => begin(newGame({ seed, role, difficulty: 'standard' }));

function clearCards(s: GameState): GameState {
  let g = s;
  while (g.cards.length) g = reduce(g, g.cards[0]!.choices.length ? { type: 'choose', index: 0 } : { type: 'continue' });
  return g;
}

describe('bands', () => {
  it('6+ is clean, 4–5 cost, 3 or less fail', () => {
    expect(bandOf(6)).toBe('clean');
    expect(bandOf(9)).toBe('clean');
    expect(bandOf(5)).toBe('cost');
    expect(bandOf(4)).toBe('cost');
    expect(bandOf(3)).toBe('fail');
    expect(bandOf(5, 5)).toBe('clean');
  });
});

describe('generation', () => {
  it('is deterministic for a seed', () => {
    expect(JSON.stringify(fresh('ABC'))).toBe(JSON.stringify(fresh('ABC')));
    expect(JSON.stringify(fresh('ABC'))).not.toBe(JSON.stringify(fresh('ABD')));
  });

  it('builds a connected ship with every room its exits need', () => {
    for (let i = 0; i < 300; i++) {
      const s = newGame({ seed: `gen-${i}`, role: 'medic', difficulty: 'standard' });
      const ids = Object.keys(s.rooms);
      expect(ids).toHaveLength(ROOM_COUNT);
      const d = distances(s, s.player.room);
      for (const id of ids) expect(d[id], `room ${id} unreachable in gen-${i}`).toBeDefined();
      const types = new Set(Object.values(s.rooms).map((r) => r.type));
      expect(types.has('cryo')).toBe(true);
      expect(types.has('nest')).toBe(true);
      expect(types.has('medbay')).toBe(true);
      for (const e of s.scenario.exits) for (const st of EXITS[e].steps) expect(types.has(st.room), `${e} needs ${st.room}`).toBe(true);
      expect(s.scenario.exits).toHaveLength(2);
      expect(new Set(s.scenario.exits).size).toBe(2);
    }
  });

  it('starts with an intro card and three dice', () => {
    const s = fresh();
    expect(s.cards[0]?.kind).toBe('intro');
    expect(s.dice).toHaveLength(3);
    expect(getActions(s)).toHaveLength(0);
  });
});

describe('reduce', () => {
  it('never mutates its input', () => {
    const s = clearCards(fresh('MUT'));
    const before = JSON.stringify(s);
    const o = getActions(s)[0]!;
    reduce(s, { type: 'act', id: o.id, target: o.target, die: s.dice[0]!.id });
    reduce(s, { type: 'endRound' });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('spends the die it is given and rejects a spent one', () => {
    const s = clearCards(fresh('DIE'));
    const o = getActions(s).find((x) => x.id === 'move')!;
    const n = reduce(s, { type: 'act', id: o.id, target: o.target, die: 0 });
    expect(n.dice[0]!.used).toBe(true);
    const again = clearCards(n);
    const o2 = getActions(again).find((x) => !x.disabled && x.id !== 'take');
    if (o2) expect(reduce(again, { type: 'act', id: o2.id, target: o2.target, die: 0 })).toBe(again);
  });

  it('shows the same outcome it then applies to a move', () => {
    const s = clearCards(fresh('MOVE'));
    const o = getActions(s).find((x) => x.id === 'move')!;
    const die = s.dice[0]!;
    const out = o.outcomes[die.id]!;
    const n = reduce(s, { type: 'act', id: o.id, target: o.target, die: die.id });
    expect(n.player.room).toBe(o.target);
    const noise = n.noise - s.noise;
    expect(noise).toBe(out.band === 'clean' ? 0 : out.band === 'cost' ? 1 : 2);
  });

  it('ends the round: clock ticks, new dice, round advances', () => {
    const s = clearCards(fresh('END'));
    const n = reduce(s, { type: 'endRound' });
    expect(n.round).toBe(2);
    expect(n.clock).toBe(s.clock - 1);
    expect(n.dice.every((d) => !d.used)).toBe(true);
    expect(n.noise).toBe(0);
  });

  it('blocks acting while a story card is up', () => {
    const s = fresh('CARD');
    expect(reduce(s, { type: 'endRound' })).toBe(s);
  });

  it('runs out the clock into an ending', () => {
    let s = clearCards(fresh('CLOCK'));
    for (let i = 0; i < 40 && s.status === 'playing'; i++) {
      s = clearCards(reduce(s, { type: 'endRound' }));
    }
    expect(s.status).not.toBe('playing');
    expect(s.ending?.title).toBeTruthy();
  });
});
