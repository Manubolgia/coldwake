import type { RngState } from './rng';

export type NodeId = string;
export type CardId = string;
/** A specific physical copy of a card: `cardId@n`. Decks contain duplicates. */
export type Uid = string;
export type RoleId = 'engineer' | 'security' | 'medic' | 'surveyor' | 'pilot';
export type TokenType = 'blank' | 'contact' | 'drifter' | 'burrower';
export type ThreatType = Exclude<TokenType, 'blank'> | 'mother';
export type Depth = 1 | 2 | 3 | 4 | 5;

/**
 * The four things worth doing aboard. One is declared at wake and scores full;
 * finishing a different one still ends the run as a win. Nothing is assigned
 * to the player after the fact — §3.1 of docs/REDESIGN.md.
 */
export type Objective = 'run' | 'burn' | 'call' | 'know';

export type Ending =
  /** RUN: off the ship, clean. */
  | 'escaped'
  /** RUN: off the ship, over the infection threshold. */
  | 'carrier'
  /** BURN: the overload reached critical with you alive to see it. */
  | 'overload'
  /** CALL: the relay held for the full watch. */
  | 'relay'
  /** KNOW: the specimen came out of the hold and went up the wire. */
  | 'specimen'
  /** Attrition took the last thing you could do. */
  | 'killed'
  /** The window closed with nothing finished. */
  | 'adrift';

export type Status = 'active' | Ending;
export type Location = NodeId | 'vents';

/** What a threat is doing about you right now. */
export type Stance =
  /** It has a fix on somewhere you were, and is going there. */
  | 'hunting'
  /** It got there, you were gone, and it is casting about. */
  | 'searching'
  /** It has lost you entirely and is drifting toward noise. */
  | 'wandering';

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
  /** Throw something loud somewhere else and pull everything that hears it. */
  | { op: 'lure'; n: number }
  /** Hold every threat in this compartment still for a while. */
  | { op: 'stall'; n: number; scope: 'here' | 'adjacent' }
  | { op: 'preventWound'; duration: 'turn' }
  | { op: 'reactorOutput'; n: number }
  | { op: 'recharge' }
  /** Cut infection out of the deck for good. */
  | { op: 'cure'; n: number }
  /** Put infection into the deck. Salvage that costs you something. */
  | { op: 'infect'; n: number }
  | { op: 'reveal'; range: number }
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
  role: RoleId | 'infection' | 'salvage';
  copies: number;
  ap: number;
  noise: number;
  burn: boolean;
  weapon?: boolean;
  bonus?: number;
  /** Found gear that joins the deck instead of resolving where it is found. */
  keep?: boolean;
  text: string;
  requires?: CardRequirement;
  effect: EffectSpec;
};

export type Threat = {
  id: string;
  type: ThreatType;
  node: Location;
  hp: number;
  /** The last place it has any reason to believe you are. */
  target: NodeId | null;
  stance: Stance;
  /** Hours since it last had a fix on you. */
  cold: number;
  /** Hours it is held where it stands, by a seal, a purge or a lure. */
  stalled: number;
  /** Where the player last actually perceived it, and when. */
  seenNode: Location | null;
  seenTurn: number;
};

export type SealedEdge = { edge: [NodeId, NodeId]; expiresTurn: number };

export type ActionRecord = { turn: number; action: Action; note?: string };

export type LogLine = { turn: number; text: string; kind: 'sys' | 'threat' | 'player' | 'alarm' };

export type Action =
  | { t: 'move'; to: NodeId }
  | { t: 'creep'; to: NodeId }
  | { t: 'listen' }
  | { t: 'search' }
  | { t: 'brace' }
  | { t: 'discard'; uid: Uid }
  | { t: 'play'; uid: Uid; to?: NodeId; edge?: [NodeId, NodeId]; threat?: string; target?: Uid }
  | { t: 'ventEnter' }
  | { t: 'ventExit'; to: NodeId }
  | { t: 'repair' }
  | { t: 'seal'; edge: [NodeId, NodeId] }
  | { t: 'purgeVents' }
  | { t: 'cure' }
  | { t: 'recharge'; target: Uid }
  | { t: 'chargeShuttle'; n: number }
  | { t: 'beacon' }
  | { t: 'takeSpecimen' }
  | { t: 'upload' }
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
  /** What the player said they were going to do, on the hour they woke. */
  objective: Objective;
  player: {
    node: Location;
    ap: number;
    hand: Uid[];
    deck: Uid[];
    discard: Uid[];
    burned: Uid[];
    spent: Uid[];
    /**
     * The hand persists across hours, so it needs a way to turn over: once an
     * hour you may play a card or set one aside for nothing. Without it a hand
     * of four cards you do not want is a hand you keep for the rest of the run.
     */
    freeCardUsed: boolean;
    /** Wounds waiting for the player to choose a card to burn. */
    pendingWounds: number;
    /** Charges of "prevent the next wound", cleared at end of turn. */
    wardsThisTurn: number;
    /** Combat rolls take this modifier until the end of this turn. */
    combatPenalty: number;
    infectionsGained: number;
    /** The thing out of the ore hold, if it has been cut free. */
    carryingSpecimen: boolean;
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
    scuttleArmedTurn: number;
    beaconSent: boolean;
    /** Hours the relay has been held since the last broadcast. */
    relayHeld: number;
    /** The specimen is out of the nest. */
    specimenTaken: boolean;
    /** How awake the ship is. When it fills, the MOTHER gets up. */
    hive: number;
    motherWoken: boolean;
  };
  bag: Record<TokenType, number>;
  reserve: Record<TokenType, number>;
  threats: Threat[];
  /** Monotonic counter so threat ids are deterministic. */
  nextThreatId: number;
  /** 'wound' means the player owes a burn choice and nothing else is legal. */
  phase: 'action' | 'wound';
  /** A wound interrupted end-of-turn processing; finish it once burns resolve. */
  resumeEndTurn: boolean;
  stats: {
    threatsKilled: number;
    threatsShaken: number;
    cardsPlayed: number;
    wounds: number;
    cures: number;
    bagDraws: number;
    salvageScore: number;
    ventTransits: number;
    listens: number;
  };
  log: ActionRecord[];
  feed: LogLine[];
  status: Status;
  /** Set once the run resolves. */
  result?: {
    ending: Ending;
    objective: Objective;
    declared: boolean;
    score: number;
    turn: number;
    infection: number;
    cause: 'attrition' | 'timeout' | 'objective';
  };
};

/** What the threats will do if the player ends the hour now. §3.3. */
export type ForecastEntry = {
  id: string;
  type: ThreatType;
  from: Location;
  to: Location;
  /** It ends its move where the player is standing. */
  reaches: boolean;
  /** The player can currently perceive it, so this is honest information. */
  perceived: boolean;
};

export type Forecast = {
  moves: ForecastEntry[];
  /** Compartments loud enough that ending the hour draws something new. */
  willDraw: NodeId[];
  /** Something will reach the player if the hour ends as it stands. */
  danger: boolean;
};
