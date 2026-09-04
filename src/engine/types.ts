import type { RngState } from './rng';

export type NodeId = string;
export type CardId = string;
/** A specific physical copy of a card: `cardId@n`. Decks contain duplicates. */
export type Uid = string;
export type RoleId = 'engineer' | 'security' | 'medic' | 'surveyor' | 'pilot';
export type TokenType = 'blank' | 'contact' | 'drifter' | 'burrower' | 'chorus';
export type ThreatType = Exclude<TokenType, 'blank'>;
export type Depth = 1 | 2 | 3 | 4 | 5;
export type Ending = 'clean_break' | 'carrier' | 'scuttle' | 'beacon' | 'lost';
export type Status = 'active' | Ending;
export type Location = NodeId | 'vents';

export type EffectSpec =
  | { op: 'none' }
  | { op: 'gainPower'; n: number }
  | { op: 'gainAp'; n: number }
  | { op: 'move'; silent: boolean }
  | { op: 'draw'; n: number }
  | { op: 'attack'; bonus: number }
  | { op: 'execute' }
  | { op: 'pushThreat' }
  | { op: 'sealEdge'; turns: number; anywhere: boolean }
  | { op: 'setNoise'; scope: 'all' | 'here'; n: number }
  | { op: 'addNoise'; scope: 'here' | 'target'; n: number }
  | { op: 'preventWound'; duration: 'turn' }
  | { op: 'reactorOutput'; n: number }
  | { op: 'recharge' }
  | { op: 'removePanic'; n: number }
  | { op: 'revealCarry'; n: number }
  | { op: 'discardCarry'; n: number }
  | { op: 'drawCarry'; n: number }
  | { op: 'chargeShuttle'; n: number }
  | { op: 'ventEnter' }
  | { op: 'ventJump' }
  | { op: 'search' }
  | { op: 'listen' }
  | { op: 'score'; n: number }
  | { op: 'sequence'; steps: EffectSpec[] };

export type CardRequirement = {
  node?: NodeId;
  ventAccess?: boolean;
  threatHere?: boolean;
  unsearched?: boolean;
};

export type Card = {
  id: CardId;
  name: string;
  role: RoleId | 'panic' | 'salvage';
  copies: number;
  ap: number;
  noise: number;
  burn: boolean;
  weapon?: boolean;
  bonus?: number;
  text: string;
  requires?: CardRequirement;
  effect: EffectSpec;
};

export type CarryCard = { id: 'clean' | 'infested'; revealed: boolean };

export type Threat = {
  id: string;
  type: ThreatType;
  node: Location;
  hp: number;
  /** Chorus only: it has already fed the bag from ORE HOLD. */
  fed?: boolean;
};

export type SealedEdge = { edge: [NodeId, NodeId]; expiresTurn: number };

export type ActionRecord = { turn: number; action: Action; note?: string };

export type LogLine = { turn: number; text: string; kind: 'sys' | 'threat' | 'player' | 'alarm' };

export type Action =
  | { t: 'move'; to: NodeId }
  | { t: 'creep'; to: NodeId }
  | { t: 'listen' }
  | { t: 'search' }
  | { t: 'discard'; uid: Uid }
  | { t: 'play'; uid: Uid; to?: NodeId; edge?: [NodeId, NodeId]; threat?: string; target?: Uid }
  | { t: 'ventEnter' }
  | { t: 'ventExit'; to: NodeId }
  | { t: 'repair' }
  | { t: 'seal'; edge: [NodeId, NodeId] }
  | { t: 'purgeVents' }
  | { t: 'carryScan'; index: number }
  | { t: 'purgeBlood'; index: number }
  | { t: 'recharge'; target: Uid }
  | { t: 'chargeShuttle'; n: number }
  | { t: 'beacon' }
  | { t: 'armScuttle' }
  | { t: 'launch' }
  | { t: 'burn'; uid: Uid }
  | { t: 'endTurn' };

export type ActionType = Action['t'];

export type GameState = {
  seed: string;
  rng: RngState;
  turn: number;
  depth: Depth;
  role: RoleId;
  player: {
    node: Location;
    ap: number;
    hand: Uid[];
    deck: Uid[];
    discard: Uid[];
    burned: Uid[];
    spent: Uid[];
    carry: CarryCard[];
    /** Wounds waiting for the player to choose a card to burn. */
    pendingWounds: number;
    /** Charges of "prevent the next wound", cleared at end of turn. */
    wardsThisTurn: number;
    /** Combat rolls take this modifier until the end of this turn. */
    combatPenalty: number;
    panicsGained: number;
  };
  ship: {
    power: number;
    shuttleCharge: number;
    reactorOutput: number;
    noise: Record<NodeId, number>;
    sealedEdges: SealedEdge[];
    searched: NodeId[];
    salvage: Record<NodeId, string[]>;
    scuttleArmed: boolean;
    /** The turn the overload was armed; it needs time to build (§4.4). */
    scuttleArmedTurn: number;
    beaconSent: boolean;
  };
  bag: Record<TokenType, number>;
  reserve: Record<TokenType, number>;
  threats: Threat[];
  carryDeck: ('clean' | 'infested')[];
  /** The turn the player last listened; the bag readout is public that turn. */
  bagKnownTurn: number;
  /** Monotonic counter so threat ids are deterministic. */
  nextThreatId: number;
  /** 'wound' means the player owes a burn choice and nothing else is legal. */
  phase: 'action' | 'wound';
  /** A wound interrupted end-of-turn processing; finish it once burns resolve. */
  resumeEndTurn: boolean;
  stats: {
    threatsKilled: number;
    wounds: number;
    scans: number;
    bagDraws: number;
    salvageScore: number;
    ventTransits: number;
  };
  log: ActionRecord[];
  feed: LogLine[];
  status: Status;
  /** Set once the run resolves. */
  result?: {
    ending: Ending;
    score: number;
    turn: number;
    infested: number;
    cause: 'deck' | 'timeout' | 'launch';
  };
};
