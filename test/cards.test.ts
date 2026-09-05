import { describe, expect, it } from 'vitest';
import {
  CARDS,
  RULES,
  cardOps,
  infectionCount,
  legalActions,
  reduce,
  roleDeck,
  targetKind,
} from '../src/engine';
import type { Action, Card, GameState, RoleId } from '../src/engine/types';
import { at, clearBoard, fresh, put, spawn, withHand } from './helpers';

const ROLE_IDS: RoleId[] = ['engineer', 'security', 'medic', 'surveyor', 'pilot'];

/** A state where this card can actually be played, whatever it needs pointed at. */
function stage(card: Card): GameState {
  let s = clearBoard(fresh(card.role as RoleId, 1, `card-${card.id}`));
  s = put(s, (x) => {
    x.ship.power = RULES.powerCap;
    x.ship.reactorOutput = 1;
    x.player.ap = RULES.apPerTurn;
  });
  const r = card.requires;
  if (r?.node !== undefined) s = at(s, r.node);
  if (r?.threatHere === true) {
    s = at(s, 'spine_a');
    s = spawn(s, 'contact', 'spine_a', 'spine_a');
  }
  if (r?.unsearched === true) s = at(s, 'spine_a');
  if (cardOps(card).includes('recharge')) {
    s = put(s, (x) => {
      x.player.spent = [x.player.deck.find((u) => !u.startsWith('inf_')) ?? 'x@1'];
    });
  }
  if (cardOps(card).includes('cure')) {
    s = put(s, (x) => {
      x.player.infectionsGained += 1;
      x.player.deck.push(`inf_fever@${1000 + x.player.infectionsGained}`);
    });
  }
  return withHand(s, [card.id]);
}

describe('every card in every deck', () => {
  it('is playable, and does something the state can see', () => {
    for (const card of CARDS) {
      if (card.role === 'infection') continue;
      if (card.role === 'salvage' && card.copies === 0 && !ROLE_IDS.includes(card.role as RoleId)) {
        // Salvage is exercised through search, below.
        continue;
      }
      const s = stage(card);
      const options = legalActions(s).filter(
        (a) => a.t === 'play' && a.uid.startsWith(`${card.id}@`),
      );
      expect(options.length, `${card.id} is never playable`).toBeGreaterThan(0);
      const before = JSON.stringify({ ...s, feed: [], log: [] });
      const after = reduce(s, options[0] as Action);
      expect(JSON.stringify({ ...after, feed: [], log: [] }), `${card.id} changes nothing`).not.toBe(
        before,
      );
      expect(after.feed.length, `${card.id} says nothing`).toBeGreaterThan(s.feed.length);
    }
  });

  it('asks for a target only when the effect needs one', () => {
    for (const card of CARDS) {
      const kind = targetKind(card.effect);
      const ops = cardOps(card);
      const needsTarget =
        ops.includes('move') ||
        ops.includes('sealEdge') ||
        ops.includes('attack') ||
        ops.includes('execute') ||
        ops.includes('pushThreat') ||
        ops.includes('lure') ||
        ops.includes('ventJump') ||
        ops.includes('recharge');
      expect(kind !== null, card.id).toBe(needsTarget);
    }
  });

  it('never lets a role deck contain another role\'s card', () => {
    for (const role of ROLE_IDS) {
      for (const id of roleDeck(role)) {
        expect(CARDS.find((c) => c.id === id)?.role, `${role}/${id}`).toBe(role);
      }
    }
  });
});

describe('what the cards are for', () => {
  it('cures infection out of the kit for good', () => {
    const s = put(withHand(clearBoard(fresh('medic')), ['triage']), (x) => {
      x.player.infectionsGained += 1;
      x.player.deck.push(`inf_fever@1001`);
    });
    expect(infectionCount(s)).toBe(1);
    const after = reduce(s, { t: 'play', uid: s.player.hand[0] as string });
    expect(infectionCount(after)).toBe(0);
    expect(after.stats.cures).toBe(1);
  });

  it('moves silently when it says it moves silently', () => {
    const s = withHand(clearBoard(fresh('surveyor')), ['careful_step']);
    const after = reduce(s, { t: 'play', uid: s.player.hand[0] as string, to: 'spine_a' });
    expect(after.player.node).toBe('spine_a');
    expect(after.ship.noise.spine_a).toBe(0);
  });

  it('drops a bulkhead that everything but a CRAWLER has to walk around', () => {
    const s = withHand(at(clearBoard(fresh('surveyor')), 'spine_a'), ['wedge']);
    const after = reduce(s, {
      t: 'play',
      uid: s.player.hand[0] as string,
      edge: ['spine_a', 'spine_b'],
    });
    expect(after.ship.sealedEdges.length).toBe(1);
  });

  it('empties a weapon on a miss and the armory fills it again', () => {
    const s = put(spawn(at(clearBoard(fresh('security')), 'spine_a'), 'drifter', 'spine_a'), (x) => {
      // A guaranteed miss: a d6 cannot beat 3 hp at −6.
      x.player.combatPenalty = -6;
    });
    const armed = withHand(s, ['sidearm']);
    const uid = armed.player.hand[0] as string;
    const missed = reduce(armed, { t: 'play', uid, threat: armed.threats[0]!.id });
    expect(missed.player.spent).toContain(uid);
    const armory = put(at(missed, 'armory'), (x) => {
      x.ship.power = RULES.powerCap;
      x.player.ap = RULES.apPerTurn;
    });
    expect(reduce(armory, { t: 'recharge', target: uid }).player.spent).not.toContain(uid);
  });
});

describe('salvage', () => {
  it('puts found gear in the kit rather than firing it where you stand', () => {
    const s = put(at(clearBoard(fresh()), 'spine_a'), (x) => {
      x.ship.salvage.spine_a = ['salv_sidearm#4'];
    });
    const after = reduce(s, { t: 'search' });
    expect(after.player.discard.some((u) => u.startsWith('salv_sidearm@'))).toBe(true);
  });

  it('resolves the rest of it where it is found', () => {
    const s = put(at(clearBoard(fresh()), 'spine_a'), (x) => {
      x.ship.salvage.spine_a = ['salv_cell#0'];
      x.ship.power = 0;
    });
    expect(reduce(s, { t: 'search' }).ship.power).toBe(3);
  });

  it('makes the corpse cost you what its text says it costs', () => {
    const s = put(at(clearBoard(fresh()), 'spine_a'), (x) => {
      x.ship.salvage.spine_a = ['salv_corpse#6'];
    });
    const after = reduce(s, { t: 'search' });
    expect(after.ship.power).toBe(4);
    expect(infectionCount(after)).toBe(1);
  });
});
