import { describe, expect, it } from 'vitest';
import {
  IllegalActionError,
  RULES,
  boardCap,
  cardCost,
  creepNoise,
  infectionCount,
  infectionThreshold,
  legalActions,
  reduce,
  shuttleRequirement,
  turnLimit,
} from '../src/engine';
import {
  at,
  endTurn,
  fresh,
  handMix,
  handOnly,
  has,
  playCard,
  put,
  spawn,
  withHand,
  withInfection,
} from './helpers';

describe('the hour', () => {
  it('gives you the same time every hour and takes what you spend', () => {
    const s = fresh();
    expect(s.player.ap).toBe(RULES.apPerTurn);
    const moved = reduce(s, { t: 'creep', to: 'spine_a' });
    expect(moved.player.ap).toBe(RULES.apPerTurn - (RULES.basicActions.creep?.ap ?? 1));
  });

  it('keeps the hand between hours instead of throwing it away', () => {
    // The old game drew five cards an hour and binned whatever was unplayed:
    // measured at 60 cards a run discarded against 8 played.
    const s = put(fresh(), (x) => {
      x.player.ap = 0;
    });
    const kept = s.player.hand.slice();
    const next = endTurn(s);
    for (const uid of kept) expect(next.player.hand).toContain(uid);
  });

  it('tops the hand back up to the hand size at the start of the hour', () => {
    const s = put(fresh(), (x) => {
      x.player.discard.push(...x.player.hand.slice(2));
      x.player.hand = x.player.hand.slice(0, 2);
      x.player.ap = 0;
    });
    expect(endTurn(s).player.hand.length).toBe(RULES.handSize);
  });

  it('gives one card free an hour and charges for the rest', () => {
    const s = withHand(fresh(), ['bypass', 'bypass']);
    expect(cardCost(s, s.player.hand[0] as string)).toBe(0);
    const after = playCard(s, 'bypass');
    expect(after.player.freeCardUsed).toBe(true);
    expect(cardCost(after, after.player.hand[0] as string)).toBeGreaterThan(0);
  });

  it('lets the free slot be spent on setting a card aside, and replaces it', () => {
    const s = fresh();
    const uid = s.player.hand[0] as string;
    const after = reduce(s, { t: 'discard', uid });
    expect(after.player.ap).toBe(RULES.apPerTurn);
    expect(after.player.discard).toContain(uid);
    expect(after.player.hand.length).toBe(s.player.hand.length);
  });

  it('resets the free slot when the hour turns over', () => {
    const s = playCard(withHand(fresh(), ['bypass']), 'bypass');
    expect(endTurn(s).player.freeCardUsed).toBe(false);
  });
});

describe('moving is a question of how loudly', () => {
  it('prices walking and creeping the same in time and differently in noise', () => {
    const s = fresh();
    expect(RULES.basicActions.move?.ap).toBe(RULES.basicActions.creep?.ap);
    expect(RULES.basicActions.move?.noise).toBeGreaterThan(creepNoise(s));
  });

  it('leaves the noise where the sound was made', () => {
    const walked = reduce(fresh(), { t: 'move', to: 'spine_a' });
    expect(walked.ship.noise.spine_a).toBe(RULES.basicActions.move?.noise);
    expect(walked.ship.noise.cryobay).toBe(0);
  });

  it('refuses to walk through a dropped bulkhead', () => {
    const sealed = put(at(fresh(), 'spine_a'), (s) => {
      s.ship.sealedEdges.push({ edge: ['spine_a', 'spine_b'], expiresTurn: s.turn + 3 });
    });
    expect(has(sealed, { t: 'move', to: 'spine_b' })).toBe(false);
    expect(() => reduce(sealed, { t: 'move', to: 'spine_b' })).toThrow(IllegalActionError);
  });
});

describe('bracing', () => {
  it('is offered once an hour and stops the next wound', () => {
    const s = fresh();
    expect(has(s, { t: 'brace' })).toBe(true);
    const braced = reduce(s, { t: 'brace' });
    expect(braced.player.wardsThisTurn).toBe(1);
    // Bracing twice is not twice as braced.
    expect(has(braced, { t: 'brace' })).toBe(false);
  });

  it('eats the wound rather than the capability', () => {
    const s = reduce(spawn(at(fresh(), 'spine_a'), 'contact', 'spine_a', 'spine_a'), { t: 'brace' });
    const after = endTurn(s);
    expect(after.stats.wounds).toBe(0);
    expect(after.player.burned.length).toBe(0);
  });
});

describe('noise draws, and the board is capped', () => {
  it('draws from a compartment at the threshold and resets it to its floor', () => {
    const s = put(fresh(), (x) => {
      x.ship.noise.cryobay = RULES.noiseThreshold;
    });
    const after = endTurn(s);
    expect(after.stats.bagDraws).toBeGreaterThan(0);
    expect(after.ship.noise.cryobay).toBe(0);
  });

  it('never puts more on the board than the depth allows', () => {
    // This is the whole of the fix for "there are thousands of enemies": the
    // ship gets worse without getting busier.
    let s = fresh('engineer', 1);
    for (let i = 0; i < 3; i++) s = spawn(s, 'contact', 'cryobay');
    expect(s.threats.length).toBe(boardCap(1));
    const loud = put(s, (x) => {
      for (const id of Object.keys(x.ship.noise)) x.ship.noise[id] = RULES.noiseMax;
    });
    const after = endTurn(loud);
    expect(after.threats.filter((t) => t.type !== 'mother').length).toBeLessThanOrEqual(boardCap(1));
  });

  it('grows a STRAY into a HUNTER instead of adding a body', () => {
    let s = fresh('engineer', 1);
    for (let i = 0; i < boardCap(1); i++) s = spawn(s, 'contact', 'cryobay');
    const loud = put(s, (x) => {
      x.ship.noise.cryobay = RULES.noiseMax;
    });
    const after = endTurn(loud);
    expect(after.threats.some((t) => t.type === 'drifter')).toBe(true);
  });
});

describe('a wound', () => {
  it('takes a capability you choose and puts infection in your deck', () => {
    const s = spawn(at(handMix(fresh(), 3, 0), 'spine_a'), 'contact', 'spine_a', 'spine_a');
    const hit = reduce(s, { t: 'endTurn' });
    expect(hit.phase).toBe('wound');
    expect(infectionCount(hit)).toBe(1);
    const choices = legalActions(hit);
    expect(choices.length).toBeGreaterThan(0);
    expect(choices.every((a) => a.t === 'burn')).toBe(true);
    const paid = reduce(hit, choices[0] as never);
    expect(paid.player.burned.length).toBe(1);
  });

  it('never offers infection as something a wound can take', () => {
    const s = spawn(at(handMix(fresh(), 1, 3), 'spine_a'), 'contact', 'spine_a', 'spine_a');
    const hit = reduce(s, { t: 'endTurn' });
    expect(hit.phase).toBe('wound');
    for (const a of legalActions(hit)) {
      expect(a.t).toBe('burn');
      expect((a as { uid: string }).uid.startsWith('inf_')).toBe(false);
    }
  });

  it('ends the run when there is nothing left you can do', () => {
    const s = spawn(at(handOnly(fresh(), []), 'spine_a'), 'drifter', 'spine_a', 'spine_a');
    const after = endTurn(s);
    expect(after.status).toBe('killed');
    expect(after.result?.cause).toBe('attrition');
  });
});

describe('infection is visible and curable', () => {
  it('is counted out of the deck, the hand and the discard alike', () => {
    const s = handMix(fresh(), 2, 3);
    expect(infectionCount(s)).toBe(3);
  });

  it('is cut out in the medbay without a wound', () => {
    const s = put(at(handMix(fresh(), 2, 2), 'medbay'), (x) => {
      x.ship.power = RULES.powerCap;
    });
    expect(has(s, { t: 'cure' })).toBe(true);
    const cured = reduce(s, { t: 'cure' });
    expect(infectionCount(cured)).toBe(1);
    expect(cured.stats.wounds).toBe(0);
    expect(cured.stats.cures).toBe(1);
  });

  it('is not offered when there is nothing left to cut out', () => {
    const s = put(at(handMix(fresh(), 3, 0), 'medbay'), (x) => {
      x.ship.power = RULES.powerCap;
    });
    expect(has(s, { t: 'cure' })).toBe(false);
  });

  it('cannot be played', () => {
    const s = handMix(fresh(), 0, 3);
    expect(legalActions(s).some((a) => a.t === 'play')).toBe(false);
  });
});

describe('the window', () => {
  it('ends the run when the orbit closes', () => {
    const s = put(fresh(), (x) => {
      x.turn = turnLimit(1);
      x.player.ap = 0;
    });
    const after = endTurn(s);
    expect(after.status).not.toBe('active');
    expect(after.result?.cause).toBe('timeout');
  });

  it('offers the launch only with the charge banked', () => {
    const bay = at(fresh(), 'shuttle_bay');
    expect(has(bay, { t: 'launch' })).toBe(false);
    const ready = put(bay, (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    expect(has(ready, { t: 'launch' })).toBe(true);
  });

  it('makes launching over the infection line a CARRIER rather than a surprise', () => {
    const ready = put(at(withInfection(fresh(), infectionThreshold(1)), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    expect(reduce(ready, { t: 'launch' }).status).toBe('carrier');
  });
});
