import { ROOM_ACTIONS, type RoomActionDef } from './content/actions';
import { CREATURES, huntEvery } from './content/creatures';
import { EXITS } from './content/exits';
import { INCIDENTS } from './content/incidents';
import { ITEMS } from './content/items';
import { ROOMS } from './content/rooms';
import { distance, distances, neighbours, stepToward } from './map';
import {
  bandOf,
  cap,
  creatureName,
  creaturesIn,
  hasItem,
  hereRoom,
  roomName,
  statLabel,
  statParts,
} from './rules';
import type { ActionOption, Band, Creature, Die, GameState, ItemInst, Outcome, Stat } from './types';

export interface Weapon {
  index: number;
  name: string;
  fight: number;
  damage: number;
  fire: boolean;
  stun: boolean;
  loud: number;
  uses?: number;
}

export function weapons(s: GameState): Weapon[] {
  const out: Weapon[] = [];
  s.player.items.forEach((it, index) => {
    const d = ITEMS[it.id];
    if (d.kind !== 'weapon') return;
    if (it.uses !== undefined && it.uses <= 0) return;
    out.push({
      index,
      name: d.name,
      fight: d.fight ?? 0,
      damage: d.damage ?? 1,
      fire: !!d.fire,
      stun: !!d.stun,
      loud: d.loud ?? 0,
      uses: it.uses,
    });
  });
  if (!out.length) out.push({ index: -1, name: 'bare hands', fight: 0, damage: 1, fire: false, stun: false, loud: 0 });
  return out.sort((a, b) => b.damage + b.fight - (a.damage + a.fight));
}

export function unusedDice(s: GameState): Die[] {
  return s.dice.filter((d) => !d.used);
}

export function visibleCreatures(s: GameState): Creature[] {
  if (s.progress.camerasRounds > 0) return s.creatures.slice();
  const range = hasItem(s, 'tracker') ? 2 : 1;
  const dist = distances(s, s.player.room);
  return s.creatures.filter((c) => (dist[c.room] ?? 99) <= range);
}

export function hearingRadius(s: GameState): number {
  return Math.min(4, s.noise);
}

export interface Plan {
  id: number;
  kind: 'attack' | 'arrive' | 'approach' | 'search' | 'wander' | 'stunned' | 'lured' | 'wait' | 'leave';
  to?: string;
  damage?: number;
}

/** What a creature will do when the round ends, if nothing else changes. */
export function planCreature(s: GameState, c: Creature): Plan {
  const def = CREATURES[c.kind];
  if (c.stunned > 0) return { id: c.id, kind: 'stunned' };
  const lure = s.progress.lure;
  if (lure && distance(s, c.room, lure) <= 3) {
    return { id: c.id, kind: 'lured', to: c.room === lure ? lure : stepToward(s, c.room, lure) };
  }
  if (c.room === s.player.room) {
    if (s.player.hidden) return { id: c.id, kind: 'leave' };
    if (c.fresh) return { id: c.id, kind: 'wait' };
    return { id: c.id, kind: 'attack', damage: def.damage };
  }
  if (def.slow && s.round % 2 === 1) return { id: c.id, kind: 'wait' };
  const d = distance(s, c.room, s.player.room);
  const radius = hearingRadius(s);
  let target = c.target;
  if (radius > 0 && d <= radius + def.hearing) target = s.player.room;
  else if (huntEvery(def, s.difficulty) && s.round % huntEvery(def, s.difficulty)! === 0) target = s.player.room;
  if (!target) return { id: c.id, kind: 'wander' };
  let room = c.room;
  for (let i = 0; i < def.speed; i++) {
    room = stepToward(s, room, target);
    if (room === s.player.room) break;
  }
  if (room === s.player.room) return { id: c.id, kind: 'arrive', to: room };
  if (target === s.player.room) return { id: c.id, kind: 'approach', to: room };
  return { id: c.id, kind: 'search', to: room };
}

// ── outcome helpers ───────────────────────────────────────────────────

function outcomes(
  s: GameState,
  base: number,
  target: number,
  sums: Record<Band, string>,
  opts: { neverFail?: boolean; override?: (die: Die) => Band | null } = {},
): Record<number, Outcome> {
  const out: Record<number, Outcome> = {};
  for (const d of unusedDice(s)) {
    const total = d.value + base;
    let band = opts.override?.(d) ?? bandOf(total, target);
    if (opts.neverFail && band === 'fail') band = 'cost';
    out[d.id] = { band, total, summary: sums[band] };
  }
  return out;
}

function flatOutcomes(s: GameState, summary: string): Record<number, Outcome> {
  const out: Record<number, Outcome> = {};
  for (const d of unusedDice(s)) out[d.id] = { band: 'clean', total: d.value, summary };
  return out;
}

function contextMods(s: GameState, stat: Stat | undefined, kind: 'search' | 'act' | 'hide'): { mod: number; notes: string[] } {
  const notes: string[] = [];
  let mod = 0;
  const room = hereRoom(s);
  const dark = room.hazards.includes('dark');
  if (kind === 'hide') {
    if (dark) {
      mod += 1;
      notes.push('+1 dark');
    }
    if (room.type === 'maintenance') {
      mod += 1;
      notes.push('+1 vents');
    }
  } else if (dark && (stat === 'wits' || stat === 'tech') && !hasItem(s, 'flashlight')) {
    mod -= 1;
    notes.push('−1 dark');
  }
  if (kind === 'search' && hasItem(s, 'flashlight')) {
    mod += 1;
    notes.push('+1 Flashlight');
  }
  if (stat && creaturesIn(s, s.player.room).some((c) => c.stunned === 0)) {
    mod -= 1;
    notes.push('−1 something is here');
  }
  return { mod, notes };
}

function direction(s: GameState, from: string, to: string): string {
  const a = s.rooms[from]!;
  const b = s.rooms[to]!;
  if (b.x > a.x) return 'east';
  if (b.x < a.x) return 'west';
  if (b.y > a.y) return 'south';
  return 'north';
}

function roomActionAvailable(s: GameState, def: RoomActionDef): boolean {
  const room = hereRoom(s);
  if (!def.rooms.includes(room.type)) return false;
  if (def.limit !== undefined && room.used.filter((u) => u === def.id).length >= def.limit) return false;
  if (def.step) {
    const { exit, step } = def.step;
    if (!s.scenario.exits.includes(exit)) return false;
    const steps = s.progress.steps[exit];
    if (steps[step]) return false;
    const final = step === EXITS[exit].steps.length - 1;
    if (final && !steps.slice(0, step).every(Boolean)) return false;
    if (exit === 'beacon' && step === 1 && !steps[0]) return false;
  }
  if (def.when && !def.when(s)) return false;
  return true;
}

export function roomActionMods(s: GameState, def: RoomActionDef): { base: number; notes: string[]; flat: boolean } {
  if (def.id === 'pods-1' && hasItem(s, 'codes')) return { base: 0, notes: ['Command codes'], flat: true };
  if (!def.stat) return { base: 0, notes: [], flat: true };
  const sp = statParts(s, def.stat);
  const ctx = contextMods(s, def.stat, 'act');
  const notes = [...sp.parts, ...ctx.notes];
  let base = sp.total + ctx.mod + (def.mod ?? 0);
  if (def.mod) notes.push(`${def.mod > 0 ? '+' : '−'}${Math.abs(def.mod)} hard`);
  if (def.id === 'nest' && weapons(s).some((w) => w.fire)) {
    base += 2;
    notes.push('+2 fire');
  }
  return { base, notes, flat: false };
}

export function neverFails(s: GameState, def: { stat?: Stat; flight?: boolean }): boolean {
  if (s.player.role === 'engineer' && def.stat === 'tech') return true;
  if (s.player.role === 'pilot' && def.flight) return true;
  return false;
}

// ── the list ──────────────────────────────────────────────────────────

export function getActions(s: GameState): ActionOption[] {
  if (s.status !== 'playing' || s.cards.length > 0) return [];
  const opts: ActionOption[] = [];
  const room = hereRoom(s);
  const here = creaturesIn(s, s.player.room);
  const hasDice = unusedDice(s).length > 0;
  const truth = s.progress.truth;
  const marine = s.player.role === 'marine';

  // ── danger ──
  if (here.length) {
    const ws = weapons(s);
    const sorted = here.slice().sort((a, b) => CREATURES[b.kind].damage - CREATURES[a.kind].damage);
    sorted.forEach((c, ci) => {
      const def = CREATURES[c.kind];
      const usable = ci === 0 ? ws.slice(0, 3) : ws.slice(0, 1);
      for (const w of usable) {
        const sp = statParts(s, 'might');
        const notes = [...sp.parts];
        let base = sp.total + w.fight;
        if (w.fight) notes.push(`+${w.fight} ${w.name}`);
        if (truth) {
          base += 1;
          notes.push('+1 the truth');
        }
        const dmg = w.damage + (truth ? 1 : 0);
        const cleanDmg = dmg + (marine ? 1 : 0);
        const kills = dmg >= c.hp;
        const cleanKills = cleanDmg >= c.hp;
        const extra = w.fire && !kills ? ', it flees' : w.stun && !kills ? ', stunned' : '';
        const name = creatureName(s, c);
        opts.push({
          id: 'fight',
          target: `${c.id}:${w.index}`,
          group: 'danger',
          label: `Fight the ${name.toLowerCase()}`,
          desc: `With ${w.index < 0 ? 'your bare hands' : `the ${w.name.toLowerCase()}`}: ${cleanDmg} damage${w.uses !== undefined ? `, ${w.uses} left` : ''}. It has ${c.hp}/${c.maxHp} health and needs ${def.guard}+ to hit cleanly.`,
          icon: w.fire ? 'fire' : 'fight',
          stat: 'might',
          noise: 2 + w.loud,
          mods: notes,
          outcomes: outcomes(s, base, def.guard, {
            clean: cleanKills ? 'Kill it' : `Hit: ${cleanDmg} damage${cleanKills ? '' : extra}`,
            cost: kills ? `Kill it, take 1 damage` : `Hit ${dmg}${extra}, take 1 damage`,
            fail: `Miss, take ${def.damage} damage`,
          }),
        });
      }
    });
  }

  // ── goal and room actions ──
  for (const def of ROOM_ACTIONS) {
    if (!roomActionAvailable(s, def)) continue;
    const m = roomActionMods(s, def);
    const inc = INCIDENTS[s.scenario.incident];
    const label = def.id === 'nest' ? inc.nestAction.label : def.label;
    const desc = def.id === 'nest' ? `${inc.nestAction.desc} Much easier with fire.` : def.desc;
    const exitName = def.step ? EXITS[def.step.exit].name : '';
    const sums = {
      clean: def.clean.sum,
      cost: (def.cost ?? def.clean).sum,
      fail: (def.fail ?? def.cost ?? def.clean).sum,
    };
    let progressNote = '';
    if (def.work) {
      const have = s.progress.work[def.id] ?? 0;
      const left = def.work - have;
      const extra = (def.cost?.sum ?? '').replace(/^Done,?\s*/, '');
      sums.clean = left <= 2 ? 'Done' : 'Progress +2';
      sums.cost = (left <= 1 ? 'Done' : 'Progress +1') + (extra ? `, ${extra}` : '');
      progressNote = ` Progress ${have}/${def.work}: a clean result does 2, a cost does 1.`;
    }
    opts.push({
      id: def.id,
      group: def.group,
      label,
      desc: def.step ? `${exitName} · step ${def.step.step + 1} of 3. ${def.desc}${progressNote}` : desc,
      icon: def.icon,
      stat: m.flat ? undefined : def.stat,
      noise: def.noise,
      mods: m.notes,
      flat: m.flat,
      outcomes: m.flat
        ? flatOutcomes(s, def.clean.sum)
        : outcomes(
            s,
            m.base,
            6,
            sums,
            { neverFail: neverFails(s, def) },
          ),
    });
  }

  // ── search ──
  if (room.searchesLeft > 0) {
    const sp = statParts(s, 'wits');
    const ctx = contextMods(s, 'wits', 'search');
    opts.push({
      id: 'search',
      group: 'room',
      label: `Search the ${roomName(s, room.id).replace(/^The /, '').toLowerCase()}`,
      desc: `Lockers, drawers, bodies. ${room.searchesLeft} search${room.searchesLeft > 1 ? 'es' : ''} left here.`,
      icon: 'search',
      stat: 'wits',
      noise: 1,
      mods: [...sp.parts, ...ctx.notes],
      outcomes: outcomes(s, sp.total + ctx.mod, 6, {
        clean: 'Find the best of two',
        cost: 'Find something',
        fail: 'Nothing, more noise',
      }),
    });
  }

  // ── hide ──
  if (!s.player.hidden && ROOMS[room.type].cover) {
    const sp = statParts(s, 'wits');
    const ctx = contextMods(s, 'wits', 'hide');
    const threat = here.length > 0;
    const base = sp.total + ctx.mod;
    opts.push({
      id: 'hide',
      group: threat ? 'danger' : 'room',
      label: 'Hide',
      desc: threat
        ? 'Get out of sight. If it can’t find you it won’t attack, and it will move on.'
        : 'Stay out of sight. Anything that comes in won’t see you. Breaks when you make noise or move.',
      icon: 'hide',
      stat: 'wits',
      noise: 0,
      mods: [...sp.parts, ...ctx.notes],
      outcomes: outcomes(s, base, 6, {
        clean: 'Hidden',
        cost: 'Hidden, +1 stress',
        fail: 'Spotted, noise',
      }),
    });
  }

  // ── pick up ──
  room.floor.forEach((it, i) => {
    opts.push({
      id: 'take',
      target: String(i),
      group: 'room',
      label: `Pick up the ${ITEMS[it.id].name.toLowerCase()}`,
      desc: `You left it here. Free — no die needed.${s.player.items.length >= 6 ? ' Your hands are full: drop something first from You.' : ''}`,
      icon: 'box',
      noise: 0,
      mods: [],
      flat: true,
      outcomes: {},
      disabled: s.player.items.length >= 6 ? 'Hands full' : undefined,
    });
  });

  // ── kit ──
  s.player.items.forEach((it, index) => {
    for (const o of itemOptions(s, it, index)) opts.push(o);
  });

  // ── moves ──
  for (const n of neighbours(s, s.player.room)) {
    const r = s.rooms[n]!;
    const name = r.known ? roomName(s, n) : 'unexplored room';
    const dir = direction(s, s.player.room, n);
    const fleeing = here.some((c) => c.stunned === 0);
    const worst = here.reduce((m, c) => Math.max(m, c.stunned ? 0 : CREATURES[c.kind].damage), 0);
    const warnings: string[] = [];
    if (r.hazards.includes('fire')) warnings.push('On fire: 1 damage each round you end there.');
    if (r.hazards.includes('breach')) warnings.push('Open to space: 1 damage each round you end there.');
    if (!r.explored) warnings.push('You haven’t been in there yet.');
    const lockedNoKey = r.locked && !hasItem(s, 'keycard') && !hasItem(s, 'codes');
    if (lockedNoKey) {
      const sp = statParts(s, 'might');
      opts.push({
        id: 'force',
        target: n,
        group: 'move',
        label: `Force the door to the ${name}`,
        desc: `Locked. A keycard would open it quietly. ${warnings.join(' ')}`.trim(),
        icon: 'door',
        stat: 'might',
        noise: 1,
        mods: [...sp.parts, '−1 hard'],
        outcomes: outcomes(s, sp.total - 1, 6, {
          clean: 'Open it and go in',
          cost: 'Open it, very loud',
          fail: 'It holds, noise',
        }),
      });
      continue;
    }
    const sp = statParts(s, 'wits');
    const stowaway = s.player.role === 'stowaway';
    opts.push({
      id: 'move',
      target: n,
      group: 'move',
      label: `${r.known ? '' : ''}Go ${dir} to the ${name}`,
      desc: [r.locked ? 'Locked — your card opens it.' : '', fleeing ? `Running from a fight: on a fail it strikes you as you go (${worst} damage).` : '', ...warnings]
        .filter(Boolean)
        .join(' '),
      icon: 'move',
      stat: 'wits',
      noise: 0,
      mods: [...sp.parts, ...(stowaway ? ['Ghost: 4+ is silent'] : [])],
      outcomes: outcomes(
        s,
        sp.total,
        6,
        {
          clean: 'Silent',
          cost: 'A little noise',
          fail: fleeing ? `Loud, take ${worst} damage` : 'Loud',
        },
        { override: stowaway ? (d) => (d.value >= 4 ? 'clean' : null) : undefined },
      ),
    });
  }

  if (!hasDice) {
    for (const o of opts) {
      if (o.id !== 'take' && !o.disabled) o.disabled = 'No dice left';
    }
  }
  return opts;
}

function itemOptions(s: GameState, it: ItemInst, index: number): ActionOption[] {
  const d = ITEMS[it.id];
  if (!d.usable) return [];
  const base = { group: 'kit' as const, noise: 0, mods: [] as string[], flat: true, icon: it.id };
  switch (it.id) {
    case 'medkit': {
      const n = 2 + (s.player.role === 'medic' ? 1 : 0) - (s.player.role === 'android' ? 1 : 0);
      return [{ ...base, id: 'use', target: String(index), label: 'Use the medkit', desc: d.desc, outcomes: flatOutcomes(s, `Heal ${n}`) }];
    }
    case 'stim':
      return [{ ...base, id: 'use', target: String(index), label: 'Use the stim', desc: d.desc, outcomes: flatOutcomes(s, '+1 die now, −1 stress') }];
    case 'sedative':
      return [{ ...base, id: 'use', target: String(index), label: 'Take the sedatives', desc: d.desc, outcomes: flatOutcomes(s, '−3 stress') }];
    case 'emp':
      return [{ ...base, id: 'use', target: String(index), label: 'Set off the EMP', desc: d.desc, noise: 1, outcomes: flatOutcomes(s, 'Stun all nearby, 2 rounds') }];
    case 'foam': {
      const r = hereRoom(s);
      if (!r.hazards.includes('fire') && !r.hazards.includes('breach')) return [];
      return [{ ...base, id: 'use', target: String(index), label: r.hazards.includes('fire') ? 'Foam the fire' : 'Seal the breach', desc: d.desc, outcomes: flatOutcomes(s, 'Hazard gone') }];
    }
    case 'flare':
      return neighbours(s, s.player.room).map((n) => ({
        ...base,
        id: 'use',
        target: `${index}:${n}`,
        label: `Throw a flare into the ${s.rooms[n]!.known ? roomName(s, n) : 'unexplored room'}`,
        desc: 'Everything within three rooms of it goes there this round — even things in here with you.',
        icon: 'flare',
        outcomes: flatOutcomes(s, 'Lure them away'),
      }));
    default:
      return [];
  }
}

export function describePlan(s: GameState, p: Plan): string {
  const c = s.creatures.find((x) => x.id === p.id);
  if (!c) return '';
  const name = cap(creatureName(s, c));
  switch (p.kind) {
    case 'attack':
      return `${name} will attack you for ${p.damage}`;
    case 'arrive':
      return `${name} will reach you`;
    case 'approach':
      return `${name} is coming toward you`;
    case 'search':
      return `${name} is heading where it last heard you`;
    case 'wander':
      return `${name} is wandering`;
    case 'stunned':
      return `${name} is stunned`;
    case 'lured':
      return `${name} will chase the flare`;
    case 'wait':
      return `${name} is sizing you up`;
    case 'leave':
      return `${name} can’t find you and will move on`;
  }
}

export { statLabel };
