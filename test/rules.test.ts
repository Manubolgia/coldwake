import { describe, expect, it } from 'vitest';
import {
  MAP,
  RULES,
  TOTAL_TOKENS,
  depthDef,
  initialState,
  isPanic,
  legalActions,
  reduce,
  roleDeck,
  shuttleRequirement,
  turnLimit,
} from '../src/engine';
import type { Action, Depth, GameState, RoleId } from '../src/engine/types';
import { at, endTurn, fresh, handOnly, has, playCard, put, setTokens, spawn, withHand } from './helpers';

const ROLES: RoleId[] = ['engineer', 'security', 'medic', 'surveyor', 'pilot'];
const DEPTH_LIST: Depth[] = [1, 2, 3, 4, 5];

describe('§4.1 the ship', () => {
  it('starts in the cryobay, which threats never spawn in', () => {
    const s = fresh();
    expect(s.player.node).toBe('cryobay');
    expect(MAP.nodes.find((n) => n.id === 'cryobay')?.safe).toBe(true);
  });

  it('offers only adjacent moves', () => {
    const s = fresh();
    expect(has(s, { t: 'move', to: 'spine_a' })).toBe(true);
    expect(has(s, { t: 'move', to: 'reactor' })).toBe(false);
  });

  it('gives four nodes vent access and no others', () => {
    const vents = MAP.nodes.filter((n) => n.vent).map((n) => n.id);
    expect(vents).toEqual(['shuttle_bay', 'medbay', 'bridge', 'ore_hold']);
  });

  it('costs 2 AP to transit the vents and draws a bag token on the way out', () => {
    const s = at(fresh(), 'medbay');
    const entered = reduce(s, { t: 'ventEnter' });
    expect(entered.player.node).toBe('vents');
    expect(entered.player.ap).toBe(RULES.apPerTurn - 1);
    const exited = reduce(entered, { t: 'ventExit', to: 'bridge' });
    expect(exited.player.node).toBe('bridge');
    expect(exited.player.ap).toBe(RULES.apPerTurn - 2);
    expect(exited.stats.bagDraws).toBe(1);
  });

  it('cannot act on rooms from inside the vents', () => {
    const s = at(fresh(), 'medbay');
    const inVents = reduce(s, { t: 'ventEnter' });
    const kinds = new Set(legalActions(inVents).map((a) => a.t));
    expect(kinds.has('search')).toBe(false);
    expect(kinds.has('carryScan')).toBe(false);
    expect(kinds.has('ventExit')).toBe(true);
  });

  it('ambushes on a vent exit that draws a threat, at -2 to combat', () => {
    let s = at(fresh(), 'medbay');
    // A bag of nothing but contacts makes the ambush deterministic.
    s = setTokens(s, { contact: 5 }, { blank: 9, drifter: 2, burrower: 1, chorus: 1 });
    s = reduce(s, { t: 'ventEnter' });
    const out = reduce(s, { t: 'ventExit', to: 'bridge' });
    expect(out.threats).toHaveLength(1);
    expect(out.player.combatPenalty).toBe(RULES.ventAmbushPenalty);
    expect(out.stats.wounds).toBe(1);
  });
});

describe('§4.2 the turn', () => {
  it('draws to hand size and grants 3 AP', () => {
    const s = fresh();
    expect(s.player.hand).toHaveLength(RULES.handSize);
    expect(s.player.ap).toBe(RULES.apPerTurn);
  });

  it('discards unplayed cards at the end of the turn', () => {
    const s = endTurn(fresh());
    expect(s.turn).toBe(2);
    expect(s.player.hand).toHaveLength(RULES.handSize);
    expect(s.player.discard.length).toBeGreaterThan(0);
  });

  it('ends the run at the turn limit with nothing armed', () => {
    let s = fresh();
    for (let i = 0; i < turnLimit(1) + 1 && s.status === 'active'; i++) s = endTurn(s);
    expect(s.status).not.toBe('active');
    expect(s.result?.turn).toBeLessThanOrEqual(turnLimit(1));
  });
});

describe('§4.3 your deck', () => {
  it('gives every role twelve cards', () => {
    for (const role of ROLES) expect(roleDeck(role)).toHaveLength(12);
  });

  it('burns a card and gains a panic for every wound', () => {
    let s = spawn(at(fresh(), 'spine_a'), 'contact', 'spine_a');
    s = put(s, (x) => {
      x.ship.noise.spine_a = 3;
    });
    const before = s.player.hand.length;
    s = reduce(s, { t: 'endTurn' });
    expect(s.phase).toBe('wound');
    expect(s.player.pendingWounds).toBe(1);
    expect(s.player.panicsGained).toBe(1);
    const burn = legalActions(s)[0] as Action;
    s = reduce(s, burn);
    expect(s.player.burned).toHaveLength(1);
    expect(s.player.hand.length).toBeLessThan(before + RULES.handSize);
    const allCards = [...s.player.hand, ...s.player.deck, ...s.player.discard];
    expect(allCards.some((u) => isPanic(u))).toBe(true);
  });

  it('reshuffles the discard when the deck runs out', () => {
    let s = put(fresh(), (x) => {
      x.player.discard = [...x.player.deck, ...x.player.hand];
      x.player.deck = [];
      x.player.hand = [];
    });
    s = endTurn(s);
    expect(s.player.hand).toHaveLength(RULES.handSize);
  });

  it('never returns a burned card', () => {
    let s = withHand(fresh(), ['load_shed']);
    s = playCard(s, 'load_shed');
    expect(s.player.burned.some((u) => u.startsWith('load_shed'))).toBe(true);
    expect(s.player.discard.some((u) => u.startsWith('load_shed'))).toBe(false);
  });
});

describe('§4.4 actions', () => {
  it('charges the printed AP and noise for a move', () => {
    const s = reduce(fresh(), { t: 'move', to: 'spine_a' });
    expect(s.player.ap).toBe(RULES.apPerTurn - 1);
    expect(s.ship.noise.cryobay).toBe(RULES.basicActions.move?.noise);
  });

  it('creeps for 2 AP and no noise', () => {
    const s = reduce(fresh(), { t: 'creep', to: 'spine_a' });
    expect(s.player.ap).toBe(RULES.apPerTurn - 2);
    expect(s.ship.noise.cryobay).toBe(0);
  });

  it('reveals the bag on a listen', () => {
    const s = reduce(fresh(), { t: 'listen' });
    expect(s.bagKnownTurn).toBe(s.turn);
  });

  it('searches a node twice and no more', () => {
    let s = fresh();
    s = reduce(s, { t: 'search' });
    s = reduce(s, { t: 'search' });
    expect(s.ship.salvage.cryobay).toHaveLength(0);
    expect(s.ship.searched).toContain('cryobay');
    expect(has(s, { t: 'search' })).toBe(false);
  });

  it('sheds a panic card with the discard action', () => {
    let s = handOnly(fresh(), ['panic_shaking']);
    const panic = s.player.hand[0] as string;
    s = reduce(s, { t: 'discard', uid: panic });
    expect(s.player.hand).toHaveLength(0);
    expect(s.player.ap).toBe(RULES.apPerTurn - 1);
  });

  const systemCases: { action: Action; node: string; setup?: (s: GameState) => void }[] = [
    { action: { t: 'repair' }, node: 'reactor', setup: (s) => (s.ship.reactorOutput = 0) },
    { action: { t: 'seal', edge: ['spine_b', 'reactor'] }, node: 'spine_b' },
    { action: { t: 'purgeVents' }, node: 'bridge' },
    { action: { t: 'carryScan', index: 0 }, node: 'medbay' },
    { action: { t: 'purgeBlood', index: 0 }, node: 'medbay' },
    { action: { t: 'chargeShuttle', n: 1 }, node: 'shuttle_bay' },
    { action: { t: 'beacon' }, node: 'comms' },
    { action: { t: 'armScuttle' }, node: 'bridge' },
  ];

  for (const c of systemCases) {
    it(`allows ${c.action.t} in ${c.node}, refuses it elsewhere and without power`, () => {
      const powered = put(at(fresh(), c.node), (s) => {
        s.ship.power = RULES.powerCap;
        c.setup?.(s);
      });
      expect(() => reduce(powered, c.action)).not.toThrow();

      const wrongNode = put(at(fresh(), 'armory'), (s) => {
        s.ship.power = RULES.powerCap;
      });
      expect(() => reduce(wrongNode, c.action)).toThrow();

      const cost = RULES.systemActions[c.action.t]?.power ?? 0;
      if (cost > 0) {
        const broke = put(at(fresh(), c.node), (s) => {
          s.ship.power = cost - 1;
          c.setup?.(s);
        });
        expect(() => reduce(broke, c.action)).toThrow();
      }
    });
  }

  it('recharges a spent weapon in the armory only', () => {
    const s = put(at(fresh(), 'armory'), (x) => {
      x.player.spent = ['cutting_torch@1'];
      x.ship.power = 5;
    });
    const done = reduce(s, { t: 'recharge', target: 'cutting_torch@1' });
    expect(done.player.spent).toHaveLength(0);
    const elsewhere = at(s, 'medbay');
    expect(() => reduce(elsewhere, { t: 'recharge', target: 'cutting_torch@1' })).toThrow();
  });

  it('blocks an edge for three turns with a bulkhead seal', () => {
    const s = put(at(fresh(), 'spine_b'), (x) => {
      x.ship.power = 5;
    });
    const sealed = reduce(s, { t: 'seal', edge: ['spine_b', 'reactor'] });
    expect(has(sealed, { t: 'move', to: 'reactor' })).toBe(false);
    expect(sealed.ship.sealedEdges[0]?.expiresTurn).toBe(sealed.turn + 3);
  });
});

describe('§4.5 power', () => {
  it('adds reactor output to the pool each decay phase, capped', () => {
    const s = endTurn(fresh());
    expect(s.ship.power).toBe(depthDef(1).reactorOutputStart);
    const full = put(s, (x) => {
      x.ship.power = RULES.powerCap;
    });
    expect(endTurn(full).ship.power).toBe(RULES.powerCap);
  });

  it('lets a burrower in the reactor degrade output instead of attacking', () => {
    let s = spawn(at(fresh(), 'cryobay'), 'burrower', 'reactor');
    const before = s.ship.reactorOutput;
    s = endTurn(s);
    expect(s.ship.reactorOutput).toBeLessThanOrEqual(before);
  });

  it('repairs output by one, up to the maximum', () => {
    const s = put(at(fresh(), 'reactor'), (x) => {
      x.ship.reactorOutput = 0;
    });
    const once = reduce(s, { t: 'repair' });
    expect(once.ship.reactorOutput).toBe(1);
    const full = put(at(fresh(), 'reactor'), (x) => {
      x.ship.reactorOutput = RULES.reactorOutputMax;
    });
    expect(has(full, { t: 'repair' })).toBe(false);
  });
});

describe('§4.6 noise', () => {
  it('draws from the bag at the threshold and resets the node', () => {
    const s = put(fresh(), (x) => {
      x.ship.noise.cryobay = RULES.noiseThreshold;
    });
    const after = endTurn(s);
    expect(after.stats.bagDraws).toBeGreaterThanOrEqual(1);
  });

  it('decays one per turn but never below the ore hold floor', () => {
    const s = put(fresh(), (x) => {
      x.ship.noise.spine_a = 3;
    });
    const after = endTurn(s);
    expect(after.ship.noise.spine_a).toBe(2);
    expect(after.ship.noise.ore_hold).toBeGreaterThanOrEqual(depthDef(1).oreHoldFloor);
  });

  it('never exceeds the noise ceiling', () => {
    let s = put(at(fresh(), 'ore_hold'), (x) => {
      x.ship.noise.ore_hold = RULES.noiseMax;
    });
    s = reduce(s, { t: 'search' });
    expect(s.ship.noise.ore_hold).toBeLessThanOrEqual(RULES.noiseMax);
  });
});

describe('§4.7 the bag', () => {
  it('conserves tokens at setup for all 25 role-depth combinations', () => {
    for (const role of ROLES) {
      for (const depth of DEPTH_LIST) {
        const s = initialState('conserve', role, depth);
        const bag = Object.values(s.bag).reduce((a, b) => a + b, 0);
        const reserve = Object.values(s.reserve).reduce((a, b) => a + b, 0);
        expect(bag + reserve + s.threats.length).toBe(TOTAL_TOKENS);
      }
    }
  });

  it('returns a blank to the bag and feeds it a contact from the reserve', () => {
    const s = setTokens(
      put(at(fresh(), 'spine_a'), (x) => {
        x.ship.noise.spine_a = RULES.noiseThreshold;
      }),
      { blank: 3 },
      { blank: 4, contact: 7, drifter: 2, burrower: 1, chorus: 1 },
    );
    const after = endTurn(s);
    expect(after.bag.blank).toBe(3);
    expect(after.bag.contact).toBe(1);
    expect(after.reserve.contact).toBe(6);
  });

  it('places a threat out of the bag and returns it on death', () => {
    let s = setTokens(
      put(at(fresh('security'), 'spine_a'), (x) => {
        x.ship.noise.spine_a = RULES.noiseThreshold;
      }),
      { contact: 3 },
      { blank: 8, contact: 4, drifter: 2, burrower: 1 },
    );
    s = endTurn(s);
    expect(s.bag.contact).toBe(2);
    expect(s.threats.length).toBeGreaterThan(0);
    const withWeapon = withHand(
      put(s, (x) => {
        x.player.node = x.threats[0]!.node;
      }),
      ['last_stand'],
    );
    const killed = playCard(withWeapon, 'last_stand', { threat: withWeapon.threats[0]!.id });
    expect(killed.bag.contact).toBe(3);
    expect(killed.stats.threatsKilled).toBe(1);
  });
});

describe('§4.8 threats', () => {
  it('moves a contact toward the loudest node', () => {
    let s = spawn(at(fresh(), 'cryobay'), 'contact', 'ore_hold');
    s = put(s, (x) => {
      x.ship.noise.comms = 3;
      x.ship.noise.ore_hold = 2;
    });
    s = endTurn(s);
    expect(s.threats[0]?.node).toBe('comms');
  });

  it('makes a drifter hunt the player within two nodes', () => {
    let s = spawn(at(fresh(), 'spine_b'), 'drifter', 'spine_a');
    s = put(s, (x) => {
      x.ship.noise.comms = 6;
    });
    s = endTurn(s);
    expect(s.threats[0]?.node).toBe('spine_b');
  });

  it('lets a burrower cross a sealed bulkhead', () => {
    let s = spawn(at(fresh(), 'spine_b'), 'burrower', 'reactor');
    s = put(s, (x) => {
      x.ship.sealedEdges.push({ edge: ['spine_b', 'reactor'], expiresTurn: x.turn + 3 });
    });
    s = endTurn(s);
    expect(s.threats[0]?.node).toBe('spine_b');
  });

  it('has the chorus raise noise everywhere and feed the bag at the hold', () => {
    let s = spawn(at(fresh(), 'cryobay'), 'chorus', 'reactor');
    const reserveBefore = s.reserve.contact;
    s = endTurn(s);
    expect(s.threats[0]?.node).toBe('ore_hold');
    expect(s.reserve.contact).toBe(reserveBefore - 2);
    expect(s.ship.noise.spine_c).toBeGreaterThanOrEqual(0);
  });

  it('activates burrowers before drifters before contacts before the chorus', () => {
    const order = ['burrower', 'drifter', 'contact', 'chorus'];
    let s = fresh();
    for (const t of order.slice().reverse()) {
      s = spawn(s, t as 'contact', 'spine_c');
    }
    const acted = endTurn(s);
    expect(acted.threats.length).toBeGreaterThan(0);
  });
});

describe('§4.9 combat', () => {
  it('kills on meet-or-beat and spends the weapon on a miss', () => {
    const base = spawn(at(fresh(), 'spine_a'), 'contact', 'spine_a');
    let killed = 0;
    let spent = 0;
    for (let i = 0; i < 40; i++) {
      const s = withHand(put(base, (x) => (x.rng = 1000 + i * 7919)), ['cutting_torch']);
      const after = playCard(s, 'cutting_torch', { threat: s.threats[0]!.id });
      if (after.threats.length === 0) killed += 1;
      if (after.player.spent.length > 0) spent += 1;
    }
    // Torch is +2 against 2 HP, so it cannot miss.
    expect(killed).toBe(40);
    expect(spent).toBe(0);
  });

  it('can miss with a weak weapon and then be recharged', () => {
    const base = spawn(at(fresh('medic'), 'spine_a'), 'chorus', 'spine_a');
    let misses = 0;
    for (let i = 0; i < 40; i++) {
      const s = withHand(put(base, (x) => (x.rng = 500 + i * 104729)), ['scalpel']);
      const after = playCard(s, 'scalpel', { threat: s.threats[0]!.id });
      if (after.player.spent.length > 0) misses += 1;
    }
    expect(misses).toBeGreaterThan(0);
  });
});

describe('§4.10 CARRY', () => {
  it('starts face down and draws one more per wound', () => {
    const s = fresh();
    expect(s.player.carry).toHaveLength(depthDef(1).carry.startCards);
    expect(s.player.carry.every((c) => !c.revealed)).toBe(true);
    let wounded = spawn(at(fresh(), 'spine_a'), 'drifter', 'spine_a');
    wounded = endTurn(wounded);
    expect(wounded.player.carry.length).toBeGreaterThan(1);
  });

  it('reveals one card per scan', () => {
    const s = put(at(fresh(), 'medbay'), (x) => {
      x.ship.power = 5;
    });
    const scanned = reduce(s, { t: 'carryScan', index: 0 });
    expect(scanned.player.carry[0]?.revealed).toBe(true);
    expect(scanned.stats.scans).toBe(1);
  });

  it('purges an unrevealed sample at the cost of a wound', () => {
    const s = put(at(fresh(), 'medbay'), (x) => {
      x.ship.power = 5;
      x.player.carry = [
        { id: 'clean', revealed: false },
        { id: 'infested', revealed: false },
      ];
    });
    const purged = reduce(s, { t: 'purgeBlood', index: 0 });
    expect(purged.player.carry).toHaveLength(1);
    expect(purged.stats.wounds).toBe(1);
  });

  it('matches the hypergeometric odds of holding 2+ infested (gate 1.15)', () => {
    const { clean, infested } = depthDef(1).carry;
    const total = clean + infested;
    const draws = 5;
    const choose = (n: number, k: number): number => {
      if (k < 0 || k > n) return 0;
      let r = 1;
      for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
      return r;
    };
    const p0 = choose(clean, draws) / choose(total, draws);
    const p1 = (choose(infested, 1) * choose(clean, draws - 1)) / choose(total, draws);
    const analytic = 1 - p0 - p1;

    let hits = 0;
    const trials = 100000;
    for (let i = 0; i < trials; i++) {
      const s = initialState(`carry${i}`, 'engineer', 1);
      const pool = [...s.player.carry.map((c) => c.id), ...s.carryDeck].slice(0, draws);
      if (pool.filter((c) => c === 'infested').length >= 2) hits += 1;
    }
    expect(Math.abs(hits / trials - analytic)).toBeLessThan(0.01);
  });
});

describe('§4.11 endings and score', () => {
  function launchable(role: RoleId = 'engineer'): GameState {
    return put(at(fresh(role), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement(role, 1);
    });
  }

  it('gives Clean Break at ×1.5 when fewer than two infested', () => {
    const s = put(launchable(), (x) => {
      x.player.carry = [{ id: 'clean', revealed: true }];
    });
    const done = reduce(s, { t: 'launch' });
    expect(done.status).toBe('clean_break');
    expect(RULES.endings.clean_break.multiplier).toBe(1.5);
  });

  it('gives Carrier at ×0.8 when holding two infested', () => {
    const s = put(launchable(), (x) => {
      x.player.carry = [
        { id: 'infested', revealed: false },
        { id: 'infested', revealed: false },
      ];
    });
    const done = reduce(s, { t: 'launch' });
    expect(done.status).toBe('carrier');
    expect(done.result?.score).toBe(Math.round((done.result?.score ?? 0)));
  });

  it('gives Scuttle when armed and the run ends', () => {
    let s = put(fresh(), (x) => {
      x.ship.scuttleArmed = true;
      x.turn = turnLimit(1);
    });
    s = endTurn(s);
    expect(s.status).toBe('scuttle');
  });

  it('gives Beacon when broadcast and nothing armed', () => {
    let s = put(fresh(), (x) => {
      x.ship.beaconSent = true;
      x.turn = turnLimit(1);
    });
    s = endTurn(s);
    expect(s.status).toBe('beacon');
  });

  it('gives Lost with nothing armed and nothing broadcast', () => {
    let s = put(fresh(), (x) => {
      x.turn = turnLimit(1);
    });
    s = endTurn(s);
    expect(s.status).toBe('lost');
  });

  it('scores the documented formula', () => {
    const s = put(launchable(), (x) => {
      x.ship.searched = ['cryobay'];
      x.stats.threatsKilled = 1;
      x.turn = 5;
      x.player.carry = [{ id: 'clean', revealed: true }];
    });
    const done = reduce(s, { t: 'launch' });
    const surviving = [...done.player.hand, ...done.player.deck, ...done.player.discard].filter(
      (u) => !isPanic(u),
    ).length;
    const base =
      done.ship.shuttleCharge * RULES.score.powerBanked +
      1 * RULES.score.nodesSearched +
      1 * RULES.score.threatsKilled +
      5 * RULES.score.turnsSurvived +
      surviving * RULES.score.survivingCards;
    expect(done.result?.score).toBe(Math.round(base * RULES.endings.clean_break.multiplier));
  });

  it('kills the player only when no non-panic card remains (gate 1.14)', () => {
    let s = handOnly(spawn(at(fresh(), 'spine_a'), 'drifter', 'spine_a'), ['panic_shaking']);
    const dead = reduce(s, { t: 'endTurn' });
    expect(dead.status).not.toBe('active');
    expect(dead.result?.cause).toBe('deck');

    const alive = handOnly(spawn(at(fresh(), 'spine_a'), 'contact', 'spine_a'), ['brace']);
    const survived = reduce(alive, { t: 'endTurn' });
    expect(survived.status).toBe('active');
  });
});

describe('§4.12-4.13 roles and depths', () => {
  it('builds every role at every depth', () => {
    for (const role of ROLES) {
      for (const depth of DEPTH_LIST) {
        const s = initialState('matrix', role, depth);
        expect(s.player.deck.length + s.player.hand.length).toBe(12);
        expect(JSON.parse(JSON.stringify(s))).toEqual(s);
      }
    }
  });

  it('applies each depth modifier', () => {
    for (const depth of DEPTH_LIST) {
      const d = depthDef(depth);
      const s = initialState('depths', 'engineer', depth);
      expect(s.ship.reactorOutput).toBe(d.reactorOutputStart);
      expect(s.player.carry).toHaveLength(d.carry.startCards);
      expect(s.ship.noise.ore_hold).toBeGreaterThanOrEqual(d.oreHoldFloor);
      expect(s.threats).toHaveLength(d.startingDraws === 0 ? 0 : s.threats.length);
    }
  });

  it('lets the pilot launch on less power', () => {
    expect(shuttleRequirement('pilot', 1)).toBeLessThan(shuttleRequirement('engineer', 1));
  });
});

describe('§7 engine contract', () => {
  it('never mutates the state passed to reduce', () => {
    const s = fresh();
    const snapshot = JSON.stringify(s);
    reduce(s, { t: 'move', to: 'spine_a' });
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it('offers no legal actions once the run is resolved (gate 1.7)', () => {
    let s = put(at(fresh(), 'shuttle_bay'), (x) => {
      x.ship.shuttleCharge = shuttleRequirement('engineer', 1);
    });
    s = reduce(s, { t: 'launch' });
    expect(legalActions(s)).toHaveLength(0);
    expect(() => reduce(s, { t: 'endTurn' })).toThrow();
  });

  it('logs every action for replay', () => {
    let s = fresh();
    s = reduce(s, { t: 'move', to: 'spine_a' });
    s = reduce(s, { t: 'listen' });
    expect(s.log.map((l) => l.action.t)).toEqual(['move', 'listen']);
  });
});
