export type Stat = 'might' | 'tech' | 'wits' | 'nerve';
export type Band = 'clean' | 'cost' | 'fail';
export type Difficulty = 'story' | 'standard' | 'nightmare';

export type RoleId = 'engineer' | 'marine' | 'medic' | 'scientist' | 'pilot' | 'stowaway' | 'android';

export type RoomType =
  | 'cryo'
  | 'medbay'
  | 'armory'
  | 'galley'
  | 'quarters'
  | 'engineering'
  | 'reactor'
  | 'bridge'
  | 'comms'
  | 'lab'
  | 'hydroponics'
  | 'cargo'
  | 'security'
  | 'observation'
  | 'airlock'
  | 'podbay'
  | 'hangar'
  | 'captain'
  | 'maintenance'
  | 'nest';

export type CreatureKind = 'stalker' | 'crawler' | 'changed' | 'drone' | 'mimic';
export type IncidentId = 'specimen' | 'signal' | 'mother' | 'guest' | 'bloom';
export type ExitId = 'pods' | 'shuttle' | 'beacon' | 'jump';
export type Hazard = 'fire' | 'dark' | 'breach';
export type PersonalId =
  | 'blackbox'
  | 'sample'
  | 'together'
  | 'kill'
  | 'truth'
  | 'wipe'
  | 'sibling'
  | 'burn';

export type ItemId =
  | 'rivetgun'
  | 'pistol'
  | 'flamer'
  | 'baton'
  | 'axe'
  | 'cutter'
  | 'toolkit'
  | 'tracker'
  | 'flashlight'
  | 'keycard'
  | 'medkit'
  | 'stim'
  | 'sedative'
  | 'flare'
  | 'emp'
  | 'foam'
  | 'fuelcell'
  | 'blackbox'
  | 'sample'
  | 'codes';

export type TraitId =
  | 'shaky'
  | 'jumpy'
  | 'numb'
  | 'limp'
  | 'steeled'
  | 'hunter'
  | 'scavenger'
  | 'quiet';

export interface Stats {
  might: number;
  tech: number;
  wits: number;
  nerve: number;
}

export interface ItemInst {
  id: ItemId;
  uses?: number;
}

export interface Die {
  id: number;
  value: number;
  used: boolean;
  /** Where the die came from, shown on its face. */
  source: 'self' | 'companion' | 'stim';
}

export interface RoomState {
  id: string;
  type: RoomType;
  x: number;
  y: number;
  /** You have stood in it. Its discovery has been drawn. */
  explored: boolean;
  /** Its type is shown on the map (you have been next to it, or read the plans). */
  known: boolean;
  searchesLeft: number;
  hazards: Hazard[];
  fireRounds: number;
  locked: boolean;
  /** Discovery drawn the first time you enter. */
  discovery: string | null;
  /** Clue index hidden here, found on first entry. */
  clue: number | null;
  /** Survivor waiting here, found on first entry. */
  survivor: number | null;
  /** One-shot room actions already taken. */
  used: string[];
  /** Airlock already blown, nest already destroyed and so on. */
  spent: boolean;
  /** Things you left here because your hands were full. */
  floor: ItemInst[];
}

export interface Creature {
  id: number;
  kind: CreatureKind;
  room: string;
  hp: number;
  maxHp: number;
  /** Room where it last heard you. It goes there, looks, then drifts. */
  target: string | null;
  stunned: number;
  /** Damage taken this round, for the Stalker's retreat. */
  hurtThisRound: number;
  /** Arrived in your room this round and has not had a chance to strike yet. */
  fresh: boolean;
}

export interface Survivor {
  name: string;
  job: string;
  temperament: 'steady' | 'frightened' | 'hostile' | 'broken';
  /** Stat they help with when following you. */
  helps: Stat;
  /** Secretly the Mimic (only in The Guest). */
  mimic: boolean;
  /** Secretly infected. */
  infected: boolean;
  /** Your sibling, for the secret objective. */
  sibling: boolean;
  pronoun: 'she' | 'he' | 'they';
}

export interface Companion extends Survivor {
  index: number;
  hp: number;
  roundsWithYou: number;
}

export interface Player {
  name: string;
  role: RoleId;
  stats: Stats;
  hp: number;
  maxHp: number;
  stress: number;
  maxStress: number;
  items: ItemInst[];
  room: string;
  hidden: boolean;
  infected: boolean;
  infectionRounds: number;
  infectionKnown: boolean;
  traits: TraitId[];
  /** Extra (or fewer) dice for the next roll only. */
  diceNext: number;
}

export interface Scenario {
  shipName: string;
  shipClass: string;
  crew: number;
  incident: IncidentId;
  primary: CreatureKind;
  brood: CreatureKind;
  exits: ExitId[];
  personal: PersonalId;
  nest: string;
  clockKind: string;
}

export interface Progress {
  steps: Record<ExitId, boolean[]>;
  /** Progress on multi-part steps, keyed by action id. */
  work: Record<string, number>;
  clues: number[];
  truth: boolean;
  nestDestroyed: boolean;
  selfDestruct: boolean;
  rescueIn: number | null;
  camerasRounds: number;
  mapRevealed: boolean;
  kills: number;
  primaryKilled: boolean;
  personalDone: boolean;
  wiped: boolean;
  survivorsMet: number[];
  companionsLost: string[];
  roundsSinceScare: number;
  /** Room a flare was thrown into this round. */
  lure: string | null;
  hurtRecently: number[];
  flags: string[];
}

export interface Choice {
  label: string;
  hint?: string;
  stat?: Stat;
  mod?: number;
  /** Index into the content definition's choice list. */
  ref: number;
}

export type CardKind =
  | 'intro'
  | 'discovery'
  | 'encounter'
  | 'event'
  | 'clue'
  | 'truth'
  | 'panic'
  | 'survivor'
  | 'result'
  | 'companion'
  | 'info';

export interface StoryCard {
  uid: number;
  kind: CardKind;
  title: string;
  text: string;
  art: string;
  tone: 'calm' | 'tense' | 'danger' | 'good' | 'strange';
  choices: Choice[];
  /** What resolves the choices. */
  source?: { type: 'event' | 'survivor' | 'discovery'; id: string; arg?: number };
  /** Shown on result cards: the roll that decided it. */
  roll?: { die: number; bonus: number; total: number; band: Band; stat: Stat };
}

export interface LogEntry {
  round: number;
  text: string;
  tone?: 'calm' | 'tense' | 'danger' | 'good' | 'strange';
}

export interface Beat {
  round: number;
  text: string;
}

export interface Ending {
  id: string;
  won: boolean;
  title: string;
  epilogue: string[];
  score: number;
  exit: ExitId | null;
  /** Illustration for the ending screen. */
  art: string;
}

export interface GameState {
  version: number;
  seed: string;
  rng: number;
  difficulty: Difficulty;
  round: number;
  clock: number;
  clockMax: number;
  player: Player;
  dice: Die[];
  noise: number;
  rooms: Record<string, RoomState>;
  edges: [string, string][];
  creatures: Creature[];
  nextCreatureId: number;
  survivors: Survivor[];
  companion: Companion | null;
  scenario: Scenario;
  progress: Progress;
  usedEvents: string[];
  cards: StoryCard[];
  nextCardId: number;
  log: LogEntry[];
  beats: Beat[];
  status: 'playing' | 'won' | 'dead' | 'lost';
  ending: Ending | null;
  /** The room shown as the latest "last heard" marker, per creature id. */
  heard: string[];
}

export interface Effect {
  hp?: number;
  heal?: number;
  stress?: number;
  noise?: number;
  clock?: number;
  item?: ItemId;
  loseItem?: 'random' | ItemId;
  spawn?: { kind: 'primary' | 'brood'; where: 'near' | 'nest' | 'here' | 'adjacent' };
  alertAll?: boolean;
  hazard?: { type: Hazard; where: 'here' | 'random' | 'adjacent' };
  clearHazard?: Hazard;
  revealMap?: boolean;
  cameras?: number;
  clue?: boolean;
  infect?: number;
  cure?: boolean;
  scan?: boolean;
  diceNext?: number;
  trait?: TraitId;
  companionHp?: number;
  step?: { exit: ExitId; step: number };
  flag?: string;
  stunAll?: number;
  repelHere?: boolean;
  killHere?: boolean;
  destroyNest?: boolean;
  selfDestruct?: boolean;
  rescue?: boolean;
  win?: ExitId;
  wipe?: boolean;
  hide?: boolean;
  unlock?: boolean;
  searches?: number;
  distract?: boolean;
  turnCompanion?: boolean;
  recruit?: boolean;
  dismiss?: boolean;
}

export type Action =
  | { type: 'act'; id: string; die: number; target?: string }
  | { type: 'endRound' }
  | { type: 'choose'; index: number }
  | { type: 'continue' };

export interface Outcome {
  band: Band;
  total: number;
  summary: string;
}

export interface ActionOption {
  id: string;
  target?: string;
  group: 'danger' | 'room' | 'goal' | 'kit' | 'move';
  label: string;
  desc: string;
  icon: string;
  stat?: Stat;
  noise: number;
  /** Modifier notes shown to the player, e.g. "−1 dark". */
  mods: string[];
  /** Outcome for each unused die, keyed by die id. */
  outcomes: Record<number, Outcome>;
  /** Any die gives the same outcome. */
  flat?: boolean;
  disabled?: string;
}
