import { MAP, RULES, SALVAGE, VENT_NODES, card, node, threatDef } from './content';
import { cardOf, drawOne, isPanic, makeUid, nonPanicCount, removeFromHand, removePanic } from './deck';
import { neighbours } from './graph';
import { assertInvariants } from './invariants';
import { addNoise, bagDraw, decayNoise, makeNoise, noisePhase } from './noise';
import { rollD6 } from './rng';
import { resolveRun } from './scoring';
import { cloneState, drawUpToHandSize, noiseFloor, shuttleRequirement, turnLimit } from './state';
import { burnRandomOwned, drawCarry, killThreat, threatPhase, wound } from './threats';
import { attackPenalty, listenCost, playable, salvageLeft, systemAt } from './actions';
import { arrival, bloodLine, chargeLine, foundLine, hourLine, lost, missLine, say, sweepReport, where } from './voice';
import type { Action, EffectSpec, GameState, NodeId, Threat, Uid } from './types';

export class IllegalActionError extends Error {}

let checkInvariants = true;
/** Turned off for the production UI bundle, on everywhere it matters. */
export function setInvariantChecking(on: boolean): void {
  checkInvariants = on;
}

function fail(msg: string): never {
  throw new IllegalActionError(msg);
}

function payAp(state: GameState, n: number): void {
  if (state.player.ap < n) fail(`not enough AP for ${n}`);
  state.player.ap -= n;
}

function payPower(state: GameState, n: number): void {
  if (state.ship.power < n) fail(`not enough power for ${n}`);
  state.ship.power -= n;
}

function gainPower(state: GameState, n: number): void {
  state.ship.power = Math.max(0, Math.min(RULES.powerCap, state.ship.power + n));
}

function moveTo(state: GameState, to: NodeId): void {
  if (state.player.node === 'vents') fail('cannot walk from the vents');
  if (!neighbours(state, state.player.node).includes(to)) fail(`not adjacent: ${to}`);
  state.player.node = to;
}

function sealEdge(state: GameState, edge: [NodeId, NodeId], turns: number): void {
  const [a, b] = edge;
  if (!neighbours(state, a, false).includes(b)) fail(`no such edge: ${a}-${b}`);
  state.ship.sealedEdges.push({ edge: [a, b], expiresTurn: state.turn + turns });
  state.feed.push({
    turn: state.turn,
    kind: 'player',
    text: `>> The bulkhead comes down between ${node(a).name} and ${node(b).name}. Nothing crosses it, including you.`,
  });
}

function pushThreat(state: GameState, threatId: string): void {
  const t = state.threats.find((x) => x.id === threatId);
  if (!t || t.node === 'vents') fail('no such threat here');
  const options = neighbours(state, t.node);
  // Pushed toward the quietest adjacent node; canonical order breaks ties.
  const best = options
    .slice()
    .sort((a, b) => (state.ship.noise[a] ?? 0) - (state.ship.noise[b] ?? 0))[0];
  if (best !== undefined) t.node = best;
}

function resolveSalvage(state: GameState, entryId: string): void {
  const [cardId, indexRaw] = entryId.split('#');
  const index = Number(indexRaw ?? '0');
  const def = card(cardId ?? '');
  const entry = SALVAGE.deck[index];
  if (def.weapon === true) {
    // A found weapon joins the deck rather than firing itself.
    const uid = makeUid(def.id, index);
    state.player.discard.push(uid);
    state.feed.push({ turn: state.turn, kind: 'player', text: `${foundLine(state, def.name)} It goes on your belt.` });
    return;
  }
  state.feed.push({ turn: state.turn, kind: 'player', text: foundLine(state, def.name) });
  if (entry?.log !== undefined) {
    state.feed.push({ turn: state.turn, kind: 'sys', text: entry.log });
  }
  applyEffect(state, def.effect, {});
}

type Ctx = { to?: NodeId; edge?: [NodeId, NodeId]; threat?: string; target?: Uid; uid?: Uid };

function applyEffect(state: GameState, effect: EffectSpec, ctx: Ctx): void {
  switch (effect.op) {
    case 'none':
      return;
    case 'gainPower':
      gainPower(state, effect.n);
      say(state, 'player', `>> The pool takes it. ${state.ship.power} power.`);
      return;
    case 'gainAp':
      state.player.ap += effect.n;
      say(state, 'player', '>> You find another minute inside the hour.');
      return;
    case 'move':
      if (ctx.to === undefined) fail('move needs a destination');
      moveTo(state, ctx.to);
      if (!effect.silent) makeNoise(state, RULES.basicActions.move?.noise ?? 2);
      return;
    case 'draw': {
      const before = state.player.hand.length;
      for (let i = 0; i < effect.n; i++) drawOne(state);
      const drew = state.player.hand.length - before;
      if (drew > 0) {
        say(state, 'player', `>> ${drew === 1 ? 'One more thing comes' : `${drew} more things come`} to hand.`);
      }
      return;
    }
    case 'attack': {
      const t = state.threats.find((x) => x.id === ctx.threat);
      if (!t || t.node !== state.player.node) fail('no target here');
      const [roll, rng] = rollD6(state.rng);
      state.rng = rng;
      const penalty = attackPenalty(state);
      const total = roll + effect.bonus + penalty;
      if (total >= t.hp) {
        killThreat(state, t.id);
      } else {
        if (ctx.uid !== undefined) state.player.spent.push(ctx.uid);
        state.feed.push({
          turn: state.turn,
          kind: 'alarm',
          text: missLine(state, roll, effect.bonus, penalty, t.hp),
        });
      }
      return;
    }
    case 'execute': {
      const t = state.threats.find((x) => x.id === ctx.threat);
      if (!t || t.node !== state.player.node) fail('no target here');
      killThreat(state, t.id);
      return;
    }
    case 'pushThreat': {
      if (ctx.threat === undefined) fail('push needs a target');
      const pushed = state.threats.find((x) => x.id === ctx.threat);
      pushThreat(state, ctx.threat);
      if (pushed) say(state, 'player', `>> You drive it back into ${where(pushed.node)}.`);
      return;
    }
    case 'sealEdge': {
      if (ctx.edge === undefined) fail('seal needs an edge');
      if (!effect.anywhere && !ctx.edge.includes(state.player.node as NodeId)) {
        fail('that edge is not here');
      }
      sealEdge(state, ctx.edge, effect.turns);
      return;
    }
    case 'setNoise': {
      if (effect.scope === 'all') {
        for (const id of Object.keys(state.ship.noise)) {
          state.ship.noise[id] = Math.max(noiseFloor(state.depth, id), effect.n);
        }
      } else if (state.player.node !== 'vents') {
        state.ship.noise[state.player.node] = Math.max(
          noiseFloor(state.depth, state.player.node),
          effect.n,
        );
      }
      say(
        state,
        'player',
        effect.scope === 'all' ? '>> Every compartment falls quiet at once.' : '>> It goes quiet in here.',
      );
      return;
    }
    case 'addNoise': {
      const target = effect.scope === 'target' ? ctx.to : (state.player.node as NodeId);
      if (target === undefined || target === 'vents') fail('noise needs a node');
      addNoise(state, target, effect.n);
      say(
        state,
        'player',
        effect.scope === 'target'
          ? `>> It lands in ${where(target)} and keeps shouting.`
          : '>> That was loud.',
      );
      return;
    }
    case 'preventWound':
      state.player.wardsThisTurn += 1;
      say(state, 'player', '>> You set yourself. The next one will not land.');
      return;
    case 'reactorOutput':
      state.ship.reactorOutput = Math.min(
        RULES.reactorOutputMax,
        Math.max(0, state.ship.reactorOutput + effect.n),
      );
      say(state, 'player', `>> The reactor holds at ${state.ship.reactorOutput} an hour.`);
      return;
    case 'recharge': {
      const uid = ctx.target;
      if (uid === undefined) fail('recharge needs a spent weapon');
      const i = state.player.spent.indexOf(uid);
      if (i < 0) fail('that weapon is not spent');
      state.player.spent.splice(i, 1);
      say(state, 'player', `>> ${cardOf(uid).name} is loaded again.`);
      return;
    }
    case 'removePanic':
      for (let i = 0; i < effect.n; i++) {
        const gone = removePanic(state);
        if (gone !== undefined) say(state, 'player', `>> ${cardOf(gone).name} passes. You breathe.`);
      }
      return;
    case 'revealCarry': {
      for (let i = 0; i < effect.n; i++) {
        const c = state.player.carry.find((x) => !x.revealed);
        if (!c) break;
        c.revealed = true;
        state.stats.scans += 1;
        state.feed.push({
          turn: state.turn,
          kind: c.id === 'infested' ? 'alarm' : 'sys',
          text:
            c.id === 'infested'
              ? '>> The sample reads infested. It is already in you.'
              : '>> The sample reads clean. That one, anyway.',
        });
      }
      return;
    }
    case 'discardCarry': {
      for (let i = 0; i < effect.n; i++) {
        const idx = state.player.carry.findIndex((x) => !x.revealed);
        if (idx < 0) break;
        state.player.carry.splice(idx, 1);
        say(state, 'player', '>> A sample goes down the drain unread.');
      }
      return;
    }
    case 'drawCarry':
      drawCarry(state, effect.n);
      say(state, 'alarm', '>> You are bleeding. Another sample goes in the rack.');
      return;
    case 'chargeShuttle': {
      const n = Math.min(effect.n, state.ship.power);
      state.ship.power -= n;
      state.ship.shuttleCharge += n;
      return;
    }
    case 'ventEnter':
      if (state.player.node === 'vents' || !node(state.player.node).vent) fail('no vent access here');
      state.player.node = 'vents';
      return;
    case 'ventJump': {
      if (ctx.to === undefined || !VENT_NODES.includes(ctx.to)) fail('no vent access there');
      state.player.node = ctx.to;
      return;
    }
    case 'search':
      doSearch(state);
      return;
    case 'listen':
      state.bagKnownTurn = state.turn;
      return;
    case 'score':
      state.stats.salvageScore += effect.n;
      say(state, 'sys', '>> Logged. Somebody should know they were here.');
      return;
    case 'sequence':
      for (const step of effect.steps) applyEffect(state, step, ctx);
      return;
  }
}

function doSearch(state: GameState): void {
  if (state.player.node === 'vents') fail('cannot search the vents');
  const here = state.player.node;
  const pile = state.ship.salvage[here];
  if (!pile || pile.length === 0) fail('nothing left here');
  const entry = pile.shift() as string;
  if (!state.ship.searched.includes(here)) state.ship.searched.push(here);
  resolveSalvage(state, entry);
}

function finishTurn(state: GameState): void {
  if (state.status !== 'active') return;
  // Unplayed cards do not carry over (§4.3).
  state.player.discard.push(...state.player.hand);
  state.player.hand = [];
  state.player.wardsThisTurn = 0;
  state.player.combatPenalty = 0;
  state.resumeEndTurn = false;

  gainPower(state, state.ship.reactorOutput);
  decayNoise(state);
  state.ship.sealedEdges = state.ship.sealedEdges.filter((e) => e.expiresTurn > state.turn);

  if (state.turn >= turnLimit(state.depth)) {
    state.feed.push({ turn: state.turn, kind: 'alarm', text: '>> The orbit closes. The hull is getting warm.' });
    resolveRun(state, 'timeout');
    return;
  }

  state.turn += 1;
  state.player.ap = RULES.apPerTurn;
  drawUpToHandSize(state);
  say(state, 'sys', hourLine(state));
}

function endTurn(state: GameState): void {
  const { extraActivation } = noisePhase(state);
  if (state.status !== 'active') return;
  threatPhase(state, extraActivation ? 2 : 1);
  if (state.status !== 'active') return;
  if (state.player.pendingWounds > 0) {
    state.resumeEndTurn = true;
    return;
  }
  finishTurn(state);
}

function resolveBurn(state: GameState, uid: Uid): void {
  if (isPanic(uid)) fail('panic is not a capability; a wound cannot take it');
  if (!removeFromHand(state, uid)) fail('that card is not in hand');
  state.player.burned.push(uid);
  state.player.pendingWounds -= 1;
  state.feed.push({ turn: state.turn, kind: 'alarm', text: lost(uid) });
  // A further wound with nothing left worth choosing between takes one at
  // random, from the kit rather than from the panic the wounds have left —
  // and when the kit holds nothing you could still do, the run is over here
  // rather than leaving a debt that quietly lapses.
  while (state.player.pendingWounds > 0 && !state.player.hand.some((u) => !isPanic(u))) {
    if (nonPanicCount(state) === 0) {
      state.player.pendingWounds = 0;
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: '>> It wants one more thing from you and there is nothing left to give up.',
      });
      resolveRun(state, 'death');
      return;
    }
    const taken = burnRandomOwned(state);
    if (taken !== undefined) state.feed.push({ turn: state.turn, kind: 'alarm', text: lost(taken) });
    state.player.pendingWounds -= 1;
  }
  if (state.player.pendingWounds === 0) {
    state.phase = 'action';
    if (state.resumeEndTurn) finishTurn(state);
  }
}

function playCard(state: GameState, action: Extract<Action, { t: 'play' }>): void {
  const uid = action.uid;
  if (!state.player.hand.includes(uid)) fail('that card is not in hand');
  if (!playable(state, uid)) fail('that card cannot be played now');
  const c = cardOf(uid);
  payAp(state, c.ap);
  makeNoise(state, c.noise);
  removeFromHand(state, uid);
  const ctx: Ctx = { uid };
  if (action.to !== undefined) ctx.to = action.to;
  if (action.edge !== undefined) ctx.edge = action.edge;
  if (action.threat !== undefined) ctx.threat = action.threat;
  if (action.target !== undefined) ctx.target = action.target;
  say(state, 'player', `>> ${c.name}.`);
  applyEffect(state, c.effect, ctx);
  if (c.burn) {
    state.player.burned.push(uid);
    say(state, 'sys', `>> That was the only ${c.name} you had.`);
  } else {
    state.player.discard.push(uid);
  }
}

function ventExit(state: GameState, to: NodeId): void {
  if (state.player.node !== 'vents') fail('not in the vents');
  if (!VENT_NODES.includes(to)) fail('no vent access there');
  payAp(state, RULES.basicActions.ventExit?.ap ?? 1);
  state.player.node = to;
  state.stats.ventTransits += 1;
  const before = state.threats.length;
  const token = bagDraw(state, to);
  if (token !== 'blank' && token !== 'empty' && state.threats.length > before) {
    const t = state.threats[state.threats.length - 1] as Threat;
    state.player.combatPenalty = RULES.ventAmbushPenalty;
    state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text: '>> It was waiting in the duct. You cannot swing properly in here.',
    });
    wound(state, threatDef(t.type).damage, `${threatDef(t.type).name} AMBUSH`);
  }
}

function systemAction(state: GameState, action: Action): void {
  const key = action.t;
  const def = RULES.systemActions[key];
  if (!def) fail(`unknown system action ${key}`);
  if (!systemAt(state, key)) fail(`wrong node for ${key}`);
  payAp(state, def.ap);
  payPower(state, def.power);
  makeNoise(state, def.noise);

  switch (action.t) {
    case 'repair':
      state.ship.reactorOutput = Math.min(RULES.reactorOutputMax, state.ship.reactorOutput + 1);
      state.feed.push({ turn: state.turn, kind: 'player', text: `>> The reactor holds at ${state.ship.reactorOutput} an hour.` });
      return;
    case 'seal':
      // "Block one edge from this node" — not any edge on the ship.
      if (!action.edge.includes(state.player.node as NodeId)) fail('that edge is not here');
      sealEdge(state, action.edge, def.turns ?? 3);
      return;
    case 'purgeVents': {
      const inVents = state.threats.filter((t) => t.node === 'vents');
      for (const t of inVents) killThreat(state, t.id);
      state.feed.push({ turn: state.turn, kind: 'player', text: inVents.length === 0 ? '>> The vents flood. Nothing was in them.' : `>> The vents flood. ${inVents.length} cooked in the ducts.` });
      return;
    }
    case 'carryScan': {
      const c = state.player.carry[action.index];
      if (!c || c.revealed) fail('nothing to scan there');
      c.revealed = true;
      state.stats.scans += 1;
      const known = state.player.carry.filter((x) => x.revealed && x.id === 'infested').length;
      state.feed.push({
        turn: state.turn,
        kind: c.id === 'infested' ? 'alarm' : 'sys',
        text: bloodLine(c.id === 'infested', known, RULES.carry.carrierThreshold),
      });
      return;
    }
    case 'purgeBlood': {
      const c = state.player.carry[action.index];
      if (!c || c.revealed) fail('that sample is already read');
      state.player.carry.splice(action.index, 1);
      state.feed.push({
        turn: state.turn,
        kind: 'player',
        text:
          '>> The line runs red, and then clear. That sample is gone unread and does not come back — ' +
          `${state.player.carry.length} left aboard. It costs you, the way everything here costs you.`,
      });
      wound(state, 1, 'PURGE', false);
      return;
    }
    case 'recharge': {
      const i = state.player.spent.indexOf(action.target);
      if (i < 0) fail('that weapon is not spent');
      state.player.spent.splice(i, 1);
      state.feed.push({ turn: state.turn, kind: 'player', text: `>> ${cardOf(action.target).name} is loaded again.` });
      return;
    }
    case 'chargeShuttle': {
      const n = Math.min(action.n, state.ship.power);
      if (n <= 0) fail('no power to bank');
      state.ship.power -= n;
      state.ship.shuttleCharge += n;
      say(
        state,
        'player',
        chargeLine(state, n, state.ship.shuttleCharge, shuttleRequirement(state.role, state.depth)),
      );
      return;
    }
    case 'beacon':
      state.ship.beaconSent = true;
      state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text: '>> Broadcast away. Thirty-one hours to the relay, and everything aboard heard it too.',
    });
      return;
    case 'armScuttle': {
      state.ship.scuttleArmed = true;
      state.ship.scuttleArmedTurn = state.turn;
      const fuse = RULES.systemActions.armScuttle?.fuseTurns ?? 0;
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: `>> Overload armed. ${fuse} hours to critical, and you cannot call it back.`,
      });
      return;
    }
    case 'launch':
      resolveRun(state, 'launch');
      return;
    default:
      fail(`unhandled system action ${key}`);
  }
}

function apply(state: GameState, action: Action): void {
  if (state.status !== 'active') fail('the run is over');
  if (state.phase === 'wound' && action.t !== 'burn') fail('resolve the wound first');

  switch (action.t) {
    case 'burn':
      resolveBurn(state, action.uid);
      return;
    case 'move':
      payAp(state, RULES.basicActions.move?.ap ?? 1);
      makeNoise(state, RULES.basicActions.move?.noise ?? 2);
      moveTo(state, action.to);
      say(state, 'player', arrival(state, action.to, false));
      return;
    case 'creep':
      payAp(state, RULES.basicActions.creep?.ap ?? 2);
      moveTo(state, action.to);
      say(state, 'player', arrival(state, action.to, true));
      return;
    case 'listen':
      payAp(state, listenCost(state));
      state.bagKnownTurn = state.turn;
      say(state, 'player', sweepReport(state));
      return;
    case 'search': {
      if (state.player.node === 'vents' || salvageLeft(state, state.player.node) === 0) {
        fail('nothing to search');
      }
      payAp(state, RULES.basicActions.search?.ap ?? 1);
      makeNoise(state, RULES.basicActions.search?.noise ?? 2);
      doSearch(state);
      return;
    }
    case 'discard': {
      if (!state.player.hand.includes(action.uid)) fail('that card is not in hand');
      payAp(state, RULES.basicActions.discard?.ap ?? 1);
      removeFromHand(state, action.uid);
      state.player.discard.push(action.uid);
      say(
        state,
        'player',
        isPanic(action.uid)
          ? `>> ${cardOf(action.uid).name} passes. You breathe.`
          : `>> ${cardOf(action.uid).name}, set aside for now.`,
      );
      return;
    }
    case 'play':
      playCard(state, action);
      return;
    case 'ventEnter':
      if (state.player.node === 'vents' || !node(state.player.node).vent) fail('no vent access here');
      payAp(state, RULES.basicActions.ventEnter?.ap ?? 1);
      state.player.node = 'vents';
      say(state, 'player', '>> Into the crawlspace. Nothing can see you in here.');
      return;
    case 'ventExit':
      ventExit(state, action.to);
      return;
    case 'endTurn':
      endTurn(state);
      return;
    default:
      systemAction(state, action);
  }
}

/** §7 rule 3. The only way the state ever changes. */
export function reduce(state: GameState, action: Action): GameState {
  const draft = cloneState(state);
  apply(draft, action);
  draft.log.push({ turn: state.turn, action });
  if (checkInvariants) assertInvariants(draft);
  return draft;
}

/** Replay a log from a fresh state. Used by goldens, tests and bug reports. */
export function replay(initial: GameState, actions: Action[]): GameState {
  let s = initial;
  for (const a of actions) s = reduce(s, a);
  return s;
}

export const START_NODE: NodeId = MAP.start;
