import { ALL_EDGES, MAP, NODE_IDS, RULES, VENT_NODES, card, node } from './content';
import { cardIdOf, cardOf, holding, isInfection, isSpent } from './deck';
import { neighbours } from './graph';
import { infectionThreshold, relayHold, shuttleRequirement } from './state';
import type { Action, Card, EffectSpec, GameState, NodeId, Uid } from './types';

export type TargetKind = 'node' | 'anyNode' | 'edge' | 'edgeHere' | 'threat' | 'vent' | 'spent' | null;

/** What a card needs pointed at before it can be played. */
export function targetKind(effect: EffectSpec): TargetKind {
  switch (effect.op) {
    case 'move':
      return 'node';
    case 'sealEdge':
      return effect.anywhere ? 'edge' : 'edgeHere';
    case 'attack':
    case 'execute':
    case 'pushThreat':
      return 'threat';
    case 'addNoise':
      return effect.scope === 'target' ? 'anyNode' : null;
    case 'lure':
      return 'anyNode';
    case 'ventJump':
      return 'vent';
    case 'recharge':
      return 'spent';
    case 'sequence': {
      for (const step of effect.steps) {
        const k = targetKind(step);
        if (k !== null) return k;
      }
      return null;
    }
    default:
      return null;
  }
}

function effectOps(effect: EffectSpec, out: string[] = []): string[] {
  out.push(effect.op);
  if (effect.op === 'sequence') for (const s of effect.steps) effectOps(s, out);
  return out;
}

export function cardOps(c: Card): string[] {
  return effectOps(c.effect);
}

/** TUNNEL VISION in hand makes listening cost double. */
export function listenCost(state: GameState): number {
  const base = RULES.basicActions.listen?.ap ?? 1;
  return holding(state, 'inf_tunnel') ? base + 1 : base;
}

export function creepCost(_state: GameState): number {
  return RULES.basicActions.creep?.ap ?? 1;
}

/** TREMOR in hand means creeping is as loud as walking. */
export function creepNoise(state: GameState): number {
  const base = RULES.basicActions.creep?.noise ?? 1;
  return holding(state, 'inf_tremor') ? (RULES.basicActions.move?.noise ?? 3) : base;
}

/**
 * The hand persists across hours and has its own allowance: once an hour you
 * may play a card or set one aside for free, and everything after that costs
 * its printed time. The free slot is what keeps the hand turning over — §3.4.
 */
export function cardCost(state: GameState, uid: Uid): number {
  return state.player.freeCardUsed ? cardOf(uid).ap : 0;
}

export function discardCost(state: GameState): number {
  return state.player.freeCardUsed ? (RULES.basicActions.discard?.ap ?? 1) : 0;
}

/**
 * Every penalty that applies to a swing: the vent ambush, and FEVER while it
 * is still in hand.
 */
export function attackPenalty(state: GameState): number {
  const fever = holding(state, 'inf_fever') ? RULES.shakingPenalty : 0;
  return state.player.combatPenalty + fever;
}

export function salvageLeft(state: GameState, id: NodeId): number {
  return state.ship.salvage[id]?.length ?? 0;
}

export function systemAt(state: GameState, key: string): boolean {
  const def = RULES.systemActions[key];
  if (!def) return false;
  if (state.player.node === 'vents') return false;
  if (def.node === '@here') return true;
  if (def.node === '@spines') return MAP.spines.includes(state.player.node);
  return def.node === state.player.node;
}

function canAfford(state: GameState, key: string): boolean {
  const def = RULES.systemActions[key];
  if (!def) return false;
  return state.player.ap >= def.ap && state.ship.power >= def.power;
}

export function requirementMet(state: GameState, c: Card): boolean {
  const r = c.requires;
  if (!r) return true;
  if (state.player.node === 'vents') return false;
  if (r.node !== undefined && r.node !== state.player.node) return false;
  if (r.ventAccess === true && !node(state.player.node).vent) return false;
  if (r.threatHere === true && !state.threats.some((t) => t.node === state.player.node)) return false;
  if (r.unsearched === true && salvageLeft(state, state.player.node) === 0) return false;
  return true;
}

export function playable(state: GameState, uid: Uid): boolean {
  const c = cardOf(uid);
  if (c.role === 'infection') return false;
  if (state.player.ap < cardCost(state, uid)) return false;
  if (c.weapon === true && isSpent(state, uid)) return false;
  if (state.player.node === 'vents') return false;
  return requirementMet(state, c);
}

/** Is there anything left to cut out, and is this the place to do it? */
export function canCure(state: GameState): boolean {
  return state.player.hand.concat(state.player.deck, state.player.discard).some(isInfection);
}

/** The single canonical list of everything the player may do. */
export function legalActions(state: GameState): Action[] {
  if (state.status !== 'active') return [];
  const out: Action[] = [];
  const p = state.player;

  // A wound takes something you could have done with it. Infection is what the
  // wound leaves behind, so it is never on the table here.
  if (state.phase === 'wound') {
    for (const uid of p.hand) if (!isInfection(uid)) out.push({ t: 'burn', uid });
    return out;
  }

  if (p.node === 'vents') {
    if (p.ap >= (RULES.basicActions.ventExit?.ap ?? 1)) {
      for (const v of VENT_NODES) out.push({ t: 'ventExit', to: v });
    }
    if (p.ap >= discardCost(state)) {
      for (const uid of p.hand) out.push({ t: 'discard', uid });
    }
    out.push({ t: 'endTurn' });
    return out;
  }

  const here = p.node;
  const adj = neighbours(state, here);

  if (p.ap >= (RULES.basicActions.move?.ap ?? 1)) for (const n of adj) out.push({ t: 'move', to: n });
  if (p.ap >= creepCost(state)) for (const n of adj) out.push({ t: 'creep', to: n });
  if (p.ap >= listenCost(state)) out.push({ t: 'listen' });
  if (p.ap >= (RULES.basicActions.search?.ap ?? 1) && salvageLeft(state, here) > 0) {
    out.push({ t: 'search' });
  }
  // Bracing twice is not twice as braced. One set of the shoulders an hour,
  // and the cards that ward are what stack on top of it.
  if (p.ap >= (RULES.basicActions.brace?.ap ?? 1) && p.wardsThisTurn === 0) {
    out.push({ t: 'brace' });
  }
  if (p.ap >= discardCost(state)) {
    for (const uid of p.hand) out.push({ t: 'discard', uid });
  }
  if (p.ap >= (RULES.basicActions.ventEnter?.ap ?? 1) && node(here).vent) {
    out.push({ t: 'ventEnter' });
  }

  for (const uid of p.hand) {
    if (!playable(state, uid)) continue;
    const c = cardOf(uid);
    const kind = targetKind(c.effect);
    switch (kind) {
      case null:
        out.push({ t: 'play', uid });
        break;
      case 'node':
        for (const n of adj) out.push({ t: 'play', uid, to: n });
        break;
      case 'anyNode':
        for (const n of NODE_IDS) if (n !== here) out.push({ t: 'play', uid, to: n });
        break;
      case 'vent':
        for (const v of VENT_NODES) if (v !== here) out.push({ t: 'play', uid, to: v });
        break;
      case 'edge':
        for (const e of ALL_EDGES) out.push({ t: 'play', uid, edge: [e[0], e[1]] });
        break;
      case 'edgeHere':
        for (const n of adj) out.push({ t: 'play', uid, edge: [here, n] });
        break;
      case 'threat':
        for (const th of state.threats) {
          if (th.node === here) out.push({ t: 'play', uid, threat: th.id });
        }
        break;
      case 'spent':
        for (const s of p.spent) out.push({ t: 'play', uid, target: s });
        break;
    }
  }

  if (systemAt(state, 'repair') && canAfford(state, 'repair') && state.ship.reactorOutput < RULES.reactorOutputMax) {
    out.push({ t: 'repair' });
  }
  if (systemAt(state, 'seal') && canAfford(state, 'seal')) {
    for (const n of adj) out.push({ t: 'seal', edge: [here, n] });
  }
  if (systemAt(state, 'purgeVents') && canAfford(state, 'purgeVents')) out.push({ t: 'purgeVents' });
  if (systemAt(state, 'cure') && canAfford(state, 'cure') && canCure(state)) out.push({ t: 'cure' });
  if (systemAt(state, 'recharge') && canAfford(state, 'recharge')) {
    for (const s of p.spent) out.push({ t: 'recharge', target: s });
  }
  if (systemAt(state, 'chargeShuttle') && canAfford(state, 'chargeShuttle') && state.ship.power > 0) {
    const need = shuttleRequirement(state.role, state.depth) - state.ship.shuttleCharge;
    const max = Math.min(state.ship.power, Math.max(need, 0));
    for (let n = 1; n <= max; n++) out.push({ t: 'chargeShuttle', n });
  }
  if (systemAt(state, 'beacon') && canAfford(state, 'beacon') && !state.ship.beaconSent) {
    out.push({ t: 'beacon' });
  }
  if (
    systemAt(state, 'takeSpecimen') &&
    canAfford(state, 'takeSpecimen') &&
    !state.ship.specimenTaken
  ) {
    out.push({ t: 'takeSpecimen' });
  }
  if (systemAt(state, 'upload') && canAfford(state, 'upload') && p.carryingSpecimen) {
    out.push({ t: 'upload' });
  }
  if (systemAt(state, 'armScuttle') && canAfford(state, 'armScuttle') && !state.ship.scuttleArmed) {
    out.push({ t: 'armScuttle' });
  }
  if (
    systemAt(state, 'launch') &&
    canAfford(state, 'launch') &&
    state.ship.shuttleCharge >= shuttleRequirement(state.role, state.depth)
  ) {
    out.push({ t: 'launch' });
  }

  out.push({ t: 'endTurn' });
  return out;
}

export type Cost = { ap: number; power: number; noise: number };

/**
 * What an action costs, with the noise the player will actually make (the
 * infection surcharge included). The UI shows this before every confirmation.
 */
export function actionCost(state: GameState, a: Action): Cost {
  const basic = (key: string): Cost => ({
    ap: RULES.basicActions[key]?.ap ?? 0,
    power: 0,
    noise: RULES.basicActions[key]?.noise ?? 0,
  });
  const system = (key: string): Cost => ({
    ap: RULES.systemActions[key]?.ap ?? 0,
    power: RULES.systemActions[key]?.power ?? 0,
    noise: RULES.systemActions[key]?.noise ?? 0,
  });
  let cost: Cost;
  switch (a.t) {
    case 'move':
    case 'search':
    case 'brace':
    case 'ventEnter':
    case 'ventExit':
      cost = basic(a.t);
      break;
    case 'discard':
      cost = { ap: discardCost(state), power: 0, noise: 0 };
      break;
    case 'creep':
      cost = { ap: creepCost(state), power: 0, noise: creepNoise(state) };
      break;
    case 'listen':
      cost = { ap: listenCost(state), power: 0, noise: 0 };
      break;
    case 'play': {
      const c = cardOf(a.uid);
      cost = { ap: cardCost(state, a.uid), power: 0, noise: c.noise };
      break;
    }
    case 'burn':
    case 'endTurn':
      cost = { ap: 0, power: 0, noise: 0 };
      break;
    case 'chargeShuttle':
      cost = { ...system('chargeShuttle'), power: a.n };
      break;
    default:
      cost = system(a.t);
  }
  if (cost.noise > 0) cost.noise += holding(state, 'inf_sweat') ? 1 : 0;
  return cost;
}

export function actionKey(a: Action): string {
  switch (a.t) {
    case 'play':
      return `play:${cardIdOf(a.uid)}`;
    case 'discard':
      return `discard:${cardIdOf(a.uid)}`;
    case 'burn':
      return `burn:${cardIdOf(a.uid)}`;
    case 'chargeShuttle':
      return 'chargeShuttle';
    default:
      return a.t;
  }
}

export function describe(a: Action): string {
  switch (a.t) {
    case 'move':
      return `WALK TO ${node(a.to).name}`;
    case 'creep':
      return `CREEP TO ${node(a.to).name}`;
    case 'listen':
      return 'LISTEN AT THE BULKHEAD';
    case 'search':
      return 'SEARCH THIS COMPARTMENT';
    case 'brace':
      return 'SET YOURSELF AGAINST THE FRAME';
    case 'discard':
      return `SET ASIDE ${cardOf(a.uid).name}`;
    case 'burn':
      return `GIVE UP ${cardOf(a.uid).name}`;
    case 'play':
      return card(cardIdOf(a.uid)).name;
    case 'ventEnter':
      return 'INTO THE VENTS';
    case 'ventExit':
      return `COME OUT IN ${node(a.to).name}`;
    case 'repair':
      return 'REPAIR THE REACTOR';
    case 'seal':
      return `DROP THE BULKHEAD TO ${node(a.edge[1]).name}`;
    case 'purgeVents':
      return 'FLOOD THE VENTS';
    case 'cure':
      return 'CUT THE INFECTION OUT';
    case 'recharge':
      return `REFILL ${cardOf(a.target).name}`;
    case 'chargeShuttle':
      return `BANK ${a.n} INTO THE SHUTTLE`;
    case 'beacon':
      return 'BROADCAST';
    case 'takeSpecimen':
      return 'CUT THE SPECIMEN FREE';
    case 'upload':
      return 'UPLOAD THE SPECIMEN';
    case 'armScuttle':
      return 'ARM THE OVERLOAD';
    case 'launch':
      return 'LAUNCH';
    case 'endTurn':
      return 'WAIT OUT THE HOUR';
  }
}

/**
 * What an action is for, in the player's terms, and what it will cost them
 * that the cost line does not already say. Shown under the button.
 */
export function consequence(state: GameState, a: Action): string | null {
  switch (a.t) {
    case 'move':
      return `Fast, and heard ${RULES.basicActions.move?.noise ?? 3} compartments away.`;
    case 'creep':
      return `Slow. Heard ${creepNoise(state)} compartment${creepNoise(state) === 1 ? '' : 's'} away, and no further.`;
    case 'listen':
      return `Names everything within ${RULES.listenRange} compartments and what it is doing.`;
    case 'brace':
      return 'The next thing that reaches you this hour does not land.';
    case 'discard':
      return state.player.freeCardUsed
        ? 'Out of hand and back into your kit. It will come round again.'
        : 'Free this hour: out of hand, back into your kit, and something else comes to hand.';
    case 'seal':
      return `Shut for ${RULES.systemActions.seal?.turns ?? 3} hours. A CRAWLER ignores it; the MOTHER takes an hour to break it.`;
    case 'purgeVents':
      return 'Kills every CRAWLER in the ducts and holds the MOTHER there two hours.';
    case 'cure':
      return 'One infection leaves your kit for good. No wound, no roll.';
    case 'beacon':
      return `Then sit at the set for ${relayHold(state.depth)} hours at ${RULES.systemActions.beacon?.drain ?? 1} power an hour. The watch only runs while you are in COMMS.`;
    case 'takeSpecimen':
      return 'It calls to everything aboard for as long as you carry it.';
    case 'upload':
      return 'This finishes the run.';
    case 'armScuttle':
      return `Then survive ${state.depth === 1 ? 4 : 5} hours. You cannot call it back.`;
    case 'launch':
      return `Off the ship. Carrying ${infectionThreshold(state.depth)} or more infection makes it a CARRIER.`;
    default:
      return null;
  }
}
