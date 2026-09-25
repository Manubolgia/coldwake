import type { CreatureKind } from '../types';

export interface CreatureDef {
  kind: CreatureKind;
  name: string;
  plural: string;
  desc: string;
  hp: number;
  /** Total needed to hit it cleanly. Two under still hits, but it hits back. */
  guard: number;
  damage: number;
  /** Stress when it finds you, or you it. */
  horror: number;
  /** Rooms per move. */
  speed: number;
  /** Only moves on even rounds. */
  slow?: boolean;
  /** Extra rooms of hearing. */
  hearing: number;
  /** Comes for you every N rounds whether you made noise or not. */
  hunts?: number;
  /** Retreats instead of dying when badly hurt. */
  retreats?: boolean;
  /** Chance a wound from it infects you. */
  infect: number;
  behaviour: string;
}

export const CREATURES: Record<CreatureKind, CreatureDef> = {
  stalker: {
    kind: 'stalker',
    name: 'Stalker',
    plural: 'Stalkers',
    desc: 'Taller than the doorways. It moves like it has all the time in the world.',
    hp: 6,
    guard: 6,
    damage: 2,
    horror: 2,
    speed: 1,
    hearing: 0,
    hunts: 2,
    retreats: true,
    infect: 0,
    behaviour: 'Hunts by sound, and comes looking every few rounds even when you are quiet. Hurt it badly or burn it and it retreats.',
  },
  crawler: {
    kind: 'crawler',
    name: 'Crawler',
    plural: 'Crawlers',
    desc: 'Dog-sized, too many legs, fast on walls.',
    hp: 1,
    guard: 3,
    damage: 1,
    horror: 1,
    speed: 1,
    hearing: 0,
    infect: 0.25,
    behaviour: 'Weak alone. Follows noise. Its bite can infect.',
  },
  changed: {
    kind: 'changed',
    name: 'Changed',
    plural: 'Changed',
    desc: 'Still wearing a crew jumpsuit. Still wearing a face, mostly.',
    hp: 2,
    guard: 4,
    damage: 1,
    horror: 1,
    speed: 1,
    slow: true,
    hearing: 1,
    infect: 0.35,
    behaviour: 'Slow — moves every other round — but hears from further away. Its touch can infect.',
  },
  drone: {
    kind: 'drone',
    name: 'Drone',
    plural: 'Drones',
    desc: 'A maintenance frame with the safety governors burned out.',
    hp: 3,
    guard: 5,
    damage: 2,
    horror: 1,
    speed: 1,
    hearing: 1,
    infect: 0,
    behaviour: 'Sensitive microphones: hears a room further. An EMP wrecks it.',
  },
  mimic: {
    kind: 'mimic',
    name: 'Mimic',
    plural: 'Mimics',
    desc: 'It still has some of their face. It is using it to smile.',
    hp: 4,
    guard: 5,
    damage: 2,
    horror: 3,
    speed: 1,
    hearing: 0,
    hunts: 2,
    retreats: true,
    infect: 0,
    behaviour: 'Hunts you every other round. Hurt it badly and it retreats to heal.',
  },
};

/** How many creatures may be aboard at once, by act. */
/** How often a creature hunts you with no noise at all. Nightmare makes everything hunt. */
export function huntEvery(def: CreatureDef, difficulty: 'story' | 'standard' | 'nightmare'): number | undefined {
  if (def.hunts) return def.hunts;
  return difficulty === 'nightmare' ? 3 : undefined;
}

export const CREATURE_CAP: Record<'story' | 'standard' | 'nightmare', [number, number, number]> = {
  story: [2, 3, 3],
  standard: [3, 4, 5],
  nightmare: [3, 5, 6],
};

/** Rounds between the nest breeding, by act. */
export const BREED_EVERY: Record<'story' | 'standard' | 'nightmare', [number, number, number]> = {
  story: [8, 6, 5],
  standard: [7, 5, 4],
  nightmare: [5, 4, 3],
};
