import mapJson from '../content/map.json';
import threatsJson from '../content/threats.json';
import rulesJson from '../content/rules.json';
import depthsJson from '../content/depths.json';
import cardsJson from '../content/cards.json';
import rolesJson from '../content/roles.json';
import salvageJson from '../content/salvage.json';
import type {
  Card,
  CardId,
  Depth,
  Ending,
  NodeId,
  Objective,
  RoleId,
  ThreatType,
  TokenType,
} from './types';

export type MapNode = {
  id: NodeId;
  name: string;
  short: string;
  vent: boolean;
  safe: boolean;
  noiseFloor: number;
  x: number;
  y: number;
};

export type ThreatDef = {
  id: ThreatType;
  name: string;
  glyph: string;
  /** The single letter the schematic prints in the compartment. */
  mark: string;
  /** The plural, for anything that counts them. */
  namePlural: string;
  hp: number;
  damage: number;
  speed: number;
  /** How many compartments away it can hear a noise of that many points. */
  hearing: number;
  behaviour: 'noise' | 'hunter' | 'burrow' | 'mother';
  /** The hunter has you inside this range whether you were loud or not. */
  lockRange?: number;
  /** Nothing aboard can put it down. */
  unkillable?: boolean;
  order: number;
  text: string;
  /** How a listen names one of these, and more than one. The listen, the
   *  schematic and the manual all read off this one entry, so a player only
   *  ever learns four names rather than four names and four descriptions. */
  sign?: string;
  signMany?: string;
};

export type RoleDef = {
  id: RoleId;
  name: string;
  strength: string;
  weakness: string;
  unlock: { type: 'start' | 'win' | 'depth' | 'ending'; depth?: number; ending?: Ending; label?: string };
  shuttleRequired?: number;
};

export type DepthDef = {
  depth: Depth;
  label: string;
  bag: Partial<Record<TokenType, number>>;
  reactorOutputStart: number;
  turnLimit: number;
  shuttleRequired: number;
  /** Launch holding this many infection cards and you are the CARRIER. */
  infectionThreshold: number;
  /** The most threats that may stand on the board at once. §3.3. */
  boardCap: number;
  /** The hive reading at which the MOTHER gets up. */
  hiveWake: number;
  /** Hours the relay must be held after a broadcast. */
  relayHold: number;
  /** Hours between arming the overload and critical. */
  fuseTurns: number;
  oreHoldFloor: number;
  startingDraws: number;
  nestNoiseAmount: number;
};

export type ObjectiveDef = {
  name: string;
  ending: Ending;
  node: string;
  line: string;
  how: string;
  track: string;
};

export const MAP = mapJson as {
  nodes: MapNode[];
  edges: [NodeId, NodeId][];
  start: NodeId;
  nest: NodeId;
  escape: NodeId;
  spines: NodeId[];
};

export const THREATS = threatsJson as unknown as {
  types: ThreatDef[];
  bag: Record<TokenType, number>;
  reserve: Record<TokenType, number>;
  blankEscalation: number;
  nestNoise: { amount: number; everyTurns: number };
};

export const RULES = rulesJson as unknown as {
  turnLimit: number;
  handSize: number;
  apPerTurn: number;
  powerCap: number;
  reactorOutputMax: number;
  reactorOutputStart: number;
  shuttleRequired: number;
  noiseMax: number;
  noiseThreshold: number;
  noiseDecay: number;
  infectionThreshold: number;
  /** How far a listen reaches, in compartments. */
  listenRange: number;
  /** How far the player perceives without listening. */
  perceiveRange: number;
  boardCap: number;
  hiveWake: number;
  hivePerHour: number;
  hivePerEscalation: number;
  hivePerNestDraw: number;
  motherSealStall: number;
  motherPurgeStall: number;
  searchStance: { hoursSearching: number; hoursUntilCold: number };
  basicActions: Record<string, { ap: number; noise: number }>;
  systemActions: Record<
    string,
    {
      node: string;
      ap: number;
      power: number;
      noise: number;
      turns?: number;
      fuseTurns?: number;
      holdTurns?: number;
      drain?: number;
    }
  >;
  specimenNoisePerHour: number;
  scuttleNoisePerHour: number;
  ventAmbushPenalty: number;
  shakingPenalty: number;
  /** What finishing the objective you declared at wake is worth. */
  declaredBonus: number;
  score: {
    powerBanked: number;
    nodesSearched: number;
    threatsKilled: number;
    threatsShaken: number;
    turnsSurvived: number;
    survivingCards: number;
    cures: number;
  };
  objectives: Record<Objective, ObjectiveDef>;
  endings: Record<
    Ending,
    {
      name?: string;
      objective?: Objective;
      multiplier: number;
      /** What the ending means, in one clause. */
      verdict: string;
      /** What you have to do to reach it, with the shipped numbers filled in. */
      how: string;
    }
  >;
};

export const DEPTHS = depthsJson.depths as unknown as DepthDef[];
export const ROLES = rolesJson.roles as unknown as RoleDef[];
export const CARDS = cardsJson.cards as unknown as Card[];
export const SALVAGE = salvageJson as { perNode: number; deck: { card: CardId; log?: string }[] };

export const NODE_IDS: NodeId[] = MAP.nodes.map((n) => n.id);
export const NODE_INDEX: Record<NodeId, number> = Object.fromEntries(NODE_IDS.map((id, i) => [id, i]));

const nodeById = new Map<NodeId, MapNode>(MAP.nodes.map((n) => [n.id, n]));
const cardById = new Map<CardId, Card>(CARDS.map((c) => [c.id, c]));
const threatById = new Map<ThreatType, ThreatDef>(THREATS.types.map((t) => [t.id, t]));
const roleById = new Map<RoleId, RoleDef>(ROLES.map((r) => [r.id, r]));

export const ADJACENCY: Record<NodeId, NodeId[]> = (() => {
  const adj: Record<NodeId, NodeId[]> = {};
  for (const id of NODE_IDS) adj[id] = [];
  for (const [a, b] of MAP.edges) {
    adj[a]?.push(b);
    adj[b]?.push(a);
  }
  // Canonical order everywhere: map order, never insertion order.
  for (const id of NODE_IDS) adj[id]?.sort((x, y) => (NODE_INDEX[x] ?? 0) - (NODE_INDEX[y] ?? 0));
  return adj;
})();

export const VENT_NODES: NodeId[] = MAP.nodes.filter((n) => n.vent).map((n) => n.id);

export function node(id: NodeId): MapNode {
  const n = nodeById.get(id);
  if (!n) throw new Error(`unknown node: ${id}`);
  return n;
}

export function card(id: CardId): Card {
  const c = cardById.get(id);
  if (!c) throw new Error(`unknown card: ${id}`);
  return c;
}

export function threatDef(type: ThreatType): ThreatDef {
  const t = threatById.get(type);
  if (!t) throw new Error(`unknown threat: ${type}`);
  return t;
}

export function roleDef(id: RoleId): RoleDef {
  const r = roleById.get(id);
  if (!r) throw new Error(`unknown role: ${id}`);
  return r;
}

export function depthDef(depth: Depth): DepthDef {
  const d = DEPTHS.find((x) => x.depth === depth);
  if (!d) throw new Error(`unknown depth: ${depth}`);
  return d;
}

/** Deck list for a role, as card ids with duplicates expanded. */
export function roleDeck(role: RoleId): CardId[] {
  const out: CardId[] = [];
  for (const c of CARDS) {
    if (c.role !== role) continue;
    for (let i = 0; i < c.copies; i++) out.push(c.id);
  }
  return out;
}

export const INFECTION_CARDS: CardId[] = CARDS.filter((c) => c.role === 'infection').map((c) => c.id);
export const TOKEN_TYPES: TokenType[] = ['blank', 'contact', 'drifter', 'burrower'];
export const THREAT_TYPES: ThreatType[] = ['contact', 'drifter', 'burrower', 'mother'];
/** Everything the bag can put on the board. The MOTHER is not one of them. */
export const BAG_THREATS: ThreatType[] = ['contact', 'drifter', 'burrower'];
export const OBJECTIVES: Objective[] = ['run', 'burn', 'call', 'know'];

/** Threat activation order: crawlers, hunters, strays, the MOTHER last. */
export const THREAT_ORDER: ThreatType[] = [...THREAT_TYPES].sort(
  (a, b) => threatDef(a).order - threatDef(b).order,
);

export function edgeKey(a: NodeId, b: NodeId): string {
  return NODE_INDEX[a]! <= NODE_INDEX[b]! ? `${a}|${b}` : `${b}|${a}`;
}

export const ALL_EDGES: [NodeId, NodeId][] = MAP.edges.map(([a, b]) => [a, b] as [NodeId, NodeId]);
