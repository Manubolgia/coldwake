import { describe, expect, it } from 'vitest';
import {
  InvariantError,
  RULES,
  actionCost,
  actionKey,
  assertInvariants,
  boardCap,
  consequence,
  describe as describeAction,
  legalActions,
  listenCost,
  reduce,
  shuttleRequirement,
  targetKind,
} from '../src/engine';
import { bagDraw, tokensInBag, tokensInReserve } from '../src/engine/noise';
import type { Action, GameState } from '../src/engine/types';
import { at, clearBoard, endTurn, fresh, handOnly, put, setTokens, spawn, withHand } from './helpers';

/** One state per action type, so the cost and label paths are all exercised. */
function everyActionType(): { state: GameState; action: Action }[] {
  const base = put(fresh('security'), (s) => {
    s.ship.power = RULES.powerCap;
    s.player.infectionsGained += 1;
    s.player.deck.push('inf_fever@1001');
  });
  const spine = at(base, 'spine_b');
  const withThreat = spawn(at(base, 'spine_a'), 'contact', 'spine_a', 'spine_a');
  const shuttle = put(at(base, 'shuttle_bay'), (s) => {
    s.ship.shuttleCharge = shuttleRequirement('security', 1);
  });
  const vents = reduce(at(base, 'medbay'), { t: 'ventEnter' });
  const armory = put(at(base, 'armory'), (s) => {
    s.player.spent = [s.player.deck.find((u) => u.startsWith('sidearm@')) ?? 'x@1'];
  });
  const specimen = reduce(at(base, 'ore_hold'), { t: 'takeSpecimen' });
  const suppress = withHand(base, ['suppress']);
  return [
    { state: base, action: { t: 'move', to: 'spine_a' } },
    { state: base, action: { t: 'creep', to: 'spine_a' } },
    { state: base, action: { t: 'listen' } },
    { state: base, action: { t: 'search' } },
    { state: base, action: { t: 'brace' } },
    { state: base, action: { t: 'discard', uid: base.player.hand[0] as string } },
    { state: suppress, action: { t: 'play', uid: suppress.player.hand[0] as string } },
    { state: at(base, 'medbay'), action: { t: 'ventEnter' } },
    { state: vents, action: { t: 'ventExit', to: 'bridge' } },
    { state: at(base, 'reactor'), action: { t: 'repair' } },
    { state: spine, action: { t: 'seal', edge: ['spine_b', 'reactor'] } },
    { state: at(base, 'bridge'), action: { t: 'purgeVents' } },
    { state: at(base, 'medbay'), action: { t: 'cure' } },
    { state: armory, action: { t: 'recharge', target: armory.player.spent[0] as string } },
    { state: at(base, 'shuttle_bay'), action: { t: 'chargeShuttle', n: 3 } },
    { state: at(base, 'comms'), action: { t: 'beacon' } },
    { state: at(base, 'ore_hold'), action: { t: 'takeSpecimen' } },
    { state: at(specimen, 'comms'), action: { t: 'upload' } },
    { state: at(base, 'bridge'), action: { t: 'armScuttle' } },
    { state: shuttle, action: { t: 'launch' } },
    { state: withThreat, action: { t: 'endTurn' } },
    { state: handOnly(base, ['bypass']), action: { t: 'burn', uid: 'bypass@1' } },
  ];
}

describe('the action surface the interface consumes', () => {
  it('prices and labels every action type', () => {
    for (const { state, action } of everyActionType()) {
      const cost = actionCost(state, action);
      expect(cost.ap, action.t).toBeGreaterThanOrEqual(0);
      expect(cost.power, action.t).toBeGreaterThanOrEqual(0);
      expect(cost.noise, action.t).toBeGreaterThanOrEqual(0);
      expect(describeAction(action).length, action.t).toBeGreaterThan(0);
      expect(actionKey(action).length, action.t).toBeGreaterThan(0);
    }
  });

  /**
   * Every rule the player must reason about gets a number on screen. The old
   * game left the seal duration, the fuse length and the carrier threshold in
   * prose, and the manual was where a player went to find them.
   */
  it('states the consequence of every action that has one the cost line cannot carry', () => {
    const carries: Action['t'][] = [
      'move',
      'creep',
      'listen',
      'brace',
      'seal',
      'purgeVents',
      'cure',
      'beacon',
      'takeSpecimen',
      'upload',
      'armScuttle',
      'launch',
    ];
    for (const { state, action } of everyActionType()) {
      if (!carries.includes(action.t)) continue;
      const line = consequence(state, action);
      expect(line, action.t).not.toBe(null);
      expect((line ?? '').length, action.t).toBeGreaterThan(20);
    }
  });

  it('adds the infection surcharge to the noise it discloses', () => {
    const sweaty = put(fresh(), (s) => {
      s.player.infectionsGained += 1;
      s.player.hand.push('inf_sweat@1001');
    });
    expect(actionCost(sweaty, { t: 'move', to: 'spine_a' }).noise).toBe(
      (RULES.basicActions.move?.noise ?? 3) + 1,
    );
    const tunnelled = put(fresh(), (s) => {
      s.player.infectionsGained += 1;
      s.player.hand.push('inf_tunnel@1001');
    });
    expect(listenCost(tunnelled)).toBe((RULES.basicActions.listen?.ap ?? 1) + 1);
  });

  it('names the target every card needs', () => {
    expect(targetKind({ op: 'move', silent: true })).toBe('node');
    expect(targetKind({ op: 'sealEdge', turns: 3, anywhere: true })).toBe('edge');
    expect(targetKind({ op: 'sealEdge', turns: 3, anywhere: false })).toBe('edgeHere');
    expect(targetKind({ op: 'attack', bonus: 1 })).toBe('threat');
    expect(targetKind({ op: 'lure', n: 3 })).toBe('anyNode');
    expect(targetKind({ op: 'addNoise', scope: 'target', n: 3 })).toBe('anyNode');
    expect(targetKind({ op: 'addNoise', scope: 'here', n: 3 })).toBe(null);
    expect(targetKind({ op: 'ventJump' })).toBe('vent');
    expect(targetKind({ op: 'recharge' })).toBe('spent');
    expect(
      targetKind({ op: 'sequence', steps: [{ op: 'draw', n: 1 }, { op: 'move', silent: true }] }),
    ).toBe('node');
    expect(targetKind({ op: 'gainPower', n: 1 })).toBe(null);
  });

  it('enumerates only affordable actions', () => {
    const broke = put(fresh(), (s) => {
      s.player.ap = 0;
      s.ship.power = 0;
      s.player.freeCardUsed = true;
    });
    for (const a of legalActions(broke)) {
      expect(actionCost(broke, a).ap, a.t).toBeLessThanOrEqual(0);
    }
  });

  it('offers the free card slot even with no time left', () => {
    const broke = put(fresh(), (s) => {
      s.player.ap = 0;
      s.ship.power = 0;
    });
    expect(legalActions(broke).some((a) => a.t === 'discard')).toBe(true);
  });
});

describe('invariants catch tampering', () => {
  it('rejects a state that loses a token', () => {
    expect(() =>
      assertInvariants(
        put(fresh(), (s) => {
          s.bag.contact -= 1;
        }),
      ),
    ).toThrow(InvariantError);
  });

  it('rejects a state that loses a card', () => {
    expect(() =>
      assertInvariants(
        put(fresh(), (s) => {
          s.player.deck.pop();
        }),
      ),
    ).toThrow(InvariantError);
  });

  it('rejects a board over its cap', () => {
    let s = clearBoard(fresh('engineer', 1));
    for (let i = 0; i < boardCap(1) + 1; i++) s = spawn(s, 'contact', 'cryobay');
    expect(() => assertInvariants(s)).toThrow(InvariantError);
  });

  it('rejects out-of-bounds power and noise, and threats off the map', () => {
    expect(() =>
      assertInvariants(
        put(fresh(), (s) => {
          s.ship.power = RULES.powerCap + 5;
        }),
      ),
    ).toThrow();
    expect(() =>
      assertInvariants(
        put(fresh(), (s) => {
          s.ship.noise.spine_a = RULES.noiseMax + 1;
        }),
      ),
    ).toThrow();
    expect(() =>
      assertInvariants(
        put(clearBoard(fresh()), (s) => {
          s.threats.push({
            id: 'q',
            type: 'contact',
            node: 'nowhere',
            hp: 2,
            target: null,
            stance: 'wandering',
            cold: 0,
            stalled: 0,
            seenNode: null,
            seenTurn: -1,
          });
          s.bag.contact -= 1;
        }),
      ),
    ).toThrow();
  });
});

describe('the bag under pressure', () => {
  it('escalates instead of spawning when the board is full', () => {
    let s = clearBoard(fresh('engineer', 1));
    for (let i = 0; i < boardCap(1); i++) s = spawn(s, 'contact', 'cryobay');
    const drawn = structuredClone(s);
    expect(bagDraw(drawn, 'spine_a')).toBe('capped');
    expect(drawn.threats.filter((t) => t.type !== 'mother').length).toBe(boardCap(1));
  });

  it('wakes the hold when there is nothing left to promote', () => {
    let s = clearBoard(fresh('engineer', 1));
    for (let i = 0; i < boardCap(1); i++) s = spawn(s, 'drifter', 'cryobay');
    const drawn = structuredClone(s);
    const before = drawn.ship.hive;
    bagDraw(drawn, 'spine_a');
    expect(drawn.ship.hive).toBeGreaterThan(before);
  });

  it('drafts out of the reserve when the bag runs dry', () => {
    const empty = setTokens(clearBoard(fresh()), {}, { contact: 18 });
    const drawn = structuredClone(empty);
    bagDraw(drawn, 'spine_a');
    expect(tokensInBag(drawn) + tokensInReserve(drawn)).toBeLessThanOrEqual(18);
  });

  it('draws when a compartment gets loud enough, over a long run', () => {
    let s = at(fresh(), 'ore_hold');
    for (let i = 0; i < 6 && s.status === 'active'; i++) s = endTurn(s);
    expect(s.stats.bagDraws).toBeGreaterThan(0);
  });
});
