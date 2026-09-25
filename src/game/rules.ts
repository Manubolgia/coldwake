import { CREATURES } from './content/creatures';
import type { Ctx } from './content/ctx';
import { INCIDENTS } from './content/incidents';
import { ITEMS } from './content/items';
import { TRAITS } from './content/roles';
import { ROOMS } from './content/rooms';
import type { Band, CardKind, Creature, GameState, ItemId, RoomState, Stat, StoryCard } from './types';

export const CLEAN_AT = 6;

export function bandOf(total: number, target = CLEAN_AT): Band {
  if (total >= target) return 'clean';
  if (total >= target - 2) return 'cost';
  return 'fail';
}

export function roomName(s: GameState, id: string): string {
  const r = s.rooms[id]!;
  if (r.type === 'nest') return INCIDENTS[s.scenario.incident].nestName;
  return ROOMS[r.type].name;
}

export function roomShort(s: GameState, id: string): string {
  const r = s.rooms[id]!;
  if (r.type === 'nest') return 'Nest';
  return ROOMS[r.type].short;
}

export function hereRoom(s: GameState): RoomState {
  return s.rooms[s.player.room]!;
}

export function hasItem(s: GameState, id: ItemId): boolean {
  return s.player.items.some((i) => i.id === id);
}

export function creatureName(s: GameState, c: Creature | Creature['kind']): string {
  const kind = typeof c === 'string' ? c : c.kind;
  const inc = INCIDENTS[s.scenario.incident];
  if (kind === inc.primary && kind !== inc.brood) return cap(inc.creature.replace(/^the /i, ''));
  if (kind === inc.brood) return cap(inc.brood_name);
  return CREATURES[kind].name;
}

export function isPrimary(s: GameState, c: Creature): boolean {
  const inc = INCIDENTS[s.scenario.incident];
  return c.kind === inc.primary && inc.primary !== inc.brood;
}

export function cap(t: string): string {
  return t ? t[0]!.toUpperCase() + t.slice(1) : t;
}

export function creaturesIn(s: GameState, room: string): Creature[] {
  return s.creatures.filter((c) => c.room === room);
}

/** Stat plus traits, tool bonuses and your companion's help. */
export function statParts(s: GameState, stat: Stat): { total: number; parts: string[] } {
  const parts: string[] = [];
  let total = s.player.stats[stat];
  if (s.player.stats[stat]) parts.push(`${sign(s.player.stats[stat])} ${statLabel(stat)}`);
  for (const t of s.player.traits) {
    const d = TRAITS[t].stat?.[stat];
    if (d) {
      total += d;
      parts.push(`${sign(d)} ${TRAITS[t].name}`);
    }
  }
  let best = 0;
  let bestName = '';
  for (const it of s.player.items) {
    const b = ITEMS[it.id].bonus;
    if (b && b.stat === stat && b.amount > best) {
      best = b.amount;
      bestName = ITEMS[it.id].name;
    }
  }
  if (best) {
    total += best;
    parts.push(`${sign(best)} ${bestName}`);
  }
  if (s.companion && s.companion.helps === stat) {
    total += 1;
    parts.push(`+1 ${s.companion.name.split(' ')[0]}`);
  }
  return { total, parts };
}

export function statLabel(stat: Stat): string {
  return stat[0]!.toUpperCase() + stat.slice(1);
}

export function sign(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}

export function ctxOf(s: GameState): Ctx {
  const inc = INCIDENTS[s.scenario.incident];
  const mate = s.companion;
  return {
    ship: s.scenario.shipName,
    shipClass: s.scenario.shipClass,
    you: s.player.name.split(' ')[0]!,
    creature: inc.creature,
    brood: inc.brood_name,
    broods: inc.brood_plural,
    nest: inc.nestName,
    mate: mate ? mate.name.split(' ')[0]! : 'nobody',
    mateThey: mate ? mate.pronoun : 'they',
    room: roomName(s, s.player.room),
    clockKind: s.scenario.clockKind,
  };
}

export function log(s: GameState, text: string, tone?: StoryCard['tone']): void {
  if (!text) return;
  s.log.push(tone ? { round: s.round, text, tone } : { round: s.round, text });
  if (s.log.length > 400) s.log.splice(0, s.log.length - 400);
}

export function beat(s: GameState, text: string): void {
  s.beats.push({ round: s.round, text });
}

export function pushCard(
  s: GameState,
  card: Omit<StoryCard, 'uid' | 'choices'> & { choices?: StoryCard['choices']; kind: CardKind },
): void {
  s.cards.push({ ...card, choices: card.choices ?? [], uid: s.nextCardId++ });
}

export function act(s: GameState): 1 | 2 | 3 {
  const frac = s.clock / s.clockMax;
  if (frac > 0.66) return 1;
  if (frac > 0.33) return 2;
  return 3;
}

export function cluesNeeded(s: GameState): number {
  return s.player.role === 'scientist' ? 2 : 3;
}
