import type { ItemId, PersonalId, RoleId, Stats, TraitId, Stat } from '../types';

export interface RoleDef {
  id: RoleId;
  name: string;
  tagline: string;
  perk: string;
  perkName: string;
  stats: Stats;
  items: ItemId[];
  personal: PersonalId[];
  unlock?: { key: string; hint: string };
}

export const ROLES: Record<RoleId, RoleDef> = {
  engineer: {
    id: 'engineer',
    name: 'Engineer',
    tagline: 'You kept this ship flying. You know where it hurts.',
    perkName: 'Jury-rig',
    perk: 'Tech checks never fail outright: a fail becomes a cost.',
    stats: { might: 1, tech: 2, wits: 0, nerve: 0 },
    items: ['toolkit', 'rivetgun'],
    personal: ['burn', 'blackbox', 'together', 'sibling'],
  },
  marine: {
    id: 'marine',
    name: 'Marine',
    tagline: 'Contract security. Paid to stand between the crew and trouble.',
    perkName: 'Trained',
    perk: 'Clean hits do 1 extra damage.',
    stats: { might: 2, tech: 0, wits: 0, nerve: 1 },
    items: ['pistol'],
    personal: ['kill', 'together', 'burn', 'sibling'],
  },
  medic: {
    id: 'medic',
    name: 'Medic',
    tagline: 'You signed on to patch up miners. Nobody trained you for this.',
    perkName: 'Triage',
    perk: 'Every heal restores 1 extra health. You always know if you are infected.',
    stats: { might: 0, tech: 1, wits: 1, nerve: 1 },
    items: ['medkit', 'sedative'],
    personal: ['together', 'sample', 'sibling', 'truth'],
  },
  scientist: {
    id: 'scientist',
    name: 'Scientist',
    tagline: 'You asked to see what was in the hold. Now you know.',
    perkName: 'Hypothesis',
    perk: 'You only need 2 logs to piece together the truth, not 3.',
    stats: { might: 0, tech: 1, wits: 2, nerve: 0 },
    items: ['tracker'],
    personal: ['sample', 'truth', 'wipe', 'blackbox'],
  },
  pilot: {
    id: 'pilot',
    name: 'Pilot',
    tagline: 'Hands steady at a hundred gees. Less steady in the dark.',
    perkName: 'Cool head',
    perk: 'You panic at 7 stress, not 6. Flight checks — authorising, plotting, flying — never fail.',
    stats: { might: 0, tech: 1, wits: 0, nerve: 2 },
    items: ['flare', 'flashlight'],
    personal: ['blackbox', 'together', 'sibling', 'truth'],
  },
  stowaway: {
    id: 'stowaway',
    name: 'Stowaway',
    tagline: 'You were never on the manifest. Nothing aboard knows you exist.',
    perkName: 'Ghost',
    perk: 'Moving is silent on any die of 4 or more.',
    stats: { might: 0, tech: 0, wits: 2, nerve: 1 },
    items: ['stim'],
    personal: ['wipe', 'sample', 'blackbox', 'kill'],
    unlock: { key: 'escaped', hint: 'Escape a ship once.' },
  },
  android: {
    id: 'android',
    name: 'Android',
    tagline: 'Synthetic crew. The humans never quite trusted you.',
    perkName: 'Synthetic',
    perk: 'Horror costs you half the stress. You cannot be infected. Medical supplies heal you less.',
    stats: { might: 1, tech: 2, wits: 1, nerve: 0 },
    items: ['toolkit'],
    personal: ['truth', 'wipe', 'burn', 'together'],
    unlock: { key: 'truth', hint: 'Uncover the truth behind an incident.' },
  },
};

export const ROLE_ORDER: RoleId[] = ['engineer', 'marine', 'medic', 'scientist', 'pilot', 'stowaway', 'android'];

export const STAT_NAMES: Record<Stat, string> = {
  might: 'Might',
  tech: 'Tech',
  wits: 'Wits',
  nerve: 'Nerve',
};

export const STAT_DESC: Record<Stat, string> = {
  might: 'Fighting, forcing, holding on',
  tech: 'Repairs, terminals, machines',
  wits: 'Searching, sneaking, noticing',
  nerve: 'Fear, and talking people down',
};

export interface TraitDef {
  id: TraitId;
  name: string;
  desc: string;
  good: boolean;
  stat?: Partial<Stats>;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  shaky: { id: 'shaky', name: 'Shaky hands', desc: '−1 Tech.', good: false, stat: { tech: -1 } },
  jumpy: { id: 'jumpy', name: 'Jumpy', desc: '−1 Wits. Every shadow moves.', good: false, stat: { wits: -1 } },
  numb: { id: 'numb', name: 'Numb', desc: '−1 Nerve. Something in you went quiet.', good: false, stat: { nerve: -1 } },
  limp: { id: 'limp', name: 'Limp', desc: '−1 Might. The leg never set right.', good: false, stat: { might: -1 } },
  steeled: { id: 'steeled', name: 'Steeled', desc: '+1 Nerve. You have seen worse now.', good: true, stat: { nerve: 1 } },
  hunter: { id: 'hunter', name: 'Blooded', desc: '+1 Might. You know it can bleed.', good: true, stat: { might: 1 } },
  scavenger: { id: 'scavenger', name: 'Scavenger', desc: '+1 Wits. You know where people hide things.', good: true, stat: { wits: 1 } },
  quiet: { id: 'quiet', name: 'Light-footed', desc: '+1 Wits. You have learned the ship’s creaks.', good: true, stat: { wits: 1 } },
};
