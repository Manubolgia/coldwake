import { describe, expect, it } from 'vitest';
import { CARDS, RULES, VENT_NODES, reduce, targetKind } from '../src/engine';
import type { Card, GameState, RoleId } from '../src/engine/types';
import { at, fresh, put, spawn, withHand } from './helpers';

/** Build a position in which the card under test is legal to play. */
function stage(c: Card): GameState {
  const role = c.role as RoleId;
  let s = fresh(role);
  s = put(s, (x) => {
    x.ship.power = RULES.powerCap;
    x.player.spent = [];
  });
  const requiredNode = c.requires?.node;
  if (requiredNode !== undefined) s = at(s, requiredNode);
  else if (c.requires?.ventAccess === true) s = at(s, 'medbay');
  else s = at(s, 'spine_b');
  if (c.requires?.threatHere === true || targetKind(c.effect) === 'threat') {
    s = spawn(s, 'contact', s.player.node);
  }
  if (targetKind(c.effect) === 'spent') {
    s = put(s, (x) => {
      const pool = [...x.player.hand, ...x.player.deck, ...x.player.discard];
      const weapon = pool.find((u) =>
        ['cutting_torch@', 'scalpel@', 'sidearm@', 'service_pistol@', 'cutting_bar@'].some((w) =>
          u.startsWith(w),
        ),
      );
      if (weapon) x.player.spent.push(weapon);
    });
  }
  if (c.effect.op === 'removePanic' || (c.effect.op === 'sequence' && c.id === 'triage')) {
    s = put(s, (x) => {
      x.player.panicsGained += 1;
      x.player.deck.push('panic_shaking@1001');
    });
  }
  return withHand(s, [c.id]);
}

function targetsFor(s: GameState, c: Card): Partial<{ to: string; edge: [string, string]; threat: string; target: string }> {
  switch (targetKind(c.effect)) {
    case 'node': {
      const to = s.player.node === 'spine_b' ? 'spine_c' : 'spine_a';
      return { to };
    }
    case 'other':
      return { to: 'comms' };
    case 'vent':
      return { to: VENT_NODES.find((v) => v !== s.player.node) as string };
    case 'edge':
      return { edge: ['spine_b', 'reactor'] };
    case 'edgeHere':
      return { edge: [s.player.node as string, s.player.node === 'spine_b' ? 'reactor' : 'spine_b'] };
    case 'threat':
      return { threat: s.threats.find((t) => t.node === s.player.node)?.id as string };
    case 'spent':
      return { target: s.player.spent[0] as string };
    default:
      return {};
  }
}

const roleCards = CARDS.filter((c) => !['panic', 'salvage'].includes(c.role));

describe('every card is playable and does something (gate 1.11)', () => {
  for (const c of roleCards) {
    it(`${c.role}: ${c.name}`, () => {
      const before = stage(c);
      const after = reduce(before, { t: 'play', uid: before.player.hand[0] as string, ...targetsFor(before, c) });
      const op = c.effect.op === 'sequence' ? c.effect.steps[0]?.op : c.effect.op;
      if (op !== 'gainAp') expect(after.player.ap).toBe(before.player.ap - c.ap);
      expect(after.player.hand).not.toContain(before.player.hand[0]);
      if (c.burn) expect(after.player.burned.length).toBeGreaterThan(before.player.burned.length);

      switch (op) {
        case 'gainPower':
          expect(after.ship.power).toBeGreaterThanOrEqual(before.ship.power);
          break;
        case 'gainAp':
          expect(after.player.ap).toBeGreaterThan(before.player.ap - c.ap);
          break;
        case 'move':
          expect(after.player.node).not.toBe(before.player.node);
          break;
        case 'draw':
          expect(after.player.deck.length + after.player.hand.length).toBeGreaterThan(0);
          break;
        case 'attack':
        case 'execute':
          // Either the threat is dead or the weapon is spent. Never neither.
          expect(
            after.threats.length < before.threats.length ||
              after.player.spent.length > before.player.spent.length,
          ).toBe(true);
          break;
        case 'pushThreat':
          expect(after.threats[0]?.node).not.toBe(before.player.node);
          break;
        case 'sealEdge':
          expect(after.ship.sealedEdges.length).toBe(1);
          break;
        case 'setNoise':
          expect(Object.values(after.ship.noise).every((n) => n <= 3)).toBe(true);
          break;
        case 'addNoise':
          expect(Object.values(after.ship.noise).reduce((a, b) => a + b, 0)).toBeGreaterThan(
            Object.values(before.ship.noise).reduce((a, b) => a + b, 0),
          );
          break;
        case 'preventWound':
          expect(after.player.wardsThisTurn).toBe(1);
          break;
        case 'reactorOutput':
          expect(after.ship.reactorOutput).toBeGreaterThanOrEqual(before.ship.reactorOutput);
          break;
        case 'recharge':
          expect(after.player.spent.length).toBe(before.player.spent.length - 1);
          break;
        case 'removePanic':
          expect(after.player.panicsGained).toBe(before.player.panicsGained);
          expect(
            [...after.player.deck, ...after.player.hand, ...after.player.discard].filter((u) =>
              u.startsWith('panic_'),
            ).length,
          ).toBeLessThan(
            [...before.player.deck, ...before.player.hand, ...before.player.discard].filter((u) =>
              u.startsWith('panic_'),
            ).length,
          );
          break;
        case 'revealCarry':
          expect(after.player.carry.some((x) => x.revealed)).toBe(true);
          break;
        case 'discardCarry':
          expect(after.player.carry.length).toBeLessThan(before.player.carry.length);
          break;
        case 'chargeShuttle':
          expect(after.ship.shuttleCharge).toBeGreaterThan(before.ship.shuttleCharge);
          break;
        case 'ventEnter':
          expect(after.player.node).toBe('vents');
          break;
        case 'ventJump':
          expect(VENT_NODES).toContain(after.player.node);
          break;
        case 'search':
          expect(after.ship.searched.length).toBeGreaterThan(before.ship.searched.length);
          break;
        case 'listen':
          expect(after.bagKnownTurn).toBe(after.turn);
          break;
        default:
          break;
      }
    });
  }
});

describe('panic cards (§5.3)', () => {
  it('cannot be played, only discarded for 1 AP', () => {
    const s = put(fresh(), (x) => {
      x.player.panicsGained += 1;
      x.player.hand.push('panic_tunnel@1001');
    });
    const uid = 'panic_tunnel@1001';
    expect(() => reduce(s, { t: 'play', uid })).toThrow();
    const discarded = reduce(s, { t: 'discard', uid });
    expect(discarded.player.ap).toBe(s.player.ap - 1);
  });

  it('makes listening cost more while TUNNEL VISION is held', () => {
    const s = put(fresh(), (x) => {
      x.player.panicsGained += 1;
      x.player.hand.push('panic_tunnel@1001');
      x.player.ap = 1;
    });
    expect(s.player.hand).toContain('panic_tunnel@1001');
    expect(() => reduce(s, { t: 'listen' })).toThrow();
  });

  it('makes every action louder while COLD SWEAT is held', () => {
    const s = put(fresh(), (x) => {
      x.player.panicsGained += 1;
      x.player.hand.push('panic_sweat@1001');
    });
    const moved = reduce(s, { t: 'move', to: 'spine_a' });
    expect(moved.ship.noise.cryobay).toBe((RULES.basicActions.move?.noise ?? 2) + 1);
  });
});
