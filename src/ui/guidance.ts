import guidanceJson from '../content/guidance.json';
import { MAP, RULES, distance, isPanic, isSpent, shuttleRequirement, turnLimit } from '../engine';
import type { GameState, LogLine } from '../engine/types';

export type Advisory = { id: string; trigger: string; text: string };
export const ADVISORIES = guidanceJson.advisories as Advisory[];

export type DisplayLine = { turn: number; kind: LogLine['kind'] | 'guide'; text: string };

/**
 * Conditions the ship notices. Each fires once a run, the first time it is
 * true, so the guidance teaches the game at the moment the game asks the
 * question rather than in a wall of text beforehand.
 */
const TRIGGERS: Record<string, (s: GameState) => boolean> = {
  always: () => true,
  moved: (s) => s.player.node !== MAP.start,
  noiseHereNear: (s) =>
    s.player.node !== 'vents' &&
    (s.ship.noise[s.player.node] ?? 0) >= RULES.noiseThreshold - 1,
  threatOnBoard: (s) => s.threats.length > 0,
  threatWithinOne: (s) =>
    s.player.node !== 'vents' &&
    s.threats.some((t) => t.node !== 'vents' && distance(s, t.node, s.player.node) <= 1),
  wounded: (s) => s.stats.wounds > 0,
  panicInHand: (s) => s.player.hand.some((u) => isPanic(u)),
  searched: (s) => s.ship.searched.length > 0,
  weaponSpent: (s) => s.player.hand.some((u) => isSpent(s, u)) || s.player.spent.length > 0,
  poolNearFull: (s) => s.ship.power >= RULES.powerCap - 2 && s.ship.shuttleCharge === 0,
  atShuttleWithPower: (s) => s.player.node === MAP.escape && s.ship.power > 0,
  bloodUnread: (s) => s.player.carry.filter((c) => !c.revealed).length >= 2,
  bloodInfestedKnown: (s) => s.player.carry.some((c) => c.revealed && c.id === 'infested'),
  reactorDown: (s) => s.ship.reactorOutput < RULES.reactorOutputMax,
  inVents: (s) => s.player.node === 'vents',
  behindSchedule: (s) => {
    const left = turnLimit(s.depth) - s.turn;
    const need = shuttleRequirement(s.role, s.depth) - s.ship.shuttleCharge;
    return left <= Math.floor(turnLimit(s.depth) / 2) && need > left * RULES.reactorOutputMax;
  },
  shuttleUnreachable: (s) => {
    const left = turnLimit(s.depth) - s.turn;
    const need = shuttleRequirement(s.role, s.depth) - s.ship.shuttleCharge;
    return need > s.ship.power + left * RULES.reactorOutputMax;
  },
  shuttleReady: (s) => s.ship.shuttleCharge >= shuttleRequirement(s.role, s.depth),
  nearlyGone: (s) =>
    [...s.player.hand, ...s.player.deck, ...s.player.discard].filter((u) => !isPanic(u)).length <= 3,
};

/**
 * Advisories that have come true and not yet been said. Mutates `fired` so a
 * line is never repeated inside a run.
 */
export function newAdvisories(state: GameState, fired: Set<string>): DisplayLine[] {
  if (state.status !== 'active') return [];
  const out: DisplayLine[] = [];
  for (const a of ADVISORIES) {
    if (fired.has(a.id)) continue;
    const test = TRIGGERS[a.trigger];
    if (test === undefined || !test(state)) continue;
    fired.add(a.id);
    out.push({ turn: state.turn, kind: 'guide', text: a.text });
  }
  return out;
}
