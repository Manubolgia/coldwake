import { MAP, RULES, SALVAGE, VENT_NODES, card, node, threatDef } from './content';
import {
  addInfection,
  capabilityCount,
  cardOf,
  drawOne,
  isInfection,
  makeUid,
  removeFromHand,
  removeInfection,
} from './deck';
import { neighbours } from './graph';
import { assertInvariants } from './invariants';
import { addNoise, advanceHive, alert, bagDraw, decayNoise, lureAt, makeNoise, noisePhase } from './noise';
import { rollD6 } from './rng';
import { relayReady, resolveRun, scuttleReady } from './scoring';
import {
  cloneState,
  drawUpToHandSize,
  fuseTurns,
  infectionThreshold,
  noiseFloor,
  relayHold,
  shuttleRequirement,
  turnLimit,
} from './state';
import {
  burnRandomOwned,
  killThreat,
  noteSightings,
  perceivedIds,
  revealWithin,
  stallAt,
  threatPhase,
  wound,
} from './threats';
import {
  attackPenalty,
  cardCost,
  creepCost,
  creepNoise,
  discardCost,
  listenCost,
  playable,
  salvageLeft,
  systemAt,
} from './actions';
import {
  arrival,
  chargeLine,
  foundLine,
  hourLine,
  lost,
  missLine,
  say,
  sweepReport,
  where,
} from './voice';
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
  say(
    state,
    'player',
    `>> The bulkhead comes down between ${node(a).name} and ${node(b).name}. ` +
      'Nothing walks through it for three hours, including you. A CRAWLER goes around it in the ducts.',
  );
}

function pushThreat(state: GameState, threatId: string): void {
  const t = state.threats.find((x) => x.id === threatId);
  if (!t || t.node === 'vents') fail('no such threat here');
  const options = neighbours(state, t.node);
  const best = options.slice().sort((a, b) => (state.ship.noise[a] ?? 0) - (state.ship.noise[b] ?? 0))[0];
  if (best !== undefined) t.node = best;
}

function resolveSalvage(state: GameState, entryId: string): void {
  const [cardId, indexRaw] = entryId.split('#');
  const index = Number(indexRaw ?? '0');
  const def = card(cardId ?? '');
  const entry = SALVAGE.deck[index];
  if (def.keep === true) {
    // Found gear joins the deck rather than firing itself off where you stand.
    state.player.discard.push(makeUid(def.id, index));
    say(state, 'player', `${foundLine(state, def.name)} It goes in your kit — it will come to hand.`);
    return;
  }
  say(state, 'player', foundLine(state, def.name));
  if (entry?.log !== undefined) say(state, 'sys', entry.log);
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
      say(state, 'player', arrival(state, ctx.to, effect.silent));
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
      if (threatDef(t.type).unkillable === true) {
        killThreat(state, t.id);
        if (ctx.uid !== undefined) state.player.spent.push(ctx.uid);
        return;
      }
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
        say(state, 'player', '>> Every compartment falls quiet at once. Nothing has anything to follow.');
      } else if (state.player.node !== 'vents') {
        state.ship.noise[state.player.node] = Math.max(
          noiseFloor(state.depth, state.player.node),
          effect.n,
        );
        say(state, 'player', '>> It goes quiet in here.');
      }
      return;
    }
    case 'addNoise': {
      const target = effect.scope === 'target' ? ctx.to : (state.player.node as NodeId);
      if (target === undefined || target === 'vents') fail('noise needs a node');
      addNoise(state, target, effect.n);
      alert(state, target, effect.n);
      say(state, 'player', effect.scope === 'target' ? `>> It lands in ${where(target)} and keeps shouting.` : '>> That was loud.');
      return;
    }
    case 'lure': {
      if (ctx.to === undefined) fail('a lure needs somewhere to land');
      const pulled = lureAt(state, ctx.to, effect.n);
      say(
        state,
        'player',
        pulled > 0
          ? `>> It goes off in ${where(ctx.to)}. ${pulled} of them ` +
            `${pulled === 1 ? 'wheels' : 'wheel'} round and ${pulled === 1 ? 'walks' : 'walk'} the wrong way. ` +
            'That is the best news you get today.'
          : `>> It goes off in ${where(ctx.to)}. Nothing close enough to hear it.`,
      );
      return;
    }
    case 'stall': {
      if (state.player.node === 'vents') fail('not from in here');
      const here = state.player.node;
      let held = 0;
      if (effect.scope === 'here') held = stallAt(state, here, effect.n);
      else {
        for (const n of neighbours(state, here, false)) held += stallAt(state, n, effect.n);
      }
      say(
        state,
        'player',
        held > 0
          ? `>> ${held} held where ${held === 1 ? 'it stands' : 'they stand'} for ${effect.n} hours.`
          : '>> Nothing there to hold.',
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
    case 'cure':
      for (let i = 0; i < effect.n; i++) {
        const gone = removeInfection(state);
        if (gone === undefined) break;
        state.stats.cures += 1;
        say(state, 'sys', `>> ${cardOf(gone).name} is out of you and out of the kit. It does not come back.`);
      }
      return;
    case 'infect':
      for (let i = 0; i < effect.n; i++) {
        const got = addInfection(state);
        say(state, 'alarm', `>> Something got on you. ${cardOf(got).name} goes into the kit.`);
      }
      return;
    case 'reveal': {
      const found = revealWithin(state, effect.range);
      say(state, 'player', sweepReport(state, found, effect.range));
      return;
    }
    case 'chargeShuttle': {
      const n = Math.min(effect.n, state.ship.power);
      state.ship.power -= n;
      state.ship.shuttleCharge += n;
      say(
        state,
        'player',
        chargeLine(state, n, state.ship.shuttleCharge, shuttleRequirement(state.role, state.depth)),
      );
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
      say(state, 'player', sweepReport(state, revealWithin(state, RULES.listenRange), RULES.listenRange));
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

/**
 * The relay is a siege, and the siege is simple: you have to be at the
 * transmitter, and the transmitter has to be fed. Nothing else breaks it.
 *
 * It used to break if anything walked into comms, which reads as a rule until
 * you notice comms shares a bulkhead with the nest: measured at 797 blocked
 * hours to intruders against 26 to an empty pool. Something walking in on you
 * already costs a capability. It does not also need to cost the watch.
 */
function relayUpkeep(state: GameState): void {
  if (!state.ship.beaconSent) return;
  const def = RULES.systemActions.beacon;
  const drain = def?.drain ?? 1;
  if (state.player.node !== 'comms') {
    state.feed.push({
      turn: state.turn,
      kind: 'sys',
      text:
        `>> The transmitter wants somebody at it. The watch holds at ${state.ship.relayHeld} of ` +
        `${relayHold(state.depth)} until you are back in COMMS.`,
    });
    return;
  }
  if (state.ship.power < drain) {
    state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text:
        `>> The transmitter wants ${drain} power an hour and the pool is empty. The watch holds at ` +
        `${state.ship.relayHeld} of ${relayHold(state.depth)}. Get the reactor up.`,
    });
    return;
  }
  state.ship.power -= drain;
  state.ship.relayHeld += 1;
  const need = relayHold(state.depth);
  state.feed.push({
    turn: state.turn,
    kind: state.ship.relayHeld >= need ? 'alarm' : 'sys',
    text: `>> The relay holds. ${state.ship.relayHeld} of ${need} hours, ${drain} power an hour.`,
  });
}

function finishTurn(state: GameState): void {
  if (state.status !== 'active') return;
  state.player.wardsThisTurn = 0;
  state.player.combatPenalty = 0;
  state.player.freeCardUsed = false;
  state.resumeEndTurn = false;

  gainPower(state, state.ship.reactorOutput);
  relayUpkeep(state);
  if (relayReady(state)) {
    resolveRun(state, 'objective', 'relay');
    return;
  }

  decayNoise(state);

  // Both of these go on AFTER the hour's decay, or they do not happen at all:
  // at one point an hour they were exactly cancelled by it, and an armed
  // overload made the ship no louder than an unarmed one.
  if (state.ship.scuttleArmed && !scuttleReady(state)) {
    for (const id of Object.keys(state.ship.noise)) addNoise(state, id, RULES.scuttleNoisePerHour);
    const left = fuseTurns(state.depth) - (state.turn - state.ship.scuttleArmedTurn);
    state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text:
        `>> The reactor is screaming and the whole ship can hear it. ${left} hours to critical, ` +
        `and every compartment is ${RULES.scuttleNoisePerHour} louder than it was.`,
    });
  }
  // Whatever you cut out of the hold keeps calling to them.
  if (state.player.carryingSpecimen && state.player.node !== 'vents') {
    addNoise(state, state.player.node, RULES.specimenNoisePerHour);
    alert(state, state.player.node, RULES.specimenNoisePerHour);
  }
  state.ship.sealedEdges = state.ship.sealedEdges.filter((e) => e.expiresTurn > state.turn);
  advanceHive(state, RULES.hivePerHour);

  if (scuttleReady(state)) {
    resolveRun(state, 'objective', 'overload');
    return;
  }
  if (state.turn >= turnLimit(state.depth)) {
    state.feed.push({ turn: state.turn, kind: 'alarm', text: '>> The orbit closes. The hull is getting warm.' });
    resolveRun(state, 'timeout');
    return;
  }

  state.turn += 1;
  state.player.ap = RULES.apPerTurn;
  drawUpToHandSize(state);
  noteSightings(state);
  const near = [...perceivedIds(state)].length > 0;
  say(state, 'sys', hourLine(state, near));
}

function endTurn(state: GameState): void {
  noisePhase(state);
  if (state.status !== 'active') return;
  threatPhase(state);
  if (state.status !== 'active') return;
  if (state.player.pendingWounds > 0) {
    state.resumeEndTurn = true;
    return;
  }
  finishTurn(state);
}

function resolveBurn(state: GameState, uid: Uid): void {
  if (isInfection(uid)) fail('infection is not a capability; a wound cannot take it');
  if (!removeFromHand(state, uid)) fail('that card is not in hand');
  state.player.burned.push(uid);
  state.player.pendingWounds -= 1;
  state.feed.push({ turn: state.turn, kind: 'alarm', text: lost(uid) });
  while (state.player.pendingWounds > 0 && !state.player.hand.some((u) => !isInfection(u))) {
    if (capabilityCount(state) === 0) {
      state.player.pendingWounds = 0;
      state.feed.push({
        turn: state.turn,
        kind: 'alarm',
        text: '>> It wants one more thing from you and there is nothing left to give up.',
      });
      resolveRun(state, 'attrition');
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
  const cost = cardCost(state, uid);
  payAp(state, cost);
  if (cost === 0) state.player.freeCardUsed = true;
  makeNoise(state, c.noise);
  removeFromHand(state, uid);
  const ctx: Ctx = { uid };
  if (action.to !== undefined) ctx.to = action.to;
  if (action.edge !== undefined) ctx.edge = action.edge;
  if (action.threat !== undefined) ctx.threat = action.threat;
  if (action.target !== undefined) ctx.target = action.target;
  state.stats.cardsPlayed += 1;
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
  if (token !== 'blank' && token !== 'empty' && token !== 'capped' && state.threats.length > before) {
    const t = state.threats[state.threats.length - 1] as Threat;
    state.player.combatPenalty = RULES.ventAmbushPenalty;
    state.feed.push({
      turn: state.turn,
      kind: 'alarm',
      text: '>> It was waiting at the hatch. You cannot swing properly coming out of a duct.',
    });
    wound(state, threatDef(t.type).damage, `${threatDef(t.type).name} AT THE HATCH`);
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
      say(state, 'player', `>> The reactor holds at ${state.ship.reactorOutput} an hour.`);
      return;
    case 'seal':
      if (!action.edge.includes(state.player.node as NodeId)) fail('that edge is not here');
      sealEdge(state, action.edge, def.turns ?? 3);
      return;
    case 'purgeVents': {
      const inVents = state.threats.filter((t) => t.node === 'vents');
      const mother = inVents.find((t) => t.type === 'mother');
      for (const t of inVents) if (t.type !== 'mother') killThreat(state, t.id);
      if (mother !== undefined) mother.stalled = Math.max(mother.stalled, RULES.motherPurgeStall);
      const killed = inVents.filter((t) => t.type !== 'mother').length;
      say(
        state,
        'player',
        killed === 0 && mother === undefined
          ? '>> The vents flood. Nothing was in them.'
          : `>> The vents flood.${killed > 0 ? ` ${killed} cooked in the ducts.` : ''}` +
              (mother !== undefined
                ? ` It does not kill the MOTHER. It does hold it in there for ${RULES.motherPurgeStall} hours.`
                : ''),
      );
      return;
    }
    case 'cure':
      applyEffect(state, { op: 'cure', n: 1 }, {});
      return;
    case 'recharge': {
      const i = state.player.spent.indexOf(action.target);
      if (i < 0) fail('that weapon is not spent');
      state.player.spent.splice(i, 1);
      say(state, 'player', `>> ${cardOf(action.target).name} is loaded again.`);
      return;
    }
    case 'chargeShuttle': {
      const n = Math.min(action.n, state.ship.power);
      if (n <= 0) fail('no power to bank');
      state.ship.power -= n;
      state.ship.shuttleCharge += n;
      say(state, 'player', chargeLine(state, n, state.ship.shuttleCharge, shuttleRequirement(state.role, state.depth)));
      return;
    }
    case 'beacon':
      state.ship.beaconSent = true;
      state.ship.relayHeld = 0;
      say(
        state,
        'alarm',
        `>> Broadcast away, and everything aboard heard it. Now hold COMMS for ${relayHold(state.depth)} hours ` +
          `at ${def.drain ?? 1} power an hour. If anything gets into this room, the watch starts again.`,
      );
      return;
    case 'takeSpecimen':
      state.ship.specimenTaken = true;
      state.player.carryingSpecimen = true;
      advanceHive(state, RULES.hivePerEscalation);
      say(
        state,
        'alarm',
        '>> You cut it out of the mass and seal it into a sample case. It is warm and it will not stop moving. ' +
          `Every hour you carry it, the compartment you are standing in gets ${RULES.specimenNoisePerHour} louder. ` +
          'Get it to COMMS.',
      );
      return;
    case 'upload':
      if (!state.player.carryingSpecimen) fail('nothing to upload');
      say(state, 'alarm', '>> The readings go up the wire. Whatever happens to you now, somebody knows what this is.');
      resolveRun(state, 'objective', 'specimen');
      return;
    case 'armScuttle': {
      state.ship.scuttleArmed = true;
      state.ship.scuttleArmedTurn = state.turn;
      say(
        state,
        'alarm',
        `>> Overload armed. ${fuseTurns(state.depth)} hours to critical, you cannot call it back, and ` +
          'the ship gets one louder everywhere every hour until it goes. Be alive when it does.',
      );
      return;
    }
    case 'launch':
      say(
        state,
        'alarm',
        '>> The clamps let go and the bay falls away underneath you.',
      );
      resolveRun(
        state,
        'objective',
        state.player.hand
          .concat(state.player.deck, state.player.discard)
          .filter(isInfection).length >= infectionThreshold(state.depth)
          ? 'carrier'
          : 'escaped',
      );
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
      moveTo(state, action.to);
      makeNoise(state, RULES.basicActions.move?.noise ?? 2);
      say(state, 'player', arrival(state, action.to, false));
      noteSightings(state);
      return;
    case 'creep':
      payAp(state, creepCost(state));
      moveTo(state, action.to);
      makeNoise(state, creepNoise(state));
      say(state, 'player', arrival(state, action.to, true));
      noteSightings(state);
      return;
    case 'listen': {
      payAp(state, listenCost(state));
      state.stats.listens += 1;
      const found = revealWithin(state, RULES.listenRange);
      say(state, 'player', sweepReport(state, found, RULES.listenRange));
      return;
    }
    case 'search': {
      if (state.player.node === 'vents' || salvageLeft(state, state.player.node) === 0) {
        fail('nothing to search');
      }
      payAp(state, RULES.basicActions.search?.ap ?? 1);
      makeNoise(state, RULES.basicActions.search?.noise ?? 2);
      doSearch(state);
      return;
    }
    case 'brace':
      payAp(state, RULES.basicActions.brace?.ap ?? 1);
      state.player.wardsThisTurn += 1;
      say(state, 'player', '>> Back to the frame, weight on the balls of your feet. The next one does not land.');
      return;
    case 'discard': {
      if (!state.player.hand.includes(action.uid)) fail('that card is not in hand');
      const cost = discardCost(state);
      payAp(state, cost);
      if (cost === 0) state.player.freeCardUsed = true;
      removeFromHand(state, action.uid);
      state.player.discard.push(action.uid);
      // Shedding a card is only worth anything if something replaces it.
      drawOne(state);
      say(
        state,
        'player',
        isInfection(action.uid)
          ? `>> You put ${cardOf(action.uid).name} out of your mind for now. It is still in your kit.`
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
      say(state, 'player', '>> Into the crawlspace. Nothing walks in here — but a CRAWLER does not walk.');
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

/** The only way the state ever changes. */
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
