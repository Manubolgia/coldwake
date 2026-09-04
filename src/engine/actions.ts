import { ALL_EDGES, MAP, NODE_IDS, RULES, VENT_NODES, card, node } from './content';
import { cardIdOf, cardOf, isSpent } from './deck';
import { neighbours } from './graph';
import { shuttleRequirement } from './state';
import type { Action, Card, EffectSpec, GameState, NodeId, Uid } from './types';

export type TargetKind = 'node' | 'edge' | 'edgeHere' | 'threat' | 'vent' | 'spent' | 'other' | null;

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
      return effect.scope === 'target' ? 'other' : null;
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

/** TUNNEL VISION in hand makes listening cost double (§5.3). */
export function listenCost(state: GameState): number {
  const base = RULES.basicActions.listen?.ap ?? 1;
  return state.player.hand.some((u) => cardIdOf(u) === 'panic_tunnel') ? base + 1 : base;
}

export function salvageLeft(state: GameState, id: NodeId): number {
  return state.ship.salvage[id]?.length ?? 0;
}

export function systemAt(state: GameState, key: string): boolean {
  const def = RULES.systemActions[key];
  if (!def) return false;
  if (state.player.node === 'vents') return false;
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
  if (c.role === 'panic') return false;
  if (state.player.ap < c.ap) return false;
  if (c.weapon === true && isSpent(state, uid)) return false;
  if (state.player.node === 'vents') return false;
  return requirementMet(state, c);
}

/**
 * §7 rule 5: the single canonical list of everything the player may do.
 * The UI and every bot consume this and nothing else.
 */
export function legalActions(state: GameState): Action[] {
  if (state.status !== 'active') return [];
  const out: Action[] = [];
  const p = state.player;

  if (state.phase === 'wound') {
    for (const uid of p.hand) out.push({ t: 'burn', uid });
    return out;
  }

  if (p.node === 'vents') {
    if (p.ap >= (RULES.basicActions.ventExit?.ap ?? 1)) {
      for (const v of VENT_NODES) out.push({ t: 'ventExit', to: v });
    }
    if (p.ap >= (RULES.basicActions.discard?.ap ?? 1)) {
      for (const uid of p.hand) out.push({ t: 'discard', uid });
    }
    out.push({ t: 'endTurn' });
    return out;
  }

  const here = p.node;
  const adj = neighbours(state, here);

  if (p.ap >= (RULES.basicActions.move?.ap ?? 1)) for (const n of adj) out.push({ t: 'move', to: n });
  if (p.ap >= (RULES.basicActions.creep?.ap ?? 2)) for (const n of adj) out.push({ t: 'creep', to: n });
  if (p.ap >= listenCost(state)) out.push({ t: 'listen' });
  if (p.ap >= (RULES.basicActions.search?.ap ?? 1) && salvageLeft(state, here) > 0) {
    out.push({ t: 'search' });
  }
  if (p.ap >= (RULES.basicActions.discard?.ap ?? 1)) {
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
      case 'other':
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
  if (systemAt(state, 'carryScan') && canAfford(state, 'carryScan')) {
    p.carry.forEach((c, i) => {
      if (!c.revealed) out.push({ t: 'carryScan', index: i });
    });
  }
  if (systemAt(state, 'purgeBlood') && canAfford(state, 'purgeBlood')) {
    p.carry.forEach((c, i) => {
      if (!c.revealed) out.push({ t: 'purgeBlood', index: i });
    });
  }
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
 * What an action costs, with the noise the player will actually make (panic
 * surcharge included). The UI shows this before every confirmation — §11.
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
    case 'creep':
    case 'search':
    case 'discard':
    case 'ventEnter':
    case 'ventExit':
      cost = basic(a.t);
      break;
    case 'listen':
      cost = { ap: listenCost(state), power: 0, noise: 0 };
      break;
    case 'play': {
      const c = cardOf(a.uid);
      cost = { ap: c.ap, power: 0, noise: c.noise };
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
  if (cost.noise > 0) cost.noise += state.player.hand.some((u) => cardIdOf(u) === 'panic_sweat') ? 1 : 0;
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
      return `MOVE ${node(a.to).name}`;
    case 'creep':
      return `CREEP ${node(a.to).name}`;
    case 'listen':
      return 'LISTEN';
    case 'search':
      return 'SEARCH';
    case 'discard':
      return `DISCARD ${cardOf(a.uid).name}`;
    case 'burn':
      return `BURN ${cardOf(a.uid).name}`;
    case 'play':
      return card(cardIdOf(a.uid)).name;
    case 'ventEnter':
      return 'ENTER VENTS';
    case 'ventExit':
      return `EXIT AT ${node(a.to).name}`;
    case 'repair':
      return 'REPAIR REACTOR';
    case 'seal':
      return `SEAL ${node(a.edge[1]).name}`;
    case 'purgeVents':
      return 'PURGE VENTS';
    case 'carryScan':
      return 'CARRY SCAN';
    case 'purgeBlood':
      return 'PURGE BLOOD';
    case 'recharge':
      return `RECHARGE ${cardOf(a.target).name}`;
    case 'chargeShuttle':
      return `CHARGE SHUTTLE ${a.n}`;
    case 'beacon':
      return 'BEACON';
    case 'armScuttle':
      return 'ARM SCUTTLE';
    case 'launch':
      return 'LAUNCH';
    case 'endTurn':
      return 'END TURN';
  }
}
