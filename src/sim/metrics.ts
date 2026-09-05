import type { Ending } from '../engine/types';
import type { RunResult } from './runner';

export type Accumulator = {
  runs: number;
  wins: number;
  endings: Record<string, number>;
  causes: Record<string, number>;
  turnHistogram: Record<string, number>;
  actionCounts: Record<string, number>;
  actionTotal: number;
  cardDrawn: Record<string, number>;
  cardPlayed: Record<string, number>;
  /** Which route finished each win, and which routes were declared. */
  declaredWins: number;
  declaredRuns: Record<string, number>;
  winsByObjective: Record<string, number>;
  cardsDrawn: number;
  cardsPlayed: number;
  moves: number;
  routes: Record<string, number>;
  gapSamples: number;
  gapUnderThreshold: number;
  gapSum: number;
  sums: {
    score: number;
    turn: number;
    wounds: number;
    killed: number;
    searched: number;
    cures: number;
    infection: number;
    shaken: number;
    listens: number;
    banked: number;
  };
  scanRuns: number;
};

/** Four routes finish the run as a win; the CARRIER is a win worth less. */
export const WIN_ENDINGS: Ending[] = ['escaped', 'overload', 'relay', 'specimen', 'carrier'];
export const ENTROPY_THRESHOLD = 12;

export function emptyAccumulator(): Accumulator {
  return {
    runs: 0,
    wins: 0,
    endings: {},
    causes: {},
    turnHistogram: {},
    actionCounts: {},
    actionTotal: 0,
    cardDrawn: {},
    cardPlayed: {},
    declaredWins: 0,
    declaredRuns: {},
    winsByObjective: {},
    cardsDrawn: 0,
    cardsPlayed: 0,
    moves: 0,
    routes: {},
    gapSamples: 0,
    gapUnderThreshold: 0,
    gapSum: 0,
    sums: {
      score: 0,
      turn: 0,
      wounds: 0,
      killed: 0,
      searched: 0,
      cures: 0,
      infection: 0,
      shaken: 0,
      listens: 0,
      banked: 0,
    },
    scanRuns: 0,
  };
}

function bump(map: Record<string, number>, key: string, n = 1): void {
  map[key] = (map[key] ?? 0) + n;
}

export function accumulate(acc: Accumulator, r: RunResult): void {
  acc.runs += 1;
  if (WIN_ENDINGS.includes(r.ending)) acc.wins += 1;
  bump(acc.endings, r.ending);
  bump(acc.causes, r.ending === 'carrier' ? 'carrier' : r.cause);
  bump(acc.turnHistogram, String(r.turn));
  for (const a of r.actions) {
    bump(acc.actionCounts, a);
    acc.actionTotal += 1;
  }
  for (const c of r.drawn) bump(acc.cardDrawn, c);
  const playedOnce = new Set(r.played);
  for (const c of playedOnce) bump(acc.cardPlayed, c);
  bump(acc.routes, r.route.join('>'));
  for (const g of r.gaps) {
    acc.gapSamples += 1;
    acc.gapSum += g;
    if (g < ENTROPY_THRESHOLD) acc.gapUnderThreshold += 1;
  }
  acc.sums.score += r.score;
  acc.sums.turn += r.turn;
  acc.sums.wounds += r.wounds;
  acc.sums.killed += r.killed;
  acc.sums.searched += r.searched;
  bump(acc.declaredRuns, r.objective);
  if (WIN_ENDINGS.includes(r.ending)) {
    bump(acc.winsByObjective, r.objective);
    if (r.declared) acc.declaredWins += 1;
  }
  acc.cardsDrawn += r.cardsDrawn;
  acc.cardsPlayed += r.cardsPlayed;
  acc.moves += r.moves;
  acc.sums.cures += r.cures;
  acc.sums.infection += r.infection;
  acc.sums.shaken += r.shaken;
  acc.sums.listens += r.listens;
  acc.sums.banked += r.banked;
  if (r.cures > 0) acc.scanRuns += 1;
}

function mergeMap(into: Record<string, number>, from: Record<string, number>): void {
  for (const [k, v] of Object.entries(from)) into[k] = (into[k] ?? 0) + v;
}

export function merge(into: Accumulator, from: Accumulator): Accumulator {
  into.runs += from.runs;
  into.wins += from.wins;
  mergeMap(into.endings, from.endings);
  mergeMap(into.causes, from.causes);
  mergeMap(into.turnHistogram, from.turnHistogram);
  mergeMap(into.actionCounts, from.actionCounts);
  into.actionTotal += from.actionTotal;
  mergeMap(into.cardDrawn, from.cardDrawn);
  mergeMap(into.cardPlayed, from.cardPlayed);
  mergeMap(into.declaredRuns, from.declaredRuns);
  mergeMap(into.winsByObjective, from.winsByObjective);
  into.declaredWins += from.declaredWins;
  into.cardsDrawn += from.cardsDrawn;
  into.cardsPlayed += from.cardsPlayed;
  into.moves += from.moves;
  mergeMap(into.routes, from.routes);
  into.gapSamples += from.gapSamples;
  into.gapUnderThreshold += from.gapUnderThreshold;
  into.gapSum += from.gapSum;
  into.scanRuns += from.scanRuns;
  for (const k of Object.keys(into.sums) as (keyof Accumulator['sums'])[]) {
    into.sums[k] += from.sums[k];
  }
  return into;
}

/** Wilson score interval, so small samples do not lie. */
export function wilson(successes: number, total: number, z = 1.96): [number, number] {
  if (total === 0) return [0, 0];
  const p = successes / total;
  const d = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return [Math.max(0, (centre - spread) / d), Math.min(1, (centre + spread) / d)];
}

export type Summary = {
  runs: number;
  winRate: number;
  winCI: [number, number];
  endings: Record<string, number>;
  causes: Record<string, number>;
  medianTurn: number;
  earlyDeathRate: number;
  topActionShare: number;
  topAction: string;
  dominantRouteShare: number;
  entropyOkRate: number;
  meanGap: number;
  scanRate: number;
  deadCards: string[];
  autoIncludeCards: string[];
  cardPlayRates: Record<string, number>;
  /** Share of wins finished by each route. Every one of the four should register. */
  winSplit: Record<string, number>;
  /** Share of wins that finished the route the run declared at wake. */
  declaredWinRate: number;
  /** Cards played over cards drawn. The old game measured 12%. */
  cardPlayRate: number;
  movesPerRun: number;
  means: {
    score: number;
    turn: number;
    wounds: number;
    killed: number;
    searched: number;
    cures: number;
    infection: number;
    shaken: number;
    listens: number;
    banked: number;
  };
};

export function summarise(acc: Accumulator): Summary {
  const runs = Math.max(acc.runs, 1);
  const turns = Object.entries(acc.turnHistogram)
    .flatMap(([turn, n]) => Array.from({ length: n }, () => Number(turn)))
    .sort((a, b) => a - b);
  const median = turns.length > 0 ? (turns[Math.floor(turns.length / 2)] as number) : 0;
  const early = turns.filter((t) => t < 8).length / runs;
  const actionEntries = Object.entries(acc.actionCounts).sort((a, b) => b[1] - a[1]);
  const top = actionEntries[0] ?? ['none', 0];
  const routeEntries = Object.entries(acc.routes).sort((a, b) => b[1] - a[1]);
  const cardPlayRates: Record<string, number> = {};
  for (const [cardId, drawn] of Object.entries(acc.cardDrawn)) {
    if (cardId.startsWith('panic_')) continue;
    cardPlayRates[cardId] = drawn === 0 ? 0 : (acc.cardPlayed[cardId] ?? 0) / drawn;
  }
  const endings: Record<string, number> = {};
  for (const [k, v] of Object.entries(acc.endings)) endings[k] = v / runs;
  const causeTotal = Object.entries(acc.causes)
    .filter(([k]) => k !== 'launch')
    .reduce((a, [, v]) => a + v, 0);
  const causes: Record<string, number> = {};
  for (const [k, v] of Object.entries(acc.causes)) {
    if (k === 'launch') continue;
    causes[k] = causeTotal === 0 ? 0 : v / causeTotal;
  }
  return {
    runs: acc.runs,
    winRate: acc.wins / runs,
    winCI: wilson(acc.wins, acc.runs),
    endings,
    causes,
    medianTurn: median,
    earlyDeathRate: early,
    topAction: top[0] as string,
    topActionShare: acc.actionTotal === 0 ? 0 : (top[1] as number) / acc.actionTotal,
    dominantRouteShare: routeEntries.length === 0 ? 0 : (routeEntries[0]![1] as number) / runs,
    entropyOkRate: acc.gapSamples === 0 ? 0 : acc.gapUnderThreshold / acc.gapSamples,
    meanGap: acc.gapSamples === 0 ? 0 : acc.gapSum / acc.gapSamples,
    scanRate: acc.scanRuns / runs,
    // The headline numbers of the rework: is every route worth taking, and are
    // the cards you draw cards you get to play?
    winSplit: Object.fromEntries(
      Object.entries(acc.winsByObjective).map(([o, n]) => [o, acc.wins === 0 ? 0 : n / acc.wins]),
    ),
    declaredWinRate: acc.wins === 0 ? 0 : acc.declaredWins / acc.wins,
    cardPlayRate: acc.cardsDrawn === 0 ? 0 : acc.cardsPlayed / acc.cardsDrawn,
    movesPerRun: acc.moves / runs,
    deadCards: Object.entries(cardPlayRates)
      .filter(([, rate]) => rate <= 0.25)
      .map(([id]) => id),
    autoIncludeCards: Object.entries(cardPlayRates)
      .filter(([, rate]) => rate > 0.95)
      .map(([id]) => id),
    cardPlayRates,
    means: {
      score: acc.sums.score / runs,
      turn: acc.sums.turn / runs,
      wounds: acc.sums.wounds / runs,
      killed: acc.sums.killed / runs,
      searched: acc.sums.searched / runs,
      cures: acc.sums.cures / runs,
      infection: acc.sums.infection / runs,
      shaken: acc.sums.shaken / runs,
      listens: acc.sums.listens / runs,
      banked: acc.sums.banked / runs,
    },
  };
}
