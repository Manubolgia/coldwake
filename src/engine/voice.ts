/**
 * The ship's voice, and the narrator behind it.
 *
 * Every line the player reads is composed here, so the tone stays in one place
 * and the vocabulary stays inside the fiction: the ship does not know it is a
 * board game and never says bag, token, card, deck or turn.
 *
 * Lines vary. The variant is chosen from a hash of the state rather than from
 * the game's own generator, so the same seed and the same choices always
 * produce the same story — a replay reads identically — without disturbing the
 * random stream the rules depend on.
 */
import narration from '../content/narration.json';
import { TOKEN_TYPES, depthDef, node, threatDef } from './content';
import { distance } from './graph';
import { cardOf } from './deck';
import type { GameState, LogLine, NodeId, ThreatType, TokenType, Uid } from './types';

const POOLS = narration as Record<string, string[]>;

export function say(state: GameState, kind: LogLine['kind'], text: string): void {
  state.feed.push({ turn: state.turn, kind, text });
}

/** Stable, cheap, and independent of the rules' random stream. */
function variant(state: GameState, key: string, count: number): number {
  let h = 2166136261 ^ state.turn ^ (state.feed.length << 8);
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % Math.max(count, 1);
}

function line(state: GameState, pool: string, fill: Record<string, string | number> = {}): string {
  const options = POOLS[pool] ?? [];
  if (options.length === 0) return '';
  let text = options[variant(state, pool, options.length)] as string;
  for (const [k, v] of Object.entries(fill)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

export function where(id: NodeId | 'vents'): string {
  return id === 'vents' ? 'THE CRAWLSPACE' : node(id).name;
}

export function threatName(type: ThreatType): string {
  return threatDef(type).name;
}

export function cardName(uid: Uid): string {
  return cardOf(uid).name;
}

/**
 * What a return turns out to be, in words a person can act on — and in the
 * same four names the schematic prints and the manual explains. A listen that
 * said "something heavy" while the map said D and the manual said DRIFTER was
 * three vocabularies for one creature, and read as three creatures.
 */
function signature(type: TokenType, many: boolean): string {
  if (type === 'blank') return many ? 'are nothing at all' : 'is nothing at all';
  const def = threatDef(type);
  return many ? def.signMany : def.sign;
}

/**
 * The result of a listen, written as a sentence rather than a tally: how much
 * of what is still out there is nothing, and how much of it is not.
 */
export function sweepReport(state: GameState): string {
  const parts: string[] = [];
  for (const t of TOKEN_TYPES) {
    const n = state.bag[t] ?? 0;
    if (n === 0) continue;
    const word = signature(t, n > 1);
    parts.push(`${n} ${word}`);
  }
  if (parts.length === 0) return `>> ${line(state, 'sweepNothing')}`;
  const total = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')}, and ${parts.at(-1)}`;
  return `>> You put your ear to the bulkhead. Of what is still unaccounted for aboard, ${total}.`;
}

export function arrival(state: GameState, to: NodeId, silent: boolean): string {
  return `>> ${line(state, silent ? 'arriveQuiet' : 'arrive', { place: where(to) })}`;
}

export function spawnLine(state: GameState, type: ThreatType, at: NodeId | 'vents'): string {
  return `>> ${line(state, 'spawn', { thing: threatName(type), place: where(at) })}`;
}

export function blankLine(state: GameState, worse: boolean): string {
  return `>> ${line(state, worse ? 'blankWorse' : 'blank')}`;
}

export function woundLine(state: GameState, source: string, hard: boolean): string {
  return `>> ${line(state, hard ? 'woundHard' : 'wound', { source })}`;
}

export function killLine(state: GameState, type: ThreatType): string {
  return `>> ${line(state, 'kill', { thing: threatName(type) })}`;
}

export function missLine(
  state: GameState,
  roll: number,
  bonus: number,
  penalty: number,
  target: number,
): string {
  // The sum is shown the way it was actually worked out, penalty and all, so
  // "4+2 against 3" never reads as a miss the player cannot account for.
  const sum = `${roll}+${bonus}${penalty === 0 ? '' : penalty < 0 ? `\u2212${-penalty}` : `+${penalty}`}`;
  return `>> ${line(state, 'miss', { roll: sum, target })}`;
}

export function foundLine(state: GameState, thing: string): string {
  return `>> ${line(state, 'found', { thing })}`;
}

export function chargeLine(state: GameState, n: number, total: number, need: number): string {
  return `>> ${line(state, 'charge', { n, total, need })}`;
}

export function wardLine(state: GameState): string {
  return `>> ${line(state, 'ward')}`;
}

/**
 * A sample arriving in the rack. Every wound puts one there, and until this
 * line existed it was the only thing in the game that happened silently — the
 * CARRIER ending is built out of these and nothing announced them.
 */
export function sampleLine(state: GameState, total: number, unread: number): string {
  return `>> ${line(state, 'sample', { total, unread })}`;
}

/**
 * What a reading means for the ending, said at the moment of the reading. The
 * threshold is the whole of the CARRIER rule, so it is never left implicit.
 */
export function bloodLine(infested: boolean, known: number, threshold: number): string {
  if (!infested) return '>> The sample reads clean. That one, anyway.';
  if (known >= threshold) {
    return (
      `>> Infested. That is ${known} confirmed, and ${threshold} is the number: ` +
      'lift off now and you carry it to the relay yourself. The medbay can still flush what you have not read.'
    );
  }
  return (
    `>> Infested. It is already in you. ${known} confirmed of the ${threshold} ` +
    'that would make the shuttle a delivery rather than an escape.'
  );
}

/** Losing a capability to a wound. Never "burn", never "card". */
export function lost(uid: Uid): string {
  return `>> ${cardName(uid)} — you cannot do that any more.`;
}

/**
 * The hour opener. The narrator reads the room: what is close, how loud it is,
 * and how much of the window is left.
 */
export function hourLine(state: GameState): string {
  const left = depthDef(state.depth).turnLimit - state.turn;
  const here = state.player.node;
  const near =
    here !== 'vents' &&
    state.threats.some((t) => t.node !== 'vents' && distance(state, t.node, here) <= 1);
  const loud =
    here !== 'vents' && (state.ship.noise[here] ?? 0) >= 3;
  const pool = near ? 'hourTense' : left <= 4 ? 'hourLate' : loud ? 'hourLoud' : state.threats.length > 0 ? 'hourWatchful' : 'hourQuiet';
  const hours = left <= 0 ? 'the last of it' : left === 1 ? '1 hour left' : `${left} hours left`;
  return `-- HOUR ${state.turn}, ${hours}. ${line(state, pool)}`;
}
