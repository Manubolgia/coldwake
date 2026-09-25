import { CREATURE_CAP, CREATURES } from './content/creatures';
import { RESCUE_ROUNDS } from './content/exits';
import { INCIDENTS } from './content/incidents';
import { INVENTORY_SIZE, ITEMS } from './content/items';
import { TRAITS } from './content/roles';
import { ROOMS } from './content/rooms';
import { withUses } from './generate';
import { distances, neighbours } from './map';
import type { Rng } from './rng';
import {
  act,
  beat,
  cap,
  cluesNeeded,
  creatureName,
  ctxOf,
  isPrimary,
  log,
  pushCard,
  roomName,
} from './rules';
import type { Creature, CreatureKind, Effect, GameState, ItemId, TraitId } from './types';

export interface EffectCtx {
  survivor?: number;
}

// ── items ──────────────────────────────────────────────────────────────

export function giveItem(s: GameState, id: ItemId): void {
  const def = ITEMS[id];
  if (s.player.items.length >= INVENTORY_SIZE && def.kind !== 'quest') {
    s.rooms[s.player.room]!.floor.push(withUses(id));
    log(s, `Your hands are full. You leave the ${def.name.toLowerCase()} here for later.`);
    return;
  }
  s.player.items.push(withUses(id));
  log(s, `You take the ${def.name.toLowerCase()}.`, 'good');
  if (id === 'fuelcell' && s.scenario.exits.includes('shuttle')) s.progress.steps.shuttle[0] = true;
}

export function loseItem(s: GameState, rng: Rng, which: 'random' | ItemId, drop = true): void {
  const items = s.player.items;
  let idx: number;
  if (which === 'random') {
    const candidates = items.map((it, i) => ({ it, i })).filter(({ it }) => ITEMS[it.id].kind !== 'quest');
    if (!candidates.length) return;
    idx = rng.pick(candidates).i;
  } else {
    idx = items.findIndex((i) => i.id === which);
  }
  if (idx < 0) return;
  const [it] = items.splice(idx, 1);
  if (drop && which === 'random' && it) {
    s.rooms[s.player.room]!.floor.push(it);
    log(s, `You drop the ${ITEMS[it.id].name.toLowerCase()}.`, 'tense');
  }
}

// ── body and mind ──────────────────────────────────────────────────────

export function damage(s: GameState, amount: number, cause: string): void {
  if (amount <= 0) return;
  s.player.hp = Math.max(0, s.player.hp - amount);
  s.progress.hurtRecently.push(s.round);
  if (s.player.hp <= 0) {
    s.progress.flags.push(`killed-by:${cause}`);
  }
}

export function heal(s: GameState, amount: number): number {
  if (amount <= 0) return 0;
  let n = amount;
  if (s.player.role === 'medic') n += 1;
  if (s.player.role === 'android') n = Math.max(1, n - 1);
  const before = s.player.hp;
  s.player.hp = Math.min(s.player.maxHp, s.player.hp + n);
  return s.player.hp - before;
}

export function addStress(s: GameState, rng: Rng, amount: number): void {
  if (amount === 0) return;
  let n = amount;
  if (n > 0 && s.player.role === 'android') n = Math.ceil(n / 2);
  s.player.stress = Math.max(0, s.player.stress + n);
  if (s.player.stress >= s.player.maxStress) panic(s, rng);
}

const PANICS: { id: string; title: string; text: string }[] = [
  { id: 'scream', title: 'You scream', text: 'It comes out of you before you can stop it, raw and loud, and it goes on and on. Everything aboard hears it.' },
  { id: 'freeze', title: 'You freeze', text: 'Your body stops answering. You stand there, shaking, for far too long. You will be slower next round.' },
  { id: 'drop', title: 'Your hands open', text: 'Your fingers stop working and something you were holding clatters away.' },
  { id: 'bolt', title: 'You run', text: 'You are running before you have decided to — through the nearest hatch, anywhere, away.' },
  { id: 'trauma', title: 'Something breaks', text: 'You come back to yourself curled on the deck. You get up. But you are not quite the person who lay down.' },
  { id: 'adrenaline', title: 'Adrenaline', text: 'The fear burns through you and out the other side, and leaves you sharp, fast and very clear.' },
];

export function panic(s: GameState, rng: Rng): void {
  const p = rng.pick(PANICS);
  s.player.stress = 2;
  let extra = '';
  switch (p.id) {
    case 'scream':
      s.noise += 3;
      for (const c of s.creatures) c.target = s.player.room;
      s.player.hidden = false;
      break;
    case 'freeze':
      s.player.diceNext -= 1;
      break;
    case 'drop':
      loseItem(s, rng, 'random');
      break;
    case 'bolt': {
      const ns = neighbours(s, s.player.room).filter((n) => !s.rooms[n]!.locked);
      if (ns.length) {
        const to = rng.pick(ns);
        s.player.room = to;
        s.player.hidden = false;
        s.noise += 2;
        extra = ` You end up in the ${roomName(s, to)}.`;
        revealAround(s);
        if (!s.rooms[to]!.explored) s.rooms[to]!.explored = true;
      }
      break;
    }
    case 'trauma': {
      const bad: TraitId[] = (['shaky', 'jumpy', 'numb', 'limp'] as TraitId[]).filter((t) => !s.player.traits.includes(t));
      if (bad.length) {
        const t = rng.pick(bad);
        s.player.traits.push(t);
        extra = ` New trait: ${TRAITS[t].name} (${TRAITS[t].desc})`;
      }
      break;
    }
    case 'adrenaline':
      s.player.diceNext += 1;
      break;
  }
  beat(s, `Panicked: ${p.title.toLowerCase()}.`);
  pushCard(s, { kind: 'panic', title: p.title, text: p.text + extra, art: 'panic', tone: 'danger' });
}

export function infect(s: GameState, rng: Rng, chance: number): void {
  if (s.player.role === 'android' || s.player.infected) return;
  if (!rng.chance(chance)) return;
  s.player.infected = true;
  s.player.infectionRounds = 0;
  if (s.player.role === 'medic') {
    s.player.infectionKnown = true;
    log(s, 'You know the signs. You are infected.', 'danger');
  }
  beat(s, 'Infected.');
}

export function revealAround(s: GameState): void {
  for (const n of neighbours(s, s.player.room)) s.rooms[n]!.known = true;
  s.rooms[s.player.room]!.known = true;
}

// ── creatures ──────────────────────────────────────────────────────────

export function spawnCreature(
  s: GameState,
  rng: Rng,
  which: 'primary' | 'brood' | CreatureKind,
  where: 'near' | 'nest' | 'here' | 'adjacent' | 'far',
  force = false,
): Creature | null {
  const inc = INCIDENTS[s.scenario.incident];
  const kind: CreatureKind = which === 'primary' ? inc.primary : which === 'brood' ? inc.brood : which;
  const cap = CREATURE_CAP[s.difficulty][act(s) - 1] ?? 4;
  if (!force && s.creatures.length >= cap) return null;
  let room: string | undefined;
  const dist = distances(s, s.player.room);
  const all = Object.keys(s.rooms);
  switch (where) {
    case 'here':
      room = s.player.room;
      break;
    case 'adjacent':
      room = rng.pick(neighbours(s, s.player.room));
      break;
    case 'near': {
      const opts = all.filter((r) => dist[r] === 2);
      room = opts.length ? rng.pick(opts) : rng.pick(neighbours(s, s.player.room));
      break;
    }
    case 'nest':
      if (s.progress.nestDestroyed) return null;
      room = s.scenario.nest;
      if (room === s.player.room) room = rng.pick(neighbours(s, room));
      break;
    case 'far': {
      const opts = all.filter((r) => (dist[r] ?? 0) >= 3);
      room = opts.length ? rng.pick(opts) : s.scenario.nest;
      break;
    }
  }
  const def = CREATURES[kind];
  const c: Creature = {
    id: s.nextCreatureId++,
    kind,
    room: room!,
    hp: def.hp,
    maxHp: def.hp,
    target: null,
    stunned: 0,
    hurtThisRound: 0,
    fresh: room === s.player.room,
  };
  s.creatures.push(c);
  return c;
}

export function killCreature(s: GameState, c: Creature, how: string): void {
  s.creatures = s.creatures.filter((x) => x.id !== c.id);
  s.progress.kills += 1;
  const name = creatureName(s, c);
  if (isPrimary(s, c)) {
    s.progress.primaryKilled = true;
    beat(s, `Killed ${INCIDENTS[s.scenario.incident].creature} ${how}.`);
  } else {
    beat(s, `Killed a ${name.toLowerCase()} ${how}.`);
  }
  if (s.scenario.personal === 'kill') {
    const inc = INCIDENTS[s.scenario.incident];
    const single = inc.primary !== inc.brood;
    if ((single && s.progress.primaryKilled) || (!single && s.progress.kills >= 3)) {
      if (!s.progress.personalDone) {
        s.progress.personalDone = true;
        log(s, 'Your secret objective is done: payback.', 'good');
      }
    }
  }
}

/** Badly hurt, burnt, or both: it runs to lick its wounds. */
export function retreat(s: GameState, rng: Rng, c: Creature): void {
  const dist = distances(s, s.player.room);
  const far = Object.keys(s.rooms).filter((r) => (dist[r] ?? 0) >= 3);
  const nest = s.progress.nestDestroyed ? null : s.scenario.nest;
  c.room = nest && nest !== s.player.room ? nest : far.length ? rng.pick(far) : c.room;
  c.target = null;
  c.fresh = false;
  c.stunned = 1;
  log(s, `${cap(creatureName(s, c))} shrieks and flees deeper into the ship.`, 'good');
}

// ── the story ──────────────────────────────────────────────────────────

export function findClue(s: GameState, index?: number): void {
  const inc = INCIDENTS[s.scenario.incident];
  let i = index;
  if (i === undefined) {
    for (let k = 0; k < inc.clues.length; k++) {
      if (!s.progress.clues.includes(k)) {
        i = k;
        break;
      }
    }
  }
  if (i === undefined || s.progress.clues.includes(i)) return;
  s.progress.clues.push(i);
  for (const r of Object.values(s.rooms)) if (r.clue === i) r.clue = null;
  const clue = inc.clues[i]!;
  const need = cluesNeeded(s);
  pushCard(s, {
    kind: 'clue',
    title: clue.who,
    text: clue.text,
    art: 'log',
    tone: 'strange',
  });
  log(s, `Log found: ${clue.who}. (${Math.min(s.progress.clues.length, need)}/${need})`, 'strange');
  if (!s.progress.truth && s.progress.clues.length >= need) {
    s.progress.truth = true;
    pushCard(s, {
      kind: 'truth',
      title: `The truth: ${inc.truthTitle}`,
      text: `${inc.truth(ctxOf(s))}\n\nFrom now on you fight ${inc.creature} with +1, and every hit on it does 1 extra damage.`,
      art: 'truth',
      tone: 'strange',
    });
    beat(s, 'Learned the truth.');
    if (s.scenario.personal === 'truth') s.progress.personalDone = true;
  }
}

export function recruit(s: GameState, index: number): void {
  const sv = s.survivors[index];
  if (!sv || s.companion) return;
  s.companion = { ...sv, index, hp: 2, roundsWithYou: 0 };
  beat(s, `${sv.name} joined you.`);
  log(s, `${sv.name} is with you. +1 die every round, and +1 to ${sv.helps} checks.`, 'good');
}

export function loseCompanion(s: GameState, rng: Rng, how: 'died' | 'turned' | 'left', killer?: string): void {
  const m = s.companion;
  if (!m) return;
  s.companion = null;
  if (how === 'died') {
    s.progress.companionsLost.push(m.name);
    beat(s, `${m.name} died${killer ? `, killed by ${killer}` : ''}.`);
    pushCard(s, {
      kind: 'companion',
      title: `${m.name.split(' ')[0]}`,
      text: `${m.name} goes down and doesn’t get up. There is no time. There is never any time. You close ${m.pronoun === 'they' ? 'their' : m.pronoun === 'she' ? 'her' : 'his'} eyes and you keep moving.`,
      art: 'body',
      tone: 'danger',
    });
    addStress(s, rng, 2);
  } else if (how === 'left') {
    beat(s, `Parted ways with ${m.name}.`);
  }
}

/** A companion who was never what they seemed. */
export function turnCompanion(s: GameState, rng: Rng): void {
  const m = s.companion;
  if (!m) return;
  const inc = INCIDENTS[s.scenario.incident];
  s.companion = null;
  s.progress.companionsLost.push(m.name);
  if (m.mimic) {
    const c = spawnCreature(s, rng, 'mimic', 'here', true);
    if (c) c.fresh = true;
    beat(s, `${m.name} was never ${m.name}.`);
    pushCard(s, {
      kind: 'encounter',
      title: `${m.name.split(' ')[0]} stops walking`,
      text: `${m.name} stops in the middle of the corridor and turns to you, and ${m.pronoun === 'they' ? 'their' : m.pronoun === 'she' ? 'her' : 'his'} face keeps turning after the head has stopped. “I liked being ${m.name.split(' ')[0]},” it says, in ${m.name.split(' ')[0]}’s voice. “I’ll like being you more.”`,
      art: 'mimic',
      tone: 'danger',
    });
    addStress(s, rng, 3);
  } else {
    const c = spawnCreature(s, rng, 'brood', 'here', true);
    if (c) c.fresh = true;
    beat(s, `${m.name} turned.`);
    pushCard(s, {
      kind: 'encounter',
      title: `${m.name.split(' ')[0]} is gone`,
      text: `${m.name} has been quiet for a while. When you turn round, ${m.pronoun} is standing very still, head cocked, listening to something you can’t hear. Then ${m.pronoun} looks at you, and there is nobody behind the eyes. Just ${inc.creature}.`,
      art: 'changed',
      tone: 'danger',
    });
    addStress(s, rng, 2);
  }
}

// ── the generic effect ─────────────────────────────────────────────────

export function applyEffect(s: GameState, rng: Rng, e: Effect | undefined, ec: EffectCtx = {}): void {
  if (!e) return;
  if (e.noise) {
    s.noise += e.noise;
    if (e.noise > 0) s.player.hidden = false;
  }
  if (e.hp) {
    if (e.hp < 0) damage(s, -e.hp, 'wounds');
    else heal(s, e.hp);
  }
  if (e.heal) {
    const n = heal(s, e.heal);
    if (n) log(s, `+${n} health.`, 'good');
  }
  if (e.clock) {
    s.clock = Math.max(0, Math.min(s.clockMax + 6, s.clock + e.clock));
    log(s, e.clock > 0 ? `+${e.clock} rounds on the clock.` : `The clock loses ${-e.clock}.`, e.clock > 0 ? 'good' : 'danger');
  }
  if (e.item) giveItem(s, e.item);
  if (e.loseItem) loseItem(s, rng, e.loseItem);
  if (e.spawn) {
    const c = spawnCreature(s, rng, e.spawn.kind, e.spawn.where);
    if (c && c.room === s.player.room) s.progress.roundsSinceScare = 0;
  }
  if (e.alertAll) for (const c of s.creatures) c.target = s.player.room;
  if (e.distract) for (const c of s.creatures) c.target = null;
  if (e.hazard) {
    let room = s.player.room;
    if (e.hazard.where === 'random') {
      const opts = Object.keys(s.rooms).filter((r) => r !== s.player.room && !s.rooms[r]!.hazards.includes(e.hazard!.type));
      if (opts.length) room = rng.pick(opts);
    } else if (e.hazard.where === 'adjacent') {
      room = rng.pick(neighbours(s, s.player.room));
    }
    addHazard(s, room, e.hazard.type);
  }
  if (e.clearHazard) {
    const r = s.rooms[s.player.room]!;
    r.hazards = r.hazards.filter((h) => h !== e.clearHazard);
  }
  if (e.revealMap) {
    for (const r of Object.values(s.rooms)) r.known = true;
    s.progress.mapRevealed = true;
    log(s, 'Every room on the map is named now.', 'good');
  }
  if (e.cameras) s.progress.camerasRounds = Math.max(s.progress.camerasRounds, e.cameras);
  if (e.clue) findClue(s);
  if (e.infect) infect(s, rng, e.infect);
  if (e.cure) {
    s.player.infected = false;
    s.player.infectionRounds = 0;
    beat(s, 'Purged the infection.');
  }
  if (e.scan) scan(s, rng);
  if (e.diceNext) s.player.diceNext += e.diceNext;
  if (e.trait && !s.player.traits.includes(e.trait)) {
    s.player.traits.push(e.trait);
    log(s, `New trait: ${TRAITS[e.trait].name}. ${TRAITS[e.trait].desc}`, TRAITS[e.trait].good ? 'good' : 'danger');
  }
  if (e.companionHp && s.companion) {
    s.companion.hp = Math.min(3, s.companion.hp + e.companionHp);
    if (s.companion.hp <= 0) loseCompanion(s, rng, 'died');
  }
  if (e.step) s.progress.steps[e.step.exit][e.step.step] = true;
  if (e.flag) handleFlag(s, rng, e.flag);
  if (e.stunAll) {
    const near = new Set([s.player.room, ...neighbours(s, s.player.room)]);
    for (const c of s.creatures) if (near.has(c.room)) c.stunned = Math.max(c.stunned, e.stunAll);
  }
  if (e.repelHere) for (const c of s.creatures.filter((c) => c.room === s.player.room)) retreat(s, rng, c);
  if (e.killHere) {
    for (const c of s.creatures.filter((c) => c.room === s.player.room)) killCreature(s, c, 'out of the airlock');
    s.rooms[s.player.room]!.spent = true;
  }
  if (e.destroyNest) {
    s.progress.nestDestroyed = true;
    const inc = INCIDENTS[s.scenario.incident];
    log(s, inc.nestAction.done, 'good');
    beat(s, `Destroyed the ${inc.nestName.toLowerCase()}.`);
    s.rooms[s.player.room]!.spent = true;
  }
  if (e.selfDestruct) {
    s.progress.selfDestruct = true;
    s.clock = Math.min(s.clock, 6);
    beat(s, 'Armed the reactor overload.');
  }
  if (e.rescue) {
    s.progress.steps.beacon[1] = true;
    s.progress.rescueIn = RESCUE_ROUNDS;
    for (const c of s.creatures) c.target = s.player.room;
    beat(s, 'Sent the distress call.');
  }
  if (e.wipe) {
    s.progress.wiped = true;
    if (s.scenario.personal === 'wipe') s.progress.personalDone = true;
    beat(s, 'Wiped the research records.');
  }
  if (e.hide) s.player.hidden = true;
  if (e.unlock) s.rooms[s.player.room]!.locked = false;
  if (e.recruit && ec.survivor !== undefined) recruit(s, ec.survivor);
  if (e.dismiss && s.companion) loseCompanion(s, rng, 'left');
  if (e.turnCompanion) turnCompanion(s, rng);
  if (e.stress) addStress(s, rng, e.stress);
  if (e.win) s.progress.flags.push(`win:${e.win}`);
}

export function addHazard(s: GameState, room: string, type: 'fire' | 'dark' | 'breach'): void {
  const r = s.rooms[room]!;
  if (!r.hazards.includes(type)) r.hazards.push(type);
  if (type === 'fire') r.fireRounds = 3;
  if (room === s.player.room) {
    log(s, { fire: 'The room is on fire around you.', dark: 'The lights here die.', breach: 'This room is open to space. The air is going.' }[type], 'danger');
  } else {
    log(s, { fire: `Fire breaks out in the ${roomName(s, room)}.`, dark: `The lights go out in the ${roomName(s, room)}.`, breach: `The ${roomName(s, room)} is open to space.` }[type], 'danger');
  }
  if (room !== s.player.room) r.known = true;
}

function scan(s: GameState, rng: Rng): void {
  s.player.infectionKnown = true;
  const lines: string[] = [];
  lines.push(s.player.infected ? 'Your scan comes back dark with it. You are infected.' : 'Your scan comes back clean.');
  const m = s.companion;
  if (m) {
    if (m.mimic) {
      lines.push(`Then the arm passes over ${m.name}. Where a heartbeat should be, there is nothing at all.`);
      pushCard(s, { kind: 'info', title: 'The scan', text: lines.join(' '), art: 'scan', tone: 'danger' });
      turnCompanion(s, rng);
      return;
    }
    lines.push(m.infected ? `${m.name}’s scan lights up like a city at night. ${cap(m.pronoun)} is infected, and has been for a long time.` : `${m.name} is clean.`);
    if (m.infected) {
      s.progress.flags.push('mate-infected-known');
      lines.push(`You should leave ${m.pronoun === 'they' ? 'them' : m.pronoun === 'she' ? 'her' : 'him'}. You know you should.`);
    }
  }
  pushCard(s, { kind: 'info', title: 'The scan', text: lines.join(' '), art: 'scan', tone: s.player.infected ? 'danger' : 'calm' });
}

function handleFlag(s: GameState, rng: Rng, flag: string): void {
  s.progress.flags.push(flag);
  const [name, arg] = flag.split(':');
  if (name === 'mimic-revealed') {
    const c = spawnCreature(s, rng, 'mimic', 'here', true);
    if (c) c.fresh = true;
    addStress(s, rng, 2);
    beat(s, `Caught the thing wearing ${s.survivors[Number(arg)]?.name}.`);
  } else if (name === 'mimic-fled') {
    const c = spawnCreature(s, rng, 'mimic', 'adjacent', true);
    if (c) c.target = s.player.room;
  } else if (name === 'safe-pistol') {
    giveItem(s, 'pistol');
  }
}

export function describeRoom(s: GameState, id: string): string {
  const r = s.rooms[id]!;
  if (r.type === 'nest') return INCIDENTS[s.scenario.incident].nestDesc;
  const variants = ROOMS[r.type].desc;
  return variants[(id.charCodeAt(1) + s.seed.length) % variants.length]!;
}
