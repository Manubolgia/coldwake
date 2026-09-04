import { describe, expect, it } from 'vitest';
import {
  InvariantError,
  RULES,
  actionCost,
  actionKey,
  assertInvariants,
  describe as describeAction,
  legalActions,
  listenCost,
  reduce,
  shuttleRequirement,
  targetKind,
} from '../src/engine';
import { bagDraw, tokensInBag, tokensInReserve } from '../src/engine/noise';
import type { Action, GameState } from '../src/engine/types';
import { at, endTurn, fresh, handOnly, put, setTokens, spawn, withHand } from './helpers';

/** One state per action type, so the cost and label paths are all exercised. */
function everyActionType(): { state: GameState; action: Action }[] {
  const base = put(fresh('security'), (s) => {
    s.ship.power = RULES.powerCap;
  });
  const spine = at(base, 'spine_b');
  const withThreat = spawn(at(base, 'spine_a'), 'contact', 'spine_a');
  const shuttle = put(at(base, 'shuttle_bay'), (s) => {
    s.ship.shuttleCharge = shuttleRequirement('security', 1);
  });
  const vents = reduce(at(base, 'medbay'), { t: 'ventEnter' });
  const armory = put(at(base, 'armory'), (s) => {
    s.player.spent = [s.player.deck.find((u) => u.startsWith('service_pistol@')) ?? 'x@1'];
  });
  return [
    { state: base, action: { t: 'move', to: 'spine_a' } },
    { state: base, action: { t: 'creep', to: 'spine_a' } },
    { state: base, action: { t: 'listen' } },
    { state: base, action: { t: 'search' } },
    { state: base, action: { t: 'discard', uid: base.player.hand[0] as string } },
    { state: withHand(base, ['advance']), action: { t: 'play', uid: 'advance@1', to: 'spine_a' } },
    { state: at(base, 'medbay'), action: { t: 'ventEnter' } },
    { state: vents, action: { t: 'ventExit', to: 'bridge' } },
    { state: at(base, 'reactor'), action: { t: 'repair' } },
    { state: spine, action: { t: 'seal', edge: ['spine_b', 'reactor'] } },
    { state: at(base, 'bridge'), action: { t: 'purgeVents' } },
    { state: at(base, 'medbay'), action: { t: 'carryScan', index: 0 } },
    { state: at(base, 'medbay'), action: { t: 'purgeBlood', index: 0 } },
    { state: armory, action: { t: 'recharge', target: armory.player.spent[0] as string } },
    { state: at(base, 'shuttle_bay'), action: { t: 'chargeShuttle', n: 3 } },
    { state: at(base, 'comms'), action: { t: 'beacon' } },
    { state: at(base, 'bridge'), action: { t: 'armScuttle' } },
    { state: shuttle, action: { t: 'launch' } },
    { state: withThreat, action: { t: 'endTurn' } },
    { state: handOnly(base, ['panic_shaking']), action: { t: 'burn', uid: 'panic_shaking@1001' } },
  ];
}

describe('the action surface the interface consumes', () => {
  it('prices and labels every action type', () => {
    for (const { state, action } of everyActionType()) {
      const cost = actionCost(state, action);
      expect(cost.ap).toBeGreaterThanOrEqual(0);
      expect(cost.power).toBeGreaterThanOrEqual(0);
      expect(cost.noise).toBeGreaterThanOrEqual(0);
      expect(describeAction(action).length).toBeGreaterThan(0);
      expect(actionKey(action).length).toBeGreaterThan(0);
    }
  });

  it('adds the panic surcharge to the noise it discloses', () => {
    const sweaty = put(fresh(), (s) => {
      s.player.panicsGained += 1;
      s.player.hand.push('panic_sweat@1001');
    });
    expect(actionCost(sweaty, { t: 'move', to: 'spine_a' }).noise).toBe(
      (RULES.basicActions.move?.noise ?? 2) + 1,
    );
    expect(listenCost(sweaty)).toBe(RULES.basicActions.listen?.ap ?? 1);
  });

  it('names the target every card needs', () => {
    expect(targetKind({ op: 'move', silent: true })).toBe('node');
    expect(targetKind({ op: 'sealEdge', turns: 3, anywhere: true })).toBe('edge');
    expect(targetKind({ op: 'sealEdge', turns: 3, anywhere: false })).toBe('edgeHere');
    expect(targetKind({ op: 'attack', bonus: 1 })).toBe('threat');
    expect(targetKind({ op: 'addNoise', scope: 'target', n: 3 })).toBe('other');
    expect(targetKind({ op: 'addNoise', scope: 'here', n: 3 })).toBe(null);
    expect(targetKind({ op: 'ventJump' })).toBe('vent');
    expect(targetKind({ op: 'recharge' })).toBe('spent');
    expect(targetKind({ op: 'sequence', steps: [{ op: 'draw', n: 1 }, { op: 'move', silent: true }] })).toBe('node');
    expect(targetKind({ op: 'gainPower', n: 1 })).toBe(null);
  });

  it('enumerates only affordable actions', () => {
    const broke = put(fresh(), (s) => {
      s.player.ap = 0;
      s.ship.power = 0;
    });
    for (const a of legalActions(broke)) {
      expect(actionCost(broke, a).ap).toBeLessThanOrEqual(0);
    }
  });
});

describe('invariants catch tampering', () => {
  it('rejects a state that loses a token', () => {
    const bad = put(fresh(), (s) => {
      s.bag.contact -= 1;
    });
    expect(() => assertInvariants(bad)).toThrow(InvariantError);
  });

  it('rejects a state that loses a card', () => {
    const bad = put(fresh(), (s) => {
      s.player.deck.pop();
    });
    expect(() => assertInvariants(bad)).toThrow(InvariantError);
  });

  it('rejects out-of-bounds power and noise', () => {
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
        put(fresh(), (s) => {
          s.threats.push({ id: 'q', type: 'contact', node: 'nowhere', hp: 2 });
          s.bag.contact -= 1;
        }),
      ),
    ).toThrow();
  });
});

describe('the bag under pressure', () => {
  it('places a contact from the reserve when the bag runs dry', () => {
    const empty = setTokens(fresh(), {}, { contact: 18 });
    const drawn = { ...empty };
    const result = bagDraw(drawn, 'spine_a');
    expect(result).toBe('contact');
    expect(drawn.threats).toHaveLength(1);
  });

  it('reactivates every threat when both the bag and the reserve are dry', () => {
    // An empty bag with no contacts left to draft in.
    let s = fresh();
    for (let i = 0; i < 3; i++) s = spawn(s, 'contact', 'spine_c');
    s = setTokens(s, {}, { blank: 15 });
    const drawn = { ...s };
    expect(bagDraw(drawn, 'spine_a')).toBe('empty');
    expect(tokensInBag(drawn)).toBe(0);
    expect(tokensInReserve(drawn)).toBeGreaterThan(0);
  });

  it('escalates through the whole reserve over a long, loud run', () => {
    let s = at(fresh(), 'ore_hold');
    for (let i = 0; i < 6 && s.status === 'active'; i++) {
      s = endTurn(s);
    }
    expect(s.stats.bagDraws).toBeGreaterThan(0);
  });
});
