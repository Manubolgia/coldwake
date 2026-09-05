/**
 * The ship's voice, and the narrator behind it.
 *
 * Every line the player reads is composed here, so the tone stays in one place
 * and the vocabulary stays inside the fiction: the ship does not know it is a
 * board game and never says bag, token, card, deck or turn. It also never
 * reports a blank — a blank is a weight in an urn, it has no referent aboard a
 * ship, and describing five of them was the single worst line in the old game.
 *
 * Lines vary. The variant is chosen from a hash of the state rather than from
 * the game's own generator, so the same seed and the same choices always
 * produce the same story — a replay reads identically — without disturbing the
 * random stream the rules depend on.
 */
import narration from '../content/narration.json';
import { MAP, RULES, depthDef, node, threatDef } from './content';
import { distance } from './graph';
import { cardOf } from './deck';
import { hiveWake, infectionThreshold, relayHold, shuttleRequirement } from './state';
import type { GameState, Location, LogLine, NodeId, Threat, ThreatType, Uid } from './types';

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

export function where(id: Location): string {
  return id === 'vents' ? 'THE CRAWLSPACE' : node(id).name;
}

export function threatName(type: ThreatType): string {
  return threatDef(type).name;
}

export function cardName(uid: Uid): string {
  return cardOf(uid).name;
}

/** How far off, in the words a person would use. */
function range(d: number): string {
  if (d === 0) return 'in here with you';
  if (d === 1) return 'one compartment away';
  if (d === Infinity) return 'somewhere behind a sealed bulkhead';
  return `${d} compartments off`;
}

/**
 * What one contact is doing, from what the player can actually tell. This is
 * the tracker: a thing, a place, a distance and whether it is coming. It never
 * says how many nothings are aboard, because there is no such object.
 */
export function contactLine(state: GameState, t: Threat, from: NodeId): string {
  const name = threatName(t.type);
  const at = t.node === 'vents' ? 'inside the walls' : `in ${node(t.node).name}`;
  const d = t.node === 'vents' ? 1 : distance(state, from, t.node, false);
  const here = state.player.node;
  let doing: string;
  if (t.stalled > 0) doing = 'held where it is, and working at it';
  else if (t.target !== null && t.target === here) doing = 'coming straight here';
  else if (t.stance === 'hunting' && t.target !== null) {
    doing = `heading for ${node(t.target).name}`;
  } else if (t.stance === 'searching') doing = 'searching the compartment it is in';
  else doing = 'drifting, with nothing to follow';
  return `${name} ${at}, ${range(d)}, ${doing}`;
}

/**
 * The result of a listen: everything within earshot, by name, place, distance
 * and intent. Nothing else. If it turns up nothing, it says so in one clause.
 */
export function sweepReport(state: GameState, found: Threat[], reach: number): string {
  const here = state.player.node;
  const from: NodeId = here === 'vents' ? MAP.nest : here;
  if (found.length === 0) {
    return `>> You put your ear to the frame and listen out to ${reach} compartments. ${line(state, 'sweepNothing')}`;
  }
  const parts = found.map((t) => contactLine(state, t, from));
  const body = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join('; ')}; and ${parts.at(-1)}`;
  return `>> You listen out to ${reach} compartments. ${body}.`;
}

export function revealReport(state: GameState, found: Threat[], reach: number): string {
  return sweepReport(state, found, reach);
}

export function arrival(state: GameState, to: NodeId, silent: boolean): string {
  const heard = RULES.basicActions.move?.noise ?? 2;
  return `>> ${line(state, silent ? 'arriveQuiet' : 'arrive', { place: where(to), range: heard })}`;
}

export function spawnLine(state: GameState, type: ThreatType, at: Location): string {
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

export function shrugLine(state: GameState, t: Threat): string {
  return `>> ${line(state, 'shrug', { thing: threatName(t.type), place: where(t.node) })}`;
}

export function lostYou(state: GameState, t: Threat): string {
  return `>> ${line(state, 'lostYou', { thing: threatName(t.type), place: where(t.node) })}`;
}

export function stalledLine(state: GameState, t: Threat): string {
  return `>> ${line(state, 'stalled', { thing: threatName(t.type), place: where(t.node) })}`;
}

export function motherWakes(state: GameState): string {
  return `>> ${line(state, 'motherWake')}`;
}

/** The hive only speaks up when it crosses a line worth acting on. */
export function hiveLine(state: GameState, before: number, after: number, wake: number): string | null {
  const half = Math.ceil(wake / 2);
  const near = Math.max(half + 1, wake - 2);
  if (before < half && after >= half && after < near) return `>> ${line(state, 'hiveHalf')}`;
  if (before < near && after >= near && after < wake) return `>> ${line(state, 'hiveNear')}`;
  return null;
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
  const sum = `${roll}+${bonus}${penalty === 0 ? '' : penalty < 0 ? `−${-penalty}` : `+${penalty}`}`;
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

/** Losing a capability to a wound. Never "burn", never "card". */
export function lost(uid: Uid): string {
  return `>> ${cardName(uid)} — you cannot do that any more.`;
}

/**
 * What the player said they were going to do, and exactly what that takes.
 * Printed on the first hour, so the run never has to guess what it is for.
 */
export function objectiveBriefing(state: GameState): string[] {
  const def = RULES.objectives[state.objective];
  const armScuttle = RULES.systemActions.armScuttle;
  const beacon = RULES.systemActions.beacon;
  const how = def.how
    .split('{shuttle}')
    .join(String(shuttleRequirement(state.role, state.depth)))
    .split('{threshold}')
    .join(String(infectionThreshold(state.depth)))
    .split('{fuse}')
    .join(String(depthDef(state.depth).fuseTurns))
    .split('{power}')
    .join(String(armScuttle?.power ?? 0))
    .split('{hold}')
    .join(String(relayHold(state.depth)))
    .split('{drain}')
    .join(String(beacon?.drain ?? 1));
  return [
    `-- YOU CAME UP HERE TO ${def.name}: ${def.line}`,
    `-- ${how}`,
    '-- Finish any of the other three instead and the run is still a win, worth less. ' +
      'You can change your mind at any point; nothing is decided for you at the end.',
  ];
}

/**
 * The hour opener. The narrator reads the room: what is close, how loud it is,
 * and how much of the window is left.
 */
export function hourLine(state: GameState, nearby: boolean): string {
  const left = depthDef(state.depth).turnLimit - state.turn;
  const here = state.player.node;
  const loud = here !== 'vents' && (state.ship.noise[here] ?? 0) >= 3;
  const pool = nearby
    ? 'hourTense'
    : left <= 4
      ? 'hourLate'
      : loud
        ? 'hourLoud'
        : state.threats.length > 0
          ? 'hourWatchful'
          : 'hourQuiet';
  const hours = left <= 0 ? 'the last of it' : left === 1 ? '1 hour left' : `${left} hours left`;
  return `-- HOUR ${state.turn}, ${hours}. ${line(state, pool)}`;
}

/** How close the hold is to standing up, as a sentence rather than a gauge. */
export function hiveState(state: GameState): string {
  if (state.ship.motherWoken) return 'THE MOTHER IS AWAKE';
  const wake = hiveWake(state.depth);
  return `HOLD ${state.ship.hive}/${wake}`;
}
