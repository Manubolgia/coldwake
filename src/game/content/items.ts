import type { ItemId, Stat } from '../types';

export interface ItemDef {
  id: ItemId;
  name: string;
  desc: string;
  kind: 'weapon' | 'tool' | 'supply' | 'quest';
  /** Added to your fight total. */
  fight?: number;
  damage?: number;
  /** Starting charges. Absent means it never runs out. */
  uses?: number;
  fire?: boolean;
  stun?: boolean;
  /** Extra noise when you fight with it. */
  loud?: number;
  bonus?: { stat: Stat; amount: number };
  /** Has a Use action. */
  usable?: boolean;
}

export const ITEMS: Record<ItemId, ItemDef> = {
  rivetgun: {
    id: 'rivetgun',
    name: 'Rivet gun',
    desc: 'Meant for hull plates. +1 to fight, 1 damage.',
    kind: 'weapon',
    fight: 1,
    damage: 1,
    uses: 5,
  },
  pistol: {
    id: 'pistol',
    name: 'Service pistol',
    desc: 'Frangible rounds, safe for hulls. +1 to fight, 2 damage.',
    kind: 'weapon',
    fight: 1,
    damage: 2,
    uses: 3,
  },
  flamer: {
    id: 'flamer',
    name: 'Flamethrower',
    desc: 'Industrial weed burner. +2 to fight, 2 damage, and anything it hits runs.',
    kind: 'weapon',
    fight: 2,
    damage: 2,
    uses: 3,
    fire: true,
  },
  baton: {
    id: 'baton',
    name: 'Shock baton',
    desc: '+1 to fight, 1 damage. A hit stuns: it loses its next move.',
    kind: 'weapon',
    fight: 1,
    damage: 1,
    stun: true,
  },
  axe: {
    id: 'axe',
    name: 'Fire axe',
    desc: '+1 to fight, 2 damage. Never runs out. Loud.',
    kind: 'weapon',
    fight: 1,
    damage: 2,
    loud: 1,
  },
  cutter: {
    id: 'cutter',
    name: 'Plasma cutter',
    desc: '3 damage, no bonus to hit. Also +1 Tech.',
    kind: 'weapon',
    fight: 0,
    damage: 3,
    uses: 3,
    bonus: { stat: 'tech', amount: 1 },
  },
  toolkit: {
    id: 'toolkit',
    name: 'Toolkit',
    desc: '+1 Tech.',
    kind: 'tool',
    bonus: { stat: 'tech', amount: 1 },
  },
  tracker: {
    id: 'tracker',
    name: 'Motion tracker',
    desc: 'Shows anything moving up to two rooms away.',
    kind: 'tool',
  },
  flashlight: {
    id: 'flashlight',
    name: 'Flashlight',
    desc: 'Darkness no longer counts against you. +1 Wits when searching.',
    kind: 'tool',
  },
  keycard: {
    id: 'keycard',
    name: 'Security keycard',
    desc: 'Opens locked doors.',
    kind: 'tool',
  },
  medkit: {
    id: 'medkit',
    name: 'Medkit',
    desc: 'Use: heal 2.',
    kind: 'supply',
    uses: 1,
    usable: true,
  },
  stim: {
    id: 'stim',
    name: 'Stim injector',
    desc: 'Use: roll one extra die right now, and −1 stress.',
    kind: 'supply',
    uses: 1,
    usable: true,
  },
  sedative: {
    id: 'sedative',
    name: 'Sedatives',
    desc: 'Use: −3 stress.',
    kind: 'supply',
    uses: 1,
    usable: true,
  },
  flare: {
    id: 'flare',
    name: 'Flare',
    desc: 'Use: throw it into a next-door room. Everything that can hear it goes there instead of to you.',
    kind: 'supply',
    uses: 1,
    usable: true,
  },
  emp: {
    id: 'emp',
    name: 'EMP charge',
    desc: 'Use: stuns everything here and next door for 2 rounds. Wrecks drones.',
    kind: 'supply',
    uses: 1,
    usable: true,
  },
  foam: {
    id: 'foam',
    name: 'Sealant foam',
    desc: 'Use: puts out a fire or seals a breach in this room.',
    kind: 'supply',
    uses: 1,
    usable: true,
  },
  fuelcell: {
    id: 'fuelcell',
    name: 'Fuel cell',
    desc: 'Enough to get a shuttle off the deck.',
    kind: 'quest',
  },
  blackbox: {
    id: 'blackbox',
    name: 'Flight recorder',
    desc: 'Everything this ship saw, sealed in orange steel.',
    kind: 'quest',
  },
  sample: {
    id: 'sample',
    name: 'Tissue sample',
    desc: 'Sealed in a specimen jar. It is still warm.',
    kind: 'quest',
  },
  codes: {
    id: 'codes',
    name: 'Command codes',
    desc: 'The captain’s authority, on a chip. Authorises launches and the reactor overload.',
    kind: 'quest',
  },
};

export const INVENTORY_SIZE = 6;
