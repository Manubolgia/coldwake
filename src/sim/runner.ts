import { actionKey, cardIdOf, initialState, legalActions, reduce } from '../engine';
import { seedFrom } from '../engine/rng';
import type { Action, Depth, Ending, GameState, Objective, RoleId } from '../engine/types';
import { BOTS, type BotName } from './bots';
import { evaluateStrategic } from './eval';

export type RunConfig = {
  seed: string;
  role: RoleId;
  depth: Depth;
  objective?: Objective;
  bot: BotName;
  botSeed: string;
  entropy: boolean;
};

export type RunResult = {
  ending: Ending;
  objective: Objective;
  declared: boolean;
  cause: 'attrition' | 'timeout' | 'objective';
  score: number;
  turn: number;
  wounds: number;
  killed: number;
  searched: number;
  cures: number;
  infection: number;
  shaken: number;
  listens: number;
  cardsDrawn: number;
  cardsPlayed: number;
  moves: number;
  banked: number;
  actions: string[];
  route: string[];
  drawn: string[];
  played: string[];
  /** best-minus-third action value at each decision, when sampled. */
  gaps: number[];
};

/**
 * Runs rotate through the four objectives. A batch that only ever declares RUN
 * measures one quarter of the game and reports it as the whole.
 */
export const OBJECTIVE_ROTATION: Objective[] = ['run', 'burn', 'call', 'know'];
export function objectiveFor(i: number): Objective {
  return OBJECTIVE_ROTATION[i % OBJECTIVE_ROTATION.length] as Objective;
}

const GUARD = 4000;

export function runOne(cfg: RunConfig): RunResult {
  const bot = BOTS[cfg.bot];
  let state: GameState = initialState(cfg.seed, cfg.role, cfg.depth, cfg.objective ?? 'run');
  let rng = seedFrom(`${cfg.botSeed}|${cfg.bot}|${cfg.seed}|${cfg.role}|${cfg.depth}`);

  const actions: string[] = [];
  const route: string[] = [state.player.node];
  const drawn = new Set<string>();
  // Every card that newly arrives in hand, and every act of moving — whether it
  // came from your legs or from a card.
  let drawnCount = state.player.hand.length;
  let handWas = state.player.hand.slice();
  let moves = 0;
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
    for (const uid of state.player.hand) {
      drawn.add(cardIdOf(uid));
      if (!handWas.includes(uid)) drawnCount += 1;
    }
    handWas = state.player.hand.slice();
    if (state.player.node !== before) {
      route.push(state.player.node);
      if (state.player.node !== 'vents' && before !== 'vents') moves += 1;
    }
  }

  if (state.status === 'active') throw new Error('run did not terminate');
  const r = state.result;
  if (!r) throw new Error('resolved run without a result');
  return {
    ending: r.ending,
    objective: r.objective,
    declared: r.declared,
    cause: r.cause,
    score: r.score,
    turn: r.turn,
    wounds: state.stats.wounds,
    killed: state.stats.threatsKilled,
    searched: state.ship.searched.length,
    cures: state.stats.cures,
    cardsDrawn: drawnCount,
    cardsPlayed: state.stats.cardsPlayed,
    moves,
    infection: r.infection,
    shaken: state.stats.threatsShaken,
    listens: state.stats.listens,
    banked: state.ship.shuttleCharge,
    actions,
    route,
    drawn: [...drawn],
    played,
    gaps,
  };
}
