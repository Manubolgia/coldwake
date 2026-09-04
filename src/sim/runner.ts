import { actionKey, cardIdOf, initialState, legalActions, reduce } from '../engine';
import { seedFrom } from '../engine/rng';
import type { Action, Depth, Ending, GameState, RoleId } from '../engine/types';
import { BOTS, type BotName } from './bots';
import { evaluateStrategic } from './eval';

export type RunConfig = {
  seed: string;
  role: RoleId;
  depth: Depth;
  bot: BotName;
  botSeed: string;
  entropy: boolean;
};

export type RunResult = {
  ending: Ending;
  cause: 'deck' | 'timeout' | 'launch';
  score: number;
  turn: number;
  wounds: number;
  killed: number;
  searched: number;
  scans: number;
  infested: number;
  banked: number;
  actions: string[];
  route: string[];
  drawn: string[];
  played: string[];
  /** best-minus-third action value at each decision, when sampled. */
  gaps: number[];
};

const GUARD = 4000;

export function runOne(cfg: RunConfig): RunResult {
  const bot = BOTS[cfg.bot];
  let state: GameState = initialState(cfg.seed, cfg.role, cfg.depth);
  let rng = seedFrom(`${cfg.botSeed}|${cfg.bot}|${cfg.seed}|${cfg.role}|${cfg.depth}`);

  const actions: string[] = [];
  const route: string[] = [state.player.node];
  const drawn = new Set<string>();
  const played: string[] = [];
  const gaps: number[] = [];
  for (const uid of state.player.hand) drawn.add(cardIdOf(uid));

  let guard = 0;
  while (state.status === 'active' && guard++ < GUARD) {
    const legal = legalActions(state);
    if (legal.length === 0) throw new Error('no legal actions while active');
    if (cfg.entropy && state.phase === 'action' && legal.length >= 3) {
      const values = legal
        .map((a) => {
          try {
            return evaluateStrategic(reduce(state, a));
          } catch {
            return -Infinity;
          }
        })
        .sort((a, b) => b - a);
      gaps.push((values[0] ?? 0) - (values[2] ?? 0));
    }
    const [action, nextRng] = bot.choose(state, legal, rng);
    rng = nextRng;
    actions.push(actionKey(action));
    if (action.t === 'play') played.push(cardIdOf(action.uid));
    const before = state.player.node;
    state = reduce(state, action as Action);
    for (const uid of state.player.hand) drawn.add(cardIdOf(uid));
    if (state.player.node !== before) route.push(state.player.node);
  }

  if (state.status === 'active') throw new Error('run did not terminate');
  const r = state.result;
  if (!r) throw new Error('resolved run without a result');
  return {
    ending: r.ending,
    cause: r.cause,
    score: r.score,
    turn: r.turn,
    wounds: state.stats.wounds,
    killed: state.stats.threatsKilled,
    searched: state.ship.searched.length,
    scans: state.stats.scans,
    infested: r.infested,
    banked: state.ship.shuttleCharge,
    actions,
    route,
    drawn: [...drawn],
    played,
    gaps,
  };
}
