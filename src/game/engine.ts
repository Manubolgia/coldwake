import { getActions, neverFails, planCreature, roomActionMods, visibleCreatures, weapons } from './actions';
import type { CardDef, ChoiceDef, Res } from './content/cards';
import { ROOM_ACTIONS } from './content/actions';
import { BREED_EVERY, CREATURES, huntEvery } from './content/creatures';
import { render } from './content/ctx';
import { DISCOVERIES } from './content/discoveries';
import { EVENTS } from './content/events';
import { INCIDENTS } from './content/incidents';
import { ITEMS } from './content/items';
import { ROOMS } from './content/rooms';
import { survivorCard } from './content/survivors';
import { pickEvent } from './director';
import {
  addHazard,
  addStress,
  applyEffect,
  damage,
  describeRoom,
  findClue,
  giveItem,
  heal,
  infect,
  killCreature,
  loseCompanion,
  retreat,
  revealAround,
  turnCompanion,
} from './effects';
import { computeEnding } from './endings';
import { distance, neighbours, stepToward } from './map';
import { Rng } from './rng';
import {
  act,
  bandOf,
  beat,
  cap,
  creatureName,
  creaturesIn,
  ctxOf,
  hasItem,
  log,
  pushCard,
  roomName,
  statParts,
} from './rules';
import type { Action, ActionOption, Band, Creature, Die, ExitId, GameState, ItemId, StoryCard } from './types';

export { newGame } from './generate';
export { getActions } from './actions';

// ── dice ───────────────────────────────────────────────────────────────

export function diceCount(s: GameState): number {
  const base = 3 + (s.player.hp <= 2 ? -1 : 0) + s.player.diceNext;
  return Math.max(1, base);
}

function rollDice(s: GameState, rng: Rng): void {
  const n = diceCount(s);
  s.player.diceNext = 0;
  const dice: Die[] = [];
  for (let i = 0; i < n; i++) dice.push({ id: i, value: rng.die(), used: false, source: 'self' });
  if (s.companion) dice.push({ id: n, value: rng.die(), used: false, source: 'companion' });
  s.dice = dice;
}

/** Called once after newGame to put the opening cards and the first roll in place. */
export function begin(s0: GameState): GameState {
  const s = structuredClone(s0);
  const rng = new Rng(s.rng);
  const inc = INCIDENTS[s.scenario.incident];
  const c = ctxOf(s);
  pushCard(s, {
    kind: 'intro',
    title: `The ${s.scenario.shipName}`,
    text: inc.wake(c),
    art: 'cryo',
    tone: 'strange',
  });
  rollDice(s, rng);
  s.rng = rng.state;
  log(s, `You wake aboard the ${s.scenario.shipName}, a ${s.scenario.shipClass}. ${inc.hook}`, 'strange');
  beat(s, `Woke from cryo aboard the ${s.scenario.shipName}.`);
  return s;
}

// ── reduce ─────────────────────────────────────────────────────────────

export function reduce(s0: GameState, a: Action): GameState {
  if (s0.status !== 'playing') return s0;
  const s = structuredClone(s0);
  const rng = new Rng(s.rng);

  switch (a.type) {
    case 'continue': {
      const top = s.cards[0];
      if (!top || top.choices.length) return s0;
      s.cards.shift();
      break;
    }
    case 'choose': {
      const top = s.cards[0];
      if (!top || !top.choices[a.index]) return s0;
      resolveChoice(s, rng, top, a.index);
      break;
    }
    case 'act': {
      if (s.cards.length) return s0;
      const opt = getActions(s).find((o) => o.id === a.id && (o.target ?? '') === (a.target ?? ''));
      if (!opt || opt.disabled) return s0;
      if (opt.id === 'take') {
        takeFromFloor(s, Number(opt.target));
        break;
      }
      const die = s.dice.find((d) => d.id === a.die && !d.used);
      if (!die) return s0;
      die.used = true;
      resolveAction(s, rng, opt, die);
      break;
    }
    case 'endRound': {
      if (s.cards.length) return s0;
      shipPhase(s, rng);
      break;
    }
  }

  finalize(s);
  s.rng = rng.state;
  return s;
}

function finalize(s: GameState): void {
  if (s.status !== 'playing') return;
  const win = s.progress.flags.find((f) => f.startsWith('win:'));
  if (s.player.hp <= 0) {
    s.status = 'dead';
    const cause = s.progress.flags.find((f) => f.startsWith('killed-by:'))?.split(':')[1];
    s.ending = computeEnding(s, 'killed');
    beat(s, cause && cause !== 'wounds' ? `Died — ${cause === 'vacuum' ? 'the air ran out' : cause === 'fire' ? 'the fire' : cause}.` : 'Died.');
  } else if (win) {
    const exit = win.split(':')[1] as ExitId;
    s.status = 'won';
    s.ending = computeEnding(s, 'win', exit);
    beat(s, `Escaped: ${s.ending.title.toLowerCase()}.`);
  }
  if (s.status !== 'playing') s.cards = [];
}

// ── actions ────────────────────────────────────────────────────────────

function resolveAction(s: GameState, rng: Rng, opt: ActionOption, die: Die): void {
  const outcome = opt.outcomes[die.id];
  const band: Band = outcome?.band ?? 'clean';
  switch (opt.id) {
    case 'move':
      return doMove(s, rng, opt.target!, band);
    case 'force':
      return doForce(s, rng, opt.target!, band);
    case 'search':
      return doSearch(s, rng, band);
    case 'hide':
      return doHide(s, rng, band);
    case 'fight':
      return doFight(s, rng, opt.target!, band);
    case 'use':
      return doUse(s, rng, opt.target!);
    default:
      return doRoomAction(s, rng, opt.id, die);
  }
}

function doRoomAction(s: GameState, rng: Rng, id: string, die: Die): void {
  const def = ROOM_ACTIONS.find((d) => d.id === id);
  if (!def) return;
  const room = s.rooms[s.player.room]!;
  const m = roomActionMods(s, def);
  let band: Band = 'clean';
  if (!m.flat) {
    band = bandOf(die.value + m.base);
    if (band === 'fail' && neverFails(s, def)) band = 'cost';
  }
  const out = band === 'clean' ? def.clean : band === 'cost' ? (def.cost ?? def.clean) : (def.fail ?? def.cost ?? def.clean);
  room.used.push(def.id);
  s.noise += def.noise;
  if (def.noise > 0) s.player.hidden = false;
  let text = out.text;
  if (def.id === 'nest' && band !== 'fail') text = '';
  let done = !!def.step && band !== 'fail';
  if (def.step && def.work && band !== 'fail') {
    const w = (s.progress.work[def.id] ?? 0) + (band === 'clean' ? 2 : 1);
    s.progress.work[def.id] = w;
    if (w < def.work) {
      done = false;
      text = `${def.label}: you make headway, but it isn’t finished. (${w}/${def.work})`;
    }
  }
  if (text) log(s, text, band === 'fail' ? 'danger' : band === 'cost' ? 'tense' : 'good');
  if (def.step && done) {
    s.progress.steps[def.step.exit][def.step.step] = true;
    if (def.consumes) applyEffect(s, rng, { loseItem: def.consumes });
    if (!out.effect?.win) beat(s, `${def.label}.`);
  }
  applyEffect(s, rng, out.effect);
  if (def.id === 'safe' && band !== 'fail') room.spent = true;
}

function doMove(s: GameState, rng: Rng, to: string, band: Band): void {
  const from = s.player.room;
  const attackers = creaturesIn(s, from).filter((c) => c.stunned === 0);
  if (band === 'fail' && attackers.length) {
    const worst = attackers.reduce((a, b) => (CREATURES[b.kind].damage > CREATURES[a.kind].damage ? b : a));
    strike(s, rng, worst, true);
    if (s.player.hp <= 0) return;
  }
  const noise = band === 'clean' ? 0 : band === 'cost' ? 1 : 2;
  s.noise += noise;
  s.player.hidden = false;
  const r = s.rooms[to]!;
  if (r.locked) r.locked = false;
  s.player.room = to;
  log(
    s,
    `You ${band === 'clean' ? 'slip' : band === 'cost' ? 'move' : 'stumble, loudly,'} into the ${roomName(s, to)}.${noise ? ` (+${noise} noise)` : ''}`,
    band === 'fail' ? 'tense' : undefined,
  );
  enterRoom(s, rng, to);
}

function doForce(s: GameState, rng: Rng, to: string, band: Band): void {
  if (band === 'fail') {
    s.noise += 2;
    s.player.hidden = false;
    log(s, 'The door doesn’t budge. The whole ship hears you trying.', 'danger');
    return;
  }
  s.noise += band === 'clean' ? 1 : 3;
  s.player.hidden = false;
  s.rooms[to]!.locked = false;
  s.player.room = to;
  log(s, band === 'clean' ? `You lever the door open and step into the ${roomName(s, to)}.` : `The door gives with a shriek of metal. You’re into the ${roomName(s, to)}.`, 'tense');
  enterRoom(s, rng, to);
}

function enterRoom(s: GameState, rng: Rng, to: string): void {
  const r = s.rooms[to]!;
  revealAround(s);
  if (!r.explored) {
    r.explored = true;
    const desc = describeRoom(s, to);
    if (r.clue !== null) {
      pushCard(s, { kind: 'discovery', title: roomName(s, to), text: desc, art: r.type, tone: 'strange' });
      findClue(s, r.clue);
    } else if (r.survivor !== null) {
      const idx = r.survivor;
      r.survivor = null;
      s.progress.survivorsMet.push(idx);
      const def = survivorCard(s, idx);
      pushCard(s, { kind: 'discovery', title: roomName(s, to), text: desc, art: r.type, tone: 'calm' });
      pushDefCard(s, rng, def, 'survivor', { type: 'survivor', id: def.id, arg: idx });
    } else {
      const def = drawDiscovery(s, rng, r.type);
      const card = cardFromDef(s, rng, def, 'discovery', { type: 'discovery', id: def.id });
      card.title = roomName(s, to);
      card.text = `${desc}\n\n${card.text}`;
      card.art = r.type;
      s.cards.push(card);
    }
    if (to === s.scenario.nest) beat(s, `Found the ${INCIDENTS[s.scenario.incident].nestName.toLowerCase()}.`);
  }
  const present = creaturesIn(s, to);
  if (present.length) encounter(s, rng, present, 'enter');
}

function doSearch(s: GameState, rng: Rng, band: Band): void {
  const room = s.rooms[s.player.room]!;
  s.noise += 1;
  s.player.hidden = false;
  if (band === 'fail') {
    s.noise += 1;
    log(s, 'You turn the place over and find nothing but noise. There’s still more to look through.', 'tense');
    return;
  }
  room.searchesLeft -= 1;
  if (band === 'cost') s.noise += 1;
  const a = drawLoot(s, rng);
  const b = band === 'clean' ? drawLoot(s, rng) : null;
  const pick = b && itemValue(s, b) > itemValue(s, a) ? b : a;
  log(s, band === 'clean' ? 'You search methodically and choose the best of what you find.' : 'You find something, not quietly.');
  giveItem(s, pick);
}

const VALUE: Partial<Record<ItemId, number>> = {
  flamer: 9, fuelcell: 9, pistol: 8, cutter: 7, axe: 7, emp: 6, medkit: 6, baton: 5, keycard: 5, tracker: 5,
  rivetgun: 4, stim: 4, flare: 4, toolkit: 4, flashlight: 3, sedative: 3, foam: 2,
};

function itemValue(s: GameState, id: ItemId): number {
  let v = VALUE[id] ?? 1;
  if (ITEMS[id].kind === 'tool' && hasItem(s, id)) v -= 4;
  if (id === 'keycard' && hasItem(s, 'codes')) v -= 4;
  return v;
}

function drawLoot(s: GameState, rng: Rng): ItemId {
  const room = s.rooms[s.player.room]!;
  const wantsFuel = s.scenario.exits.includes('shuttle') && !s.progress.steps.shuttle[0] && !hasItem(s, 'fuelcell');
  if (wantsFuel && room.type === 'cargo') return 'fuelcell';
  const pool = ROOMS[room.type].loot.filter((id) => id !== 'fuelcell' || wantsFuel);
  return pool.length ? rng.pick(pool) : 'stim';
}

function doHide(s: GameState, rng: Rng, band: Band): void {
  if (band === 'fail') {
    s.noise += 1;
    log(s, 'You knock something over getting into cover. So much for that.', 'danger');
    return;
  }
  s.player.hidden = true;
  log(s, band === 'clean' ? 'You fold yourself into the shadows and go still.' : 'You squeeze into cover, heart hammering.', 'calm');
  if (band === 'cost') addStress(s, rng, 1);
}

function doFight(s: GameState, rng: Rng, target: string, band: Band): void {
  const [cid, widx] = target.split(':').map(Number) as [number, number];
  const c = s.creatures.find((x) => x.id === cid);
  if (!c) return;
  const w = weapons(s).find((x) => x.index === widx) ?? weapons(s)[0]!;
  const def = CREATURES[c.kind];
  const name = creatureName(s, c).toLowerCase();
  s.noise += 2 + w.loud;
  s.player.hidden = false;
  if (w.index >= 0) {
    const it = s.player.items[w.index]!;
    if (it.uses !== undefined) it.uses -= 1;
  }
  if (band === 'fail') {
    log(s, `You swing at the ${name} and miss.`, 'danger');
    strike(s, rng, c, false);
    cleanupWeapons(s);
    return;
  }
  const dmg = w.damage + (s.player.role === 'marine' && band === 'clean' ? 1 : 0) + (s.progress.truth ? 1 : 0);
  c.hp -= dmg;
  c.hurtThisRound += dmg;
  s.progress.roundsSinceScare = 0;
  if (c.hp <= 0) {
    log(s, `You put the ${name} down with the ${w.name.toLowerCase()}. It stays down.`, 'good');
    killCreature(s, c, `with ${w.index < 0 ? 'your bare hands' : `a ${w.name.toLowerCase()}`}`);
    if (!s.player.traits.includes('hunter') && s.progress.kills === 1) {
      s.player.traits.push('hunter');
      log(s, 'New trait: Blooded (+1 Might). You know they can bleed.', 'good');
    }
  } else {
    log(s, `You hit the ${name} for ${dmg}. (${c.hp}/${c.maxHp} left)`, 'good');
    if (w.stun) c.stunned = Math.max(c.stunned, 1);
    if ((w.fire || (def.retreats && c.hurtThisRound >= 2)) && c.hp > 0) retreat(s, rng, c);
  }
  if (band === 'cost') {
    log(s, 'It catches you as you close in.', 'danger');
    damage(s, 1, creatureName(s, c).toLowerCase());
  }
  cleanupWeapons(s);
}

function cleanupWeapons(s: GameState): void {
  const spent = s.player.items.filter((it) => ITEMS[it.id].kind === 'weapon' && it.uses !== undefined && it.uses <= 0);
  for (const it of spent) log(s, `The ${ITEMS[it.id].name.toLowerCase()} is empty. You drop it.`);
  s.player.items = s.player.items.filter((it) => !(ITEMS[it.id].kind === 'weapon' && it.uses !== undefined && it.uses <= 0));
}

function doUse(s: GameState, rng: Rng, target: string): void {
  const [idxS, room] = target.split(':');
  const idx = Number(idxS);
  const it = s.player.items[idx];
  if (!it) return;
  const consume = () => s.player.items.splice(idx, 1);
  switch (it.id) {
    case 'medkit': {
      const n = heal(s, 2);
      log(s, `You tear open the medkit and patch yourself up. +${n} health.`, 'good');
      consume();
      break;
    }
    case 'stim': {
      consume();
      const nextId = Math.max(...s.dice.map((d) => d.id)) + 1;
      s.dice.push({ id: nextId, value: rng.die(), used: false, source: 'stim' });
      addStress(s, rng, -1);
      log(s, 'The stim hits like cold water. Everything goes sharp.', 'good');
      break;
    }
    case 'sedative':
      consume();
      addStress(s, rng, -3);
      log(s, 'The edges of everything go soft.', 'calm');
      break;
    case 'emp': {
      consume();
      s.noise += 1;
      const near = new Set([s.player.room, ...neighbours(s, s.player.room)]);
      for (const c of s.creatures.slice()) {
        if (!near.has(c.room)) continue;
        c.stunned = Math.max(c.stunned, 2);
        if (c.kind === 'drone') {
          c.hp -= 2;
          if (c.hp <= 0) killCreature(s, c, 'with an EMP');
        }
      }
      log(s, 'The EMP goes off with a thump you feel in your fillings. Every light nearby dies and comes back.', 'good');
      break;
    }
    case 'foam': {
      consume();
      const r = s.rooms[s.player.room]!;
      const fire = r.hazards.includes('fire');
      r.hazards = r.hazards.filter((h) => (fire ? h !== 'fire' : h !== 'breach'));
      log(s, fire ? 'The foam smothers the fire in seconds.' : 'The foam hardens over the breach. The whistling stops.', 'good');
      break;
    }
    case 'flare': {
      consume();
      if (room) {
        s.progress.lure = room;
        log(s, `You crack the flare and throw it into the ${roomName(s, room)}. Red light and a hiss that carries.`, 'good');
      }
      break;
    }
  }
}

function takeFromFloor(s: GameState, i: number): void {
  const room = s.rooms[s.player.room]!;
  const it = room.floor[i];
  if (!it || s.player.items.length >= 6) return;
  room.floor.splice(i, 1);
  s.player.items.push(it);
  log(s, `You pick up the ${ITEMS[it.id].name.toLowerCase()}.`);
}

export function dropItem(s0: GameState, index: number): GameState {
  const s = structuredClone(s0);
  const it = s.player.items[index];
  if (!it || s.status !== 'playing') return s0;
  s.player.items.splice(index, 1);
  s.rooms[s.player.room]!.floor.push(it);
  log(s, `You set down the ${ITEMS[it.id].name.toLowerCase()}.`);
  return s;
}

// ── creatures and you ──────────────────────────────────────────────────

/** A creature hits you (or whoever is with you). */
function strike(s: GameState, rng: Rng, c: Creature, asYouRun: boolean): void {
  const def = CREATURES[c.kind];
  const name = creatureName(s, c);
  s.progress.roundsSinceScare = 0;
  if (s.companion && !asYouRun && rng.chance(0.35)) {
    const m = s.companion;
    m.hp -= def.damage;
    log(s, `The ${name.toLowerCase()} goes for ${m.name.split(' ')[0]} instead of you.`, 'danger');
    if (m.hp <= 0) loseCompanion(s, rng, 'died', `the ${name.toLowerCase()}`);
    return;
  }
  damage(s, def.damage, `the ${name.toLowerCase()}`);
  log(s, `${asYouRun ? 'As you run, the' : 'The'} ${name.toLowerCase()} ${pickVerb(rng)} you. −${def.damage} health.`, 'danger');
  if (def.infect) infect(s, rng, def.infect);
  addStress(s, rng, 1);
}

function pickVerb(rng: Rng): string {
  return rng.pick(['tears into', 'catches', 'slams into', 'rakes', 'hits', 'lunges at']);
}

function encounter(s: GameState, rng: Rng, cs: Creature[], how: 'enter' | 'arrive'): void {
  const inc = INCIDENTS[s.scenario.incident];
  s.progress.roundsSinceScare = 0;
  const first = cs[0]!;
  const def = CREATURES[first.kind];
  const name = creatureName(s, first);
  const seenKey = `seen:${first.kind}`;
  const firstTime = !s.progress.flags.includes(seenKey);
  if (firstTime) s.progress.flags.push(seenKey);
  const many = cs.length > 1 ? ` It isn’t alone: ${cs.length} of them.` : '';
  let text: string;
  if (s.player.hidden && how === 'arrive') {
    text = `Something comes in. From your hiding place you watch the ${name.toLowerCase()} move through the ${roomName(s, s.player.room)}, slow, listening. It hasn’t seen you. Stay hidden and it will move on — or strike first.${many}`;
  } else if (how === 'arrive') {
    text = `${firstTime ? def.desc + ' ' : ''}The ${name.toLowerCase()} is in the room with you.${many} It will attack when this round ends unless you fight, run, or hide.`;
  } else {
    text = `${firstTime ? def.desc + ' ' : ''}There is a ${name.toLowerCase()} in here.${many} It turns toward you. You have until the end of the round to fight, run, or hide.`;
  }
  if (firstTime && first.kind === inc.primary) beat(s, `First saw ${inc.creature}.`);
  pushCard(s, {
    kind: 'encounter',
    title: cap(name),
    text,
    art: first.kind,
    tone: 'danger',
  });
  const horror = cs.reduce((m, c) => Math.max(m, CREATURES[c.kind].horror), 0) - (s.player.hidden ? 1 : 0);
  addStress(s, rng, Math.max(0, horror));
}

// ── the ship's turn ────────────────────────────────────────────────────

function shipPhase(s: GameState, rng: Rng): void {
  const unused = s.dice.filter((d) => !d.used).length;
  if (unused > 0 && s.player.stress > 0) {
    log(s, `You spend a moment breathing. −${Math.min(unused, s.player.stress)} stress.`, 'calm');
    addStress(s, rng, -unused);
  }
  const me = s.player.room;

  // 1. Anything in the room with you strikes.
  for (const c of creaturesIn(s, me)) {
    const plan = planCreature(s, c);
    if (plan.kind === 'attack') strike(s, rng, c, false);
    else if (plan.kind === 'leave') log(s, `The ${creatureName(s, c).toLowerCase()} searches the room, and doesn’t find you.`, 'calm');
    if (s.player.hp <= 0) return;
  }

  // 2. Everything else moves.
  const arrivals: Creature[] = [];
  const radius = Math.min(4, s.noise);
  for (const c of s.creatures) {
    const def = CREATURES[c.kind];
    c.hurtThisRound = 0;
    if (c.stunned > 0) {
      c.stunned -= 1;
      continue;
    }
    const lure = s.progress.lure;
    if (lure && distance(s, c.room, lure) <= 3) {
      c.target = lure;
      c.fresh = false;
      const next = stepToward(s, c.room, lure);
      c.room = next;
      if (def.speed > 1) c.room = stepToward(s, c.room, lure);
      if (c.room === me) arrivals.push(c);
      continue;
    }
    if (c.room === me) {
      if (s.player.hidden) {
        const away = neighbours(s, me);
        c.room = rng.pick(away);
        c.target = null;
      }
      c.fresh = false;
      continue;
    }
    if (def.slow && s.round % 2 === 1) continue;
    const d = distance(s, c.room, me);
    if (radius > 0 && d <= radius + def.hearing) c.target = me;
    else if (huntEvery(def, s.difficulty) && s.round % huntEvery(def, s.difficulty)! === 0) c.target = me;
    for (let i = 0; i < def.speed; i++) {
      if (c.target) {
        c.room = stepToward(s, c.room, c.target);
        if (c.room === c.target) {
          if (c.target !== me) c.target = null;
        }
      } else if (rng.chance(0.5)) {
        c.room = rng.pick(neighbours(s, c.room));
      }
      if (c.room === me) break;
    }
    if (c.room === me) {
      c.fresh = true;
      c.target = null;
      arrivals.push(c);
    }
  }
  s.progress.lure = null;

  // 3. Hazards.
  const here = s.rooms[me]!;
  if (here.hazards.includes('fire')) {
    damage(s, 1, 'fire');
    log(s, 'The fire gets you. −1 health.', 'danger');
  }
  if (here.hazards.includes('breach')) {
    damage(s, 1, 'vacuum');
    log(s, 'The air is thin and going. −1 health.', 'danger');
  }
  for (const r of Object.values(s.rooms)) {
    if (!r.hazards.includes('fire')) continue;
    for (const c of creaturesIn(s, r.id)) if (CREATURES[c.kind].retreats && c.room !== me) c.target = null;
    r.fireRounds -= 1;
    if (r.fireRounds <= 0) {
      r.hazards = r.hazards.filter((h) => h !== 'fire');
      if (r.id === me) log(s, 'The fire burns itself out.', 'calm');
    } else if (rng.chance(0.15)) {
      const n = rng.pick(neighbours(s, r.id));
      if (!s.rooms[n]!.hazards.includes('fire')) addHazard(s, n, 'fire');
    }
  }
  if (s.player.hp <= 0) return;

  // 4. What’s inside you, and who’s beside you.
  if (s.player.infected) {
    s.player.infectionRounds += 1;
    if (s.player.infectionRounds === 5 && !s.player.infectionKnown) {
      s.player.infectionKnown = true;
      pushCard(s, {
        kind: 'info',
        title: 'Symptoms',
        text: 'Dark threads under the skin of your wrist, spreading. A taste in your mouth like metal and honey. You are infected. A medbay or lab can purge it — if you get there in time.',
        art: 'infection',
        tone: 'danger',
      });
    }
    if (s.player.infectionRounds >= 13) {
      s.status = 'dead';
      s.ending = computeEnding(s, 'turned');
      beat(s, 'Turned.');
      s.cards = [];
      return;
    }
  }
  if (s.companion) {
    const m = s.companion;
    m.roundsWithYou += 1;
    if (m.mimic && m.roundsWithYou >= 3 && rng.chance(0.35)) turnCompanion(s, rng);
    else if (m.infected && m.roundsWithYou >= 5 && rng.chance(0.3)) turnCompanion(s, rng);
  }

  // 5. The clock.
  s.clock -= 1;
  if (s.progress.camerasRounds > 0) s.progress.camerasRounds -= 1;
  const rescue = s.progress.rescueIn;
  if (rescue !== null && rescue > 0) {
    s.progress.rescueIn = rescue - 1;
    if (s.progress.rescueIn === 0) {
      pushCard(s, {
        kind: 'info',
        title: 'The tug has docked',
        text: 'A clang runs through the whole hull, and a voice crackles on the open channel: “Docking complete. Airlock is cycling. If anyone’s alive in there, now’s the time.”',
        art: 'airlock',
        tone: 'good',
      });
      beat(s, 'The rescue tug docked.');
    }
  }
  const a = act(s);
  if (a >= 2 && !s.progress.flags.includes('act2')) {
    s.progress.flags.push('act2');
    pushCard(s, {
      kind: 'info',
      title: 'Act II — It knows you’re here',
      text: `A long, low note runs through the ${s.scenario.shipName}’s frame. Lights flicker along every corridor. Whatever is aboard has stopped waiting. From here the nest breeds faster, and more of them can be loose at once.`,
      art: 'nest',
      tone: 'danger',
    });
  }
  if (a >= 3 && !s.progress.flags.includes('act3')) {
    s.progress.flags.push('act3');
    pushCard(s, {
      kind: 'info',
      title: 'Act III — The end is close',
      text: `${s.scenario.clockKind} ${s.clock} rounds. Alarms you haven’t heard before. There is no more time for anything but getting out.`,
      art: 'alarm',
      tone: 'danger',
    });
  }
  const every = BREED_EVERY[s.difficulty][a - 1] ?? 5;
  if (s.round % every === 0 && !s.progress.nestDestroyed) {
    // Breeding at the nest; the director doesn't get a say.
    const before = s.creatures.length;
    applyEffect(s, rng, { spawn: { kind: 'brood', where: 'nest' } });
    if (s.creatures.length > before) log(s, `Far off, from the ${INCIDENTS[s.scenario.incident].nestName}, a sound like something being born.`, 'tense');
  }
  if (s.clock <= 0) {
    s.status = 'dead';
    s.ending = computeEnding(s, s.progress.selfDestruct ? 'burned' : 'adrift');
    s.cards = [];
    return;
  }

  // 6. Arrivals, then the director.
  if (arrivals.length) encounter(s, rng, arrivals, 'arrive');
  else s.progress.roundsSinceScare += 1;
  if (!arrivals.length) {
    const ev = pickEvent(s, rng);
    if (ev) {
      s.usedEvents.push(ev.id);
      pushDefCard(s, rng, ev, 'event', { type: 'event', id: ev.id });
    }
  }

  // 7. A new round.
  s.round += 1;
  s.noise = 0;
  s.progress.hurtRecently = s.progress.hurtRecently.filter((r) => r >= s.round - 3);
  rollDice(s, rng);
  if (s.player.hp <= 2 && s.player.hp > 0) log(s, 'You are badly hurt. One fewer die until you heal.', 'danger');
}

// ── story cards ────────────────────────────────────────────────────────

function drawDiscovery(s: GameState, rng: Rng, type: GameState['rooms'][string]['type']) {
  const a = act(s);
  const pool = DISCOVERIES.filter(
    (d) =>
      (!d.rooms || d.rooms.includes(type)) &&
      (d.act ?? 1) <= a &&
      (!d.when || d.when(s)) &&
      !s.usedEvents.includes(`d:${d.id}`),
  );
  const d = rng.weighted(pool.map((x) => ({ item: x, weight: (x.weight ?? 1) * (x.rooms ? 1 : 1) })));
  if (d.rooms || d.id === 'lying-in-wait' || d.effect?.item) s.usedEvents.push(`d:${d.id}`);
  return d;
}

function cardFromDef(
  s: GameState,
  rng: Rng,
  def: CardDef,
  kind: StoryCard['kind'],
  source: NonNullable<StoryCard['source']>,
): StoryCard {
  const c = ctxOf(s);
  const choices = (def.choices ?? [])
    .map((ch, i) => ({ ch, i }))
    .filter(({ ch }) => !ch.when || ch.when(s))
    .map(({ ch, i }) => {
      const out: StoryCard['choices'][number] = { label: render(ch.label, c), ref: i };
      if (ch.hint) out.hint = ch.hint;
      if (ch.stat) out.stat = ch.stat;
      if (ch.mod) out.mod = ch.mod;
      return out;
    });
  // The card's immediate effect happens as it is revealed.
  applyEffect(s, rng, def.effect, source.type === 'survivor' ? { survivor: source.arg } : {});
  return {
    uid: s.nextCardId++,
    kind,
    title: render(def.title, c),
    text: render(def.text, c),
    art: def.art,
    tone: def.tone,
    choices,
    source,
  };
}

function pushDefCard(
  s: GameState,
  rng: Rng,
  def: CardDef,
  kind: StoryCard['kind'],
  source: NonNullable<StoryCard['source']>,
): void {
  s.cards.push(cardFromDef(s, rng, def, kind, source));
}

function lookupDef(s: GameState, source: NonNullable<StoryCard['source']>): CardDef | undefined {
  if (source.type === 'event') return EVENTS.find((e) => e.id === source.id);
  if (source.type === 'discovery') return DISCOVERIES.find((d) => d.id === source.id);
  if (source.type === 'survivor' && source.arg !== undefined) return survivorCard(s, source.arg);
  return undefined;
}

function resolveChoice(s: GameState, rng: Rng, card: StoryCard, index: number): void {
  const choice = card.choices[index]!;
  const def = card.source ? lookupDef(s, card.source) : undefined;
  const ch: ChoiceDef | undefined = def?.choices?.[choice.ref];
  s.cards.shift();
  if (!ch) return;
  const c = ctxOf(s);
  let res: Res | undefined;
  let roll: StoryCard['roll'];
  if (ch.stat) {
    const die = rng.die();
    const sp = statParts(s, ch.stat);
    const bonus = sp.total + (ch.mod ?? 0);
    let band = bandOf(die + bonus);
    if (band === 'fail' && s.player.role === 'engineer' && ch.stat === 'tech') band = 'cost';
    res = band === 'clean' ? ch.clean : band === 'cost' ? (ch.cost ?? ch.clean) : (ch.fail ?? ch.cost);
    roll = { die, bonus, total: die + bonus, band, stat: ch.stat };
  } else {
    res = ch.result;
  }
  if (!res) return;
  const text = render(res.text, c);
  const result: StoryCard = {
    uid: s.nextCardId++,
    kind: 'result',
    title: render(choice.label, c),
    text,
    art: card.art,
    tone: roll ? (roll.band === 'clean' ? 'good' : roll.band === 'cost' ? 'tense' : 'danger') : card.tone,
    choices: [],
  };
  if (roll) result.roll = roll;
  s.cards.unshift(result);
  log(s, text, result.tone);
  applyEffect(s, rng, res.effect, card.source?.type === 'survivor' ? { survivor: card.source.arg } : {});
}

// ── views the interface needs ──────────────────────────────────────────

export { visibleCreatures, planCreature };

export function forecast(s: GameState) {
  return visibleCreatures(s).map((c) => ({ creature: c, plan: planCreature(s, c) }));
}
