/**
 * The ship's voice. Every line the player reads is composed here, so the tone
 * stays in one place and the vocabulary stays inside the fiction: the ship does
 * not know it is a board game and never says bag, token, card or deck.
 */
import { NODE_IDS, THREATS, TOKEN_TYPES, node, threatDef } from './content';
import { cardOf } from './deck';
import type { GameState, LogLine, NodeId, ThreatType, TokenType, Uid } from './types';

export function say(state: GameState, kind: LogLine['kind'], text: string): void {
  state.feed.push({ turn: state.turn, kind, text });
}

export function where(id: NodeId | 'vents'): string {
  return id === 'vents' ? 'THE CRAWLSPACE' : node(id).name;
}

/** What an unresolved return turns out to be, when something classifies it. */
const SIGNATURE: Record<TokenType, string> = {
  blank: 'NOTHING',
  contact: 'MOVING',
  drifter: 'HEAVY',
  burrower: 'INSIDE THE WALLS',
  chorus: 'SINGING',
};

/** The result of a listen: what the hull can still hear that it cannot name. */
export function sweepReport(state: GameState): string {
  const parts: string[] = [];
  for (const t of TOKEN_TYPES) {
    const n = state.bag[t] ?? 0;
    if (n > 0) parts.push(`${n} ${SIGNATURE[t]}`);
  }
  if (parts.length === 0) return '>> SWEEP: NOTHING LEFT UNACCOUNTED FOR. THAT IS WORSE.';
  return `>> SWEEP: ${parts.join(', ')}.`;
}

/** How loud a compartment is, in words, for the player who cannot see a number. */
export function noiseWord(n: number): string {
  if (n <= 0) return 'SILENT';
  if (n <= 1) return 'QUIET';
  if (n <= 2) return 'AUDIBLE';
  if (n <= 3) return 'LOUD';
  return 'CARRYING';
}

export function arrival(state: GameState, to: NodeId, silent: boolean): string {
  const level = state.ship.noise[to] ?? 0;
  if (silent) return `>> ${where(to)}. NOTHING HEARD YOU.`;
  return `>> ${where(to)}. YOUR STEPS CARRY — ${noiseWord(level)}.`;
}

export function threatName(type: ThreatType): string {
  return threatDef(type).name;
}

export function cardName(uid: Uid): string {
  return cardOf(uid).name;
}

/** Losing a capability to a wound. Never "burn", never "card". */
export function lost(uid: Uid): string {
  return `>> ${cardName(uid)} — YOU CANNOT DO THAT ANY MORE.`;
}

export function loudestNodeReport(state: GameState): string {
  let worst: NodeId = NODE_IDS[0] as NodeId;
  for (const id of NODE_IDS) {
    if ((state.ship.noise[id] ?? 0) > (state.ship.noise[worst] ?? 0)) worst = id;
  }
  return `${where(worst)} IS THE LOUDEST PLACE ABOARD.`;
}

export const NEST_ANSWERS = '>> THE HOLD ANSWERS. THERE ARE MORE OF THEM NOW.';
export const NOTHING_THERE = '>> NOTHING THERE. THE SHIP GETS WORSE ANYWAY.';
export const ALL_AWAKE = '>> NOTHING LEFT UNACCOUNTED FOR. EVERYTHING ABOARD MOVES AGAIN.';
export const WALKS_IN = '>> SOMETHING THAT WAS NOT ABOARD BEFORE WALKS IN.';
export const BLANK_TOTAL = THREATS.bag.blank;
