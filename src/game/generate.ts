import { CREATURES } from './content/creatures';
import { PERSONALS } from './content/exits';
import { INCIDENTS, INCIDENT_ORDER } from './content/incidents';
import { ITEMS } from './content/items';
import {
  CLOCK_KINDS,
  FIRST_NAMES,
  LAST_NAMES,
  SHIP_CLASSES,
  SHIP_NAMES,
  SHIP_PREFIX,
  SURVIVOR_JOBS,
} from './content/names';
import { ROLES } from './content/roles';
import { FILLER_ROOMS, ROOMS } from './content/rooms';
import { distances, neighbours } from './map';
import { Rng, hashSeed } from './rng';
import type {
  Creature,
  CreatureKind,
  Difficulty,
  ExitId,
  GameState,
  IncidentId,
  ItemInst,
  PersonalId,
  RoleId,
  RoomState,
  RoomType,
  Stat,
  Survivor,
} from './types';

export const VERSION = 3;
export const ROOM_COUNT = 14;
export const GRID_W = 5;
export const GRID_H = 4;

export const CLOCK: Record<Difficulty, number> = { story: 22, standard: 17, nightmare: 14 };
export const HEALTH: Record<Difficulty, number> = { story: 6, standard: 5, nightmare: 4 };

export interface NewGameOptions {
  seed: string;
  role: RoleId;
  difficulty: Difficulty;
  name?: string;
  incident?: IncidentId;
}

const EXIT_ROOMS: Record<ExitId, RoomType[]> = {
  pods: ['engineering', 'bridge', 'podbay'],
  shuttle: ['cargo', 'hangar'],
  beacon: ['comms', 'airlock'],
  jump: ['bridge', 'engineering'],
};

/** Rooms that are better far from the cryo bay: the last step of an exit. */
const FAR_ROOMS: RoomType[] = ['podbay', 'hangar', 'airlock'];

export function personName(rng: Rng): string {
  return `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
}

function growLayout(rng: Rng): { cells: [number, number][]; edges: [number, number][] } {
  const startY = rng.int(1, GRID_H - 2);
  const cells: [number, number][] = [[0, startY]];
  const edges: [number, number][] = [];
  const at = (x: number, y: number) => cells.findIndex(([cx, cy]) => cx === x && cy === y);
  let guard = 0;
  while (cells.length < ROOM_COUNT && guard++ < 5000) {
    // Favour growing from rooms further east so the ship stretches out.
    const parent = rng.weighted(cells.map((c, i) => ({ item: i, weight: 1 + c[0] * 0.6 })));
    const [px, py] = cells[parent]!;
    const dirs: [number, number][] = rng.shuffle([
      [1, 0],
      [0, 1],
      [0, -1],
      [-1, 0],
      [1, 0],
    ]);
    for (const [dx, dy] of dirs) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= GRID_W || ny >= GRID_H) continue;
      if (at(nx, ny) !== -1) continue;
      cells.push([nx, ny]);
      edges.push([parent, cells.length - 1]);
      break;
    }
  }
  // Loops: more than one way round.
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const [ax, ay] = cells[i]!;
      const [bx, by] = cells[j]!;
      if (Math.abs(ax - bx) + Math.abs(ay - by) !== 1) continue;
      if (edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i))) continue;
      if (rng.chance(0.3)) edges.push([i, j]);
    }
  }
  return { cells, edges };
}

function makeSurvivor(rng: Rng, taken: Set<string>): Survivor {
  let name = personName(rng);
  while (taken.has(name)) name = personName(rng);
  taken.add(name);
  const job = rng.pick(SURVIVOR_JOBS);
  return {
    name,
    job: job.job,
    helps: job.helps as Stat,
    temperament: rng.pick(['steady', 'frightened', 'hostile', 'broken'] as const),
    mimic: false,
    infected: false,
    sibling: false,
    pronoun: rng.pick(['she', 'he', 'they'] as const),
  };
}

export function newGame(opts: NewGameOptions): GameState {
  const rng = new Rng(hashSeed(opts.seed));
  const role = ROLES[opts.role];
  const difficulty = opts.difficulty;

  const incidentId = opts.incident ?? rng.pick(INCIDENT_ORDER);
  const incident = INCIDENTS[incidentId];
  const shipClass = rng.pick(SHIP_CLASSES);
  const shipName = `${rng.pick(SHIP_PREFIX)} ${rng.pick(SHIP_NAMES)}`;
  const exits = rng.shuffle<ExitId>(['pods', 'shuttle', 'beacon', 'jump']).slice(0, 2);
  const personal: PersonalId = rng.pick(role.personal);

  // ── layout ──
  let layout = growLayout(rng);
  let tries = 0;
  while (layout.cells.length < ROOM_COUNT && tries++ < 20) layout = growLayout(rng);
  const ids = layout.cells.map((_, i) => `r${i}`);
  const edges: [string, string][] = layout.edges.map(([a, b]) => [ids[a]!, ids[b]!]);
  const start = ids[0]!;
  const dist = distances({ edges }, start);
  const byDistance = ids.slice(1).sort((a, b) => (dist[b] ?? 0) - (dist[a] ?? 0));
  const nest = byDistance[0]!;

  // ── room types ──
  const required = new Set<RoomType>(['medbay']);
  for (const e of exits) for (const r of EXIT_ROOMS[e]) required.add(r);
  const personalRoom = PERSONALS[personal].room;
  if (personalRoom && personalRoom !== 'nest') required.add(personalRoom);
  if (incidentId === 'guest') required.add('medbay');

  const types: Record<string, RoomType> = { [start]: 'cryo', [nest]: 'nest' };
  const free = rng.shuffle(ids.filter((id) => id !== start && id !== nest));
  const far = free.slice().sort((a, b) => (dist[b] ?? 0) - (dist[a] ?? 0));
  for (const t of FAR_ROOMS) {
    if (!required.has(t)) continue;
    const pick = far.find((id) => !types[id]);
    if (pick) types[pick] = t;
    required.delete(t);
  }
  for (const t of required) {
    const pick = free.find((id) => !types[id]);
    if (pick) types[pick] = t;
  }
  const present = new Set(Object.values(types));
  const fillers = rng.shuffle(FILLER_ROOMS.filter((t) => !present.has(t)));
  for (const id of free) {
    if (!types[id]) types[id] = fillers.shift() ?? 'maintenance';
  }

  const rooms: Record<string, RoomState> = {};
  layout.cells.forEach(([x, y], i) => {
    const id = ids[i]!;
    const type = types[id]!;
    const def = ROOMS[type];
    rooms[id] = {
      id,
      type,
      x,
      y,
      explored: id === start,
      known: id === start,
      searchesLeft: def.searches,
      hazards: [],
      fireRounds: 0,
      locked: !!def.locked,
      discovery: null,
      clue: null,
      survivor: null,
      used: [],
      spent: false,
      floor: [],
    };
  });
  for (const n of neighbours({ edges }, start)) rooms[n]!.known = true;

  // ── clues: four logs in four rooms ──
  const clueRooms = rng.shuffle(ids.filter((id) => id !== start && id !== nest)).slice(0, 4);
  clueRooms.forEach((id, i) => (rooms[id]!.clue = i));

  // ── survivors ──
  const taken = new Set<string>();
  const survivorCount = difficulty === 'nightmare' ? 1 : 2;
  const survivors: Survivor[] = [];
  for (let i = 0; i < survivorCount; i++) survivors.push(makeSurvivor(rng, taken));
  if (personal === 'sibling') {
    survivors[0]!.sibling = true;
    survivors[0]!.temperament = rng.pick(['steady', 'frightened'] as const);
  }
  if (incidentId === 'guest') {
    const m = survivors.length - 1;
    if (!survivors[m]!.sibling) survivors[m]!.mimic = true;
  }
  if (incidentId === 'bloom' || incidentId === 'signal') {
    for (const sv of survivors) if (!sv.sibling && rng.chance(0.4)) sv.infected = true;
  }
  const survivorRooms = rng
    .shuffle(ids.filter((id) => id !== start && id !== nest && (dist[id] ?? 0) >= 2))
    .slice(0, survivors.length);
  survivorRooms.forEach((id, i) => (rooms[id]!.survivor = i));

  // ── creatures ──
  const creatures: Creature[] = [];
  let nextCreatureId = 1;
  const spawn = (kind: CreatureKind, room: string) => {
    const def = CREATURES[kind];
    creatures.push({
      id: nextCreatureId++,
      kind,
      room,
      hp: def.hp,
      maxHp: def.hp,
      target: null,
      stunned: 0,
      hurtThisRound: 0,
      fresh: false,
    });
  };
  spawn(incident.primary, nest);
  const extraRooms = ids.filter((id) => (dist[id] ?? 0) >= 3 && id !== nest);
  const extra = incident.extraStart + (difficulty === 'story' ? 0 : 1) + (difficulty === 'nightmare' ? 1 : 0);
  for (let i = 0; i < extra && extraRooms.length; i++) {
    spawn(incident.brood, rng.pick(extraRooms));
  }

  const items: ItemInst[] = role.items.map((id) => withUses(id));
  const maxHp = HEALTH[difficulty];
  const state: GameState = {
    version: VERSION,
    seed: opts.seed,
    rng: rng.state,
    difficulty,
    round: 1,
    clock: CLOCK[difficulty],
    clockMax: CLOCK[difficulty],
    player: {
      name: opts.name?.trim() || personName(rng),
      role: opts.role,
      stats: { ...role.stats },
      hp: maxHp,
      maxHp,
      stress: 0,
      maxStress: opts.role === 'pilot' ? 7 : 6,
      items,
      room: start,
      hidden: false,
      infected: false,
      infectionRounds: 0,
      infectionKnown: false,
      traits: [],
      diceNext: 0,
    },
    dice: [],
    noise: 0,
    rooms,
    edges,
    creatures,
    nextCreatureId,
    survivors,
    companion: null,
    scenario: {
      shipName,
      shipClass: shipClass.name,
      crew: rng.int(shipClass.crew[0], shipClass.crew[1]),
      incident: incidentId,
      primary: incident.primary,
      brood: incident.brood,
      exits,
      personal,
      nest,
      clockKind: rng.pick(CLOCK_KINDS),
    },
    progress: {
      steps: { pods: [false, false, false], shuttle: [false, false, false], beacon: [false, false, false], jump: [false, false, false] },
      work: {},
      clues: [],
      truth: false,
      nestDestroyed: false,
      selfDestruct: false,
      rescueIn: null,
      camerasRounds: 0,
      mapRevealed: false,
      kills: 0,
      primaryKilled: false,
      personalDone: false,
      wiped: false,
      survivorsMet: [],
      companionsLost: [],
      roundsSinceScare: 0,
      lure: null,
      hurtRecently: [],
      flags: [],
    },
    usedEvents: [],
    cards: [],
    nextCardId: 1,
    log: [],
    beats: [],
    status: 'playing',
    ending: null,
    heard: [],
  };
  return state;
}

export function withUses(id: ItemInst['id']): ItemInst {
  return ITEM_USES[id] !== undefined ? { id, uses: ITEM_USES[id]! } : { id };
}

const ITEM_USES: Partial<Record<ItemInst['id'], number>> = Object.fromEntries(
  Object.values(ITEMS)
    .filter((d) => d.uses !== undefined)
    .map((d) => [d.id, d.uses!]),
);

