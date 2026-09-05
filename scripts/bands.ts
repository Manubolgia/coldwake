/**
 * The Part 5 bands from docs/REDESIGN.md, measured. This is the file that
 * decides whether the rework worked: every number here is one of the six
 * complaints, expressed as something a machine can check.
 */
import {
  actionKey,
  cardIdOf,
  cardOf,
  cardOps,
  initialState,
  legalActions,
  reduce,
  setInvariantChecking,
} from '../src/engine';
import { seedFrom } from '../src/engine/rng';
import { BOTS, type BotName } from '../src/sim/bots';
import type { Depth, GameState, Objective, RoleId } from '../src/engine/types';

setInvariantChecking(false);

const OBJECTIVES: Objective[] = ['run', 'burn', 'call', 'know'];

export type Bands = {
  runs: number;
  winRate: number;
  endings: Record<string, number>;
  cardsPlayed: number;
  cardsDrawn: number;
  playRate: number;
  walks: number;
  systemsUsed: number;
  endTurnShare: number;
  threatsAt: number[];
  peakThreats: number;
  removals: number;
  visited: number;
  wounds: number;
  turn: number;
  actions: Record<string, number>;
  actionTotal: number;
  motherRate: number;
};

export function measure(
  depth: Depth,
  role: RoleId,
  bot: BotName,
  runs: number,
  seedPrefix = 'band',
): Bands {
  const b: Bands = {
    runs,
    winRate: 0,
    endings: {},
    cardsPlayed: 0,
    cardsDrawn: 0,
    playRate: 0,
    walks: 0,
    systemsUsed: 0,
    endTurnShare: 0,
    threatsAt: [],
    peakThreats: 0,
    removals: 0,
    visited: 0,
    wounds: 0,
    turn: 0,
    actions: {},
    actionTotal: 0,
    motherRate: 0,
  };
  const counts: number[][] = [];
  let wins = 0;
  let endTurns = 0;
  const SYSTEMS = new Set([
    'repair', 'seal', 'purgeVents', 'cure', 'recharge',
    'chargeShuttle', 'beacon', 'takeSpecimen', 'upload', 'armScuttle', 'launch',
  ]);
  for (let i = 0; i < runs; i++) {
    const objective = OBJECTIVES[i % OBJECTIVES.length] as Objective;
    let s: GameState = initialState(`${seedPrefix}${i}`, role, depth, objective);
    let rng = seedFrom(`bot${i}`);
    const drawnSeen = new Set<string>();
    const systems = new Set<string>();
    const rooms = new Set<string>([s.player.node]);
    let drawn = s.player.hand.length;
    let handWas = s.player.hand.slice();
    let guard = 0;
    while (s.status === 'active' && guard++ < 4000) {
      const legal = legalActions(s);
      const [a, r] = BOTS[bot].choose(s, legal, rng);
      rng = r;
      const key = actionKey(a);
      b.actions[key] = (b.actions[key] ?? 0) + 1;
      b.actionTotal += 1;
      if (a.t === 'endTurn') {
        endTurns += 1;
        const t = s.turn;
        (counts[t] ??= []).push(s.threats.length);
        b.peakThreats = Math.max(b.peakThreats, s.threats.length);
      }
      // Movement is movement whether it came from your legs or from a card.
      if (a.t === 'move' || a.t === 'creep') b.walks += 1;
      else if (a.t === 'play' && cardOps(cardOf(a.uid)).some((op) => op === 'move' || op === 'ventJump')) {
        b.walks += 1;
      }
      if (a.t === 'play') b.cardsPlayed += 1;
      if (SYSTEMS.has(a.t)) systems.add(a.t);
      s = reduce(s, a);
      // Count every card that newly arrives in hand.
      for (const uid of s.player.hand) {
        if (!handWas.includes(uid)) drawn += 1;
      }
      handWas = s.player.hand.slice();
      for (const uid of s.player.hand) drawnSeen.add(cardIdOf(uid));
      if (s.player.node !== 'vents') rooms.add(s.player.node);
    }
    b.cardsDrawn += drawn;
    b.systemsUsed += systems.size;
    b.visited += rooms.size;
    b.removals += s.stats.threatsKilled + s.stats.threatsShaken;
    b.wounds += s.stats.wounds;
    b.turn += s.result?.turn ?? s.turn;
    if (s.ship.motherWoken) b.motherRate += 1;
    const e = s.status;
    b.endings[e] = (b.endings[e] ?? 0) + 1;
    if (['escaped', 'overload', 'relay', 'specimen', 'carrier'].includes(e)) wins += 1;
  }
  b.winRate = wins / runs;
  b.playRate = b.cardsPlayed / Math.max(1, b.cardsDrawn);
  b.cardsPlayed /= runs;
  b.cardsDrawn /= runs;
  b.walks /= runs;
  b.systemsUsed /= runs;
  b.visited /= runs;
  b.removals /= runs;
  b.wounds /= runs;
  b.turn /= runs;
  b.motherRate /= runs;
  b.endTurnShare = endTurns / b.actionTotal;
  b.threatsAt = counts.map((xs) => (xs.length ? xs.reduce((a, c) => a + c, 0) / xs.length : 0));
  return b;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function report(label: string, b: Bands): void {
  const wins = ['escaped', 'overload', 'relay', 'specimen', 'carrier'];
  const total = wins.reduce((a, e) => a + (b.endings[e] ?? 0), 0);
  console.log(`\n=== ${label} (${b.runs} runs) ===`);
  console.log(`win ${pct(b.winRate)}  median-ish turn ${b.turn.toFixed(1)}  wounds ${b.wounds.toFixed(2)}  MOTHER woke ${pct(b.motherRate)}`);
  console.log('endings', Object.fromEntries(Object.entries(b.endings).sort((x, y) => y[1] - x[1])));
  console.log(
    'win split',
    Object.fromEntries(wins.map((e) => [e, total ? pct((b.endings[e] ?? 0) / total) : '0%'])),
  );
  console.log(
    `cards played/drawn ${b.cardsPlayed.toFixed(1)}/${b.cardsDrawn.toFixed(1)} = ${pct(b.playRate)} (target >=45%)`,
  );
  console.log(`walks ${b.walks.toFixed(1)} (>=8)  systems used ${b.systemsUsed.toFixed(1)}/11 (>=6)  rooms ${b.visited.toFixed(1)}/11 (>=7)`);
  console.log(`endTurn share ${pct(b.endTurnShare)} (<=18%)  removals ${b.removals.toFixed(2)} (>=1.5)  peak threats ${b.peakThreats}`);
  const mid = b.threatsAt[Math.min(15, b.threatsAt.length - 1)] ?? 0;
  console.log(`threats on board by hour: ${b.threatsAt.map((n, i) => (i && i % 2 === 0 ? n.toFixed(1) : null)).filter(Boolean).join(' ')}  (hour 15: ${mid.toFixed(1)}, target <=4)`);
  const top = Object.entries(b.actions).sort((x, y) => y[1] - x[1]).slice(0, 14);
  console.log('top actions', top.map(([k, v]) => `${k} ${pct(v / b.actionTotal)}`).join('  '));
}

if (process.argv[1]?.endsWith('bands.ts')) {
  const depth = Number(process.argv[2] ?? 2) as Depth;
  const runs = Number(process.argv[3] ?? 400);
  const role = (process.argv[4] ?? 'engineer') as RoleId;
  report(`depth ${depth} ${role} heuristic`, measure(depth, role, 'heuristic', runs));
}
