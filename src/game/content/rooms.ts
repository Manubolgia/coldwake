import type { ItemId, RoomType } from '../types';

export interface RoomDef {
  type: RoomType;
  name: string;
  /** Map label. Whole words only — the map shrinks long ones to fit. */
  short: string;
  desc: string[];
  cover: boolean;
  searches: number;
  loot: ItemId[];
  accent: string;
  locked?: boolean;
}

export const ROOMS: Record<RoomType, RoomDef> = {
  cryo: {
    type: 'cryo',
    name: 'Cryo Bay',
    short: 'Cryo',
    desc: [
      'Nine pods in a ring, lids open, frost melting into puddles. Yours is the only one that was ever meant to open.',
      'The pods hiss and tick as they warm. Somebody drew a line through every name on the roster but yours.',
    ],
    cover: true,
    searches: 1,
    loot: ['stim', 'sedative', 'flashlight'],
    accent: '#7fd6ff',
  },
  medbay: {
    type: 'medbay',
    name: 'Medbay',
    short: 'Medbay',
    desc: [
      'White light, white tile, one surgical bed with the straps torn off. The auto-doc is still humming.',
      'Cabinets hang open. Someone left in a hurry and took the good drugs, but not all of them.',
    ],
    cover: false,
    searches: 2,
    loot: ['medkit', 'medkit', 'stim', 'sedative', 'sedative'],
    accent: '#8ff0c4',
  },
  armory: {
    type: 'armory',
    name: 'Armory',
    short: 'Armory',
    desc: [
      'Racks of empty brackets. Whoever cleared this out knew what they were preparing for.',
      'A cage of mesh and steel. Somebody tried to open the last locker with their fingernails.',
    ],
    cover: true,
    searches: 2,
    loot: ['pistol', 'baton', 'flamer', 'emp', 'pistol', 'flare'],
    accent: '#ff9c6b',
    locked: true,
  },
  galley: {
    type: 'galley',
    name: 'Galley',
    short: 'Galley',
    desc: [
      'Long tables, trays still out. A meal for twelve, half-eaten, going grey.',
      'The coffee machine blinks READY at nobody. It smells like burnt sugar and something worse.',
    ],
    cover: true,
    searches: 1,
    loot: ['axe', 'sedative', 'stim', 'flare'],
    accent: '#ffd27f',
  },
  quarters: {
    type: 'quarters',
    name: 'Crew Quarters',
    short: 'Quarters',
    desc: [
      'Bunks stacked three high, curtains drawn. Photos taped above every pillow.',
      'Somebody barricaded a bunk from the inside. The barricade held. That’s not good news.',
    ],
    cover: true,
    searches: 2,
    loot: ['sedative', 'stim', 'flashlight', 'medkit', 'keycard'],
    accent: '#c5a8ff',
  },
  engineering: {
    type: 'engineering',
    name: 'Engineering',
    short: 'Engineering',
    desc: [
      'Pipes sweat. Gauges twitch. Every warning light on the board is lit and none of them agree.',
      'The heart of the ship, loud enough to hide in. Tools scattered across the deck plates.',
    ],
    cover: true,
    searches: 2,
    loot: ['toolkit', 'cutter', 'foam', 'fuelcell', 'rivetgun'],
    accent: '#ffb547',
  },
  reactor: {
    type: 'reactor',
    name: 'Reactor',
    short: 'Reactor',
    desc: [
      'Blue light pulses behind a foot of glass. The floor is warm through your boots.',
      'The containment readout is a column of numbers going the wrong way.',
    ],
    cover: false,
    searches: 1,
    loot: ['foam', 'toolkit', 'cutter'],
    accent: '#5ce1e6',
  },
  bridge: {
    type: 'bridge',
    name: 'Bridge',
    short: 'Bridge',
    desc: [
      'Stars wheel past the canopy. The captain’s chair is turned to face the door, as if they were waiting.',
      'Every console shows the same thing: a red outline of the ship, and something moving inside it.',
    ],
    cover: false,
    searches: 1,
    loot: ['keycard', 'flare', 'pistol'],
    accent: '#7fb2ff',
  },
  comms: {
    type: 'comms',
    name: 'Comms',
    short: 'Comms',
    desc: [
      'Static hisses from every speaker. Under it, sometimes, something like breathing.',
      'The dish controls are dead, the log is full, and the last message sent was one word: DON’T.',
    ],
    cover: false,
    searches: 1,
    loot: ['toolkit', 'flare', 'emp'],
    accent: '#7ff0ff',
  },
  lab: {
    type: 'lab',
    name: 'Laboratory',
    short: 'Lab',
    desc: [
      'Sample jars in neat rows, one of them shattered from the inside.',
      'The fume hood is still running. Whatever it was drawing off, you can taste it.',
    ],
    cover: false,
    searches: 2,
    loot: ['sedative', 'medkit', 'tracker', 'emp', 'stim'],
    accent: '#b0ff8f',
  },
  hydroponics: {
    type: 'hydroponics',
    name: 'Hydroponics',
    short: 'Hydroponics',
    desc: [
      'Racks of greens under violet grow-lights, dripping. It is warm and it smells alive.',
      'The irrigation clicks on and off. Tomato vines have climbed right over a body.',
    ],
    cover: true,
    searches: 1,
    loot: ['sedative', 'medkit', 'foam', 'flare'],
    accent: '#9dff9d',
  },
  cargo: {
    type: 'cargo',
    name: 'Cargo Hold',
    short: 'Cargo',
    desc: [
      'Containers stacked to the ceiling, lashed with cable. Good places to hide. Good places to be hidden.',
      'Half the crates have been opened. From the outside, you hope.',
    ],
    cover: true,
    searches: 3,
    loot: ['fuelcell', 'foam', 'axe', 'rivetgun', 'flare', 'flashlight', 'emp'],
    accent: '#e0b27f',
  },
  security: {
    type: 'security',
    name: 'Security',
    short: 'Security',
    desc: [
      'A wall of camera feeds, most of them static. On one of them, a shape crosses a corridor and is gone.',
      'The holding cell door is open. It was opened from the inside.',
    ],
    cover: false,
    searches: 2,
    loot: ['keycard', 'baton', 'pistol', 'tracker', 'emp'],
    accent: '#ff7f9c',
  },
  observation: {
    type: 'observation',
    name: 'Observation Deck',
    short: 'Observation',
    desc: [
      'A dome of glass and the whole galaxy beyond it. For a moment the ship is very small and so is everything in it.',
      'Couches arranged to face the stars. A book lies open, face down, where somebody stopped reading.',
    ],
    cover: false,
    searches: 1,
    loot: ['sedative', 'stim', 'flare'],
    accent: '#a8c8ff',
  },
  airlock: {
    type: 'airlock',
    name: 'Airlock',
    short: 'Airlock',
    desc: [
      'Two doors and a red handle between you and nothing. The outer door has scratches on the inside.',
      'Suits hang in a row like hanged men. One hook is empty.',
    ],
    cover: false,
    searches: 1,
    loot: ['foam', 'flare', 'cutter'],
    accent: '#ff6b6b',
  },
  podbay: {
    type: 'podbay',
    name: 'Escape Pod Bay',
    short: 'Pod Bay',
    desc: [
      'Six launch cradles. Four are empty and scorched. Two pods wait, dark, their hatches open.',
      'The launch board reads NO POWER and, under it, AUTHORISATION REQUIRED.',
    ],
    cover: false,
    searches: 1,
    loot: ['medkit', 'flare'],
    accent: '#ffe07f',
  },
  hangar: {
    type: 'hangar',
    name: 'Hangar',
    short: 'Hangar',
    desc: [
      'A shuttle sits on the pad, nose to the bay doors, fuel gauge on empty.',
      'The hangar is huge and dark and every sound you make comes back to you twice.',
    ],
    cover: true,
    searches: 2,
    loot: ['toolkit', 'foam', 'fuelcell', 'rivetgun'],
    accent: '#ffc27f',
  },
  captain: {
    type: 'captain',
    name: 'Captain’s Quarters',
    short: 'Captain’s',
    desc: [
      'Real wood, real books, a bottle open on the desk. A wall safe behind a painting of a green world.',
      'The bed has not been slept in. The desk is covered in notes, all in the same hand, getting worse.',
    ],
    cover: true,
    searches: 1,
    loot: ['pistol', 'keycard', 'sedative'],
    accent: '#e8c89a',
    locked: true,
  },
  maintenance: {
    type: 'maintenance',
    name: 'Maintenance',
    short: 'Maintenance',
    desc: [
      'A crawlspace of ducts and junction boxes. The vents breathe cold air on your neck.',
      'Tool lockers, a workbench, and a vent grate hanging by one screw.',
    ],
    cover: true,
    searches: 2,
    loot: ['toolkit', 'foam', 'rivetgun', 'flashlight', 'cutter', 'fuelcell'],
    accent: '#c8b27f',
  },
  nest: {
    type: 'nest',
    name: 'The Nest',
    short: 'Nest',
    desc: ['It was a room once.'],
    cover: true,
    searches: 1,
    loot: ['stim', 'medkit'],
    accent: '#ff4d5e',
  },
};

export const FILLER_ROOMS: RoomType[] = [
  'armory',
  'galley',
  'quarters',
  'lab',
  'hydroponics',
  'security',
  'observation',
  'captain',
  'maintenance',
  'reactor',
  'cargo',
  'comms',
];
