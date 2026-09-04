import { RULES, legalActions, reduce, setInvariantChecking } from '../engine';
import { next, nextInt } from '../engine/rng';
import type { RngState } from '../engine/rng';
import type { Action, GameState } from '../engine/types';
import { evaluateGreedy, evaluateStrategic } from './eval';

export type BotName = 'random' | 'greedy' | 'heuristic' | 'search';

export type Bot = {
  name: BotName;
  choose(state: GameState, actions: Action[], rng: RngState): [Action, RngState];
};

/** Bots never see anything the UI cannot. §7 rule 5, gate 2.3. */
export function actionsFor(state: GameState): Action[] {
  return legalActions(state);
}

function withRng(state: GameState, rng: RngState): GameState {
  return { ...state, rng };
}

function look(state: GameState, action: Action): GameState | undefined {
  try {
    return reduce(state, action);
  } catch {
    return undefined;
  }
}

function scoreActions(
  state: GameState,
  actions: Action[],
  evaluate: (s: GameState) => number,
): { action: Action; value: number }[] {
  const scored: { action: Action; value: number }[] = [];
  for (const action of actions) {
    const next = look(state, action);
    if (!next) continue;
    scored.push({ action, value: evaluate(next) });
  }
  return scored;
}

function bestOf(scored: { action: Action; value: number }[], fallback: Action): Action {
  let best = fallback;
  let bestValue = -Infinity;
  for (const s of scored) {
    if (s.value > bestValue) {
      bestValue = s.value;
      best = s.action;
    }
  }
  return best;
}

/**
 * Act only while acting improves the position; otherwise end the turn.
 * Without this rule a one-ply bot burns spare AP on harmless no-ops purely to
 * postpone the threat phase, which is not how anybody plays.
 */
function bestOrEndTurn(
  state: GameState,
  actions: Action[],
  evaluate: (s: GameState) => number,
): Action {
  const endTurn = actions.find((a) => a.t === 'endTurn');
  const others = actions.filter((a) => a.t !== 'endTurn');
  if (!endTurn) return bestOf(scoreActions(state, actions, evaluate), actions[0] as Action);
  if (others.length === 0) return endTurn;
  const base = evaluate(state);
  const scored = scoreActions(state, others, evaluate).sort((a, b) => b.value - a.value);
  const top = scored[0];
  if (top && top.value > base + 0.05) return top.action;
  return endTurn;
}

export const RandomBot: Bot = {
  name: 'random',
  choose(_state, actions, rng) {
    const [i, r] = nextInt(rng, actions.length);
    return [actions[i] as Action, r];
  },
};

export const GreedyBot: Bot = {
  name: 'greedy',
  choose(state, actions, rng) {
    return [bestOrEndTurn(state, actions, evaluateGreedy), rng];
  },
};

/**
 * Known infections only. A bot must never read its own face-down CARRY cards,
 * or every balance number about the hidden clock is a lie.
 */
function knownInfested(state: GameState): number {
  return state.player.carry.filter((c) => c.revealed && c.id === 'infested').length;
}

function doomed(state: GameState): boolean {
  return knownInfested(state) >= RULES.carry.carrierThreshold;
}

export const HeuristicBot: Bot = {
  name: 'heuristic',
  choose(state, actions, rng) {
    // Hard rules first: the things a competent player never gets wrong.
    const launch = actions.find((a) => a.t === 'launch');
    // Launching with two confirmed infections is the Carrier ending. Arm the
    // reactor instead and take the ship with you.
    if (launch && !(doomed(state) && !state.ship.scuttleArmed)) return [launch, rng];
    if (state.phase === 'wound') {
      const panic = actions.find((a) => a.t === 'burn' && a.uid.startsWith('panic_'));
      if (panic) return [panic, rng];
    }
    return [bestOrEndTurn(state, actions, evaluateStrategic), rng];
  },
};

/**
 * 2-ply expectimax over the top candidates. The threat phase is deterministic,
 * so only the dice and the bag are sampled.
 */
export const SearchBot: Bot = {
  name: 'search',
  choose(state, actions, rng) {
    const launch = actions.find((a) => a.t === 'launch');
    if (launch && !(doomed(state) && !state.ship.scuttleArmed)) return [launch, rng];
    if (state.phase === 'wound') {
      const panic = actions.find((a) => a.t === 'burn' && a.uid.startsWith('panic_'));
      if (panic) return [panic, rng];
    }
    const base = evaluateStrategic(state);
    const nonEnd = actions.filter((a) => a.t !== 'endTurn');
    const shortlist = scoreActions(state, nonEnd, evaluateStrategic)
      .filter((s) => s.value > base + 0.05)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    const endTurn = actions.find((a) => a.t === 'endTurn');
    if (shortlist.length === 0 && endTurn) return [endTurn, rng];
    if (endTurn) shortlist.push({ action: endTurn, value: base });
    if (shortlist.length === 0) return [actions[0] as Action, rng];

    let r = rng;
    const samples = 3;
    let best = shortlist[0]!.action;
    let bestValue = -Infinity;
    for (const cand of shortlist) {
      let total = 0;
      for (let s = 0; s < samples; s++) {
        const [, r2] = next(r);
        r = r2;
        const rolled = look(withRng(state, r), cand.action);
        if (!rolled) continue;
        if (rolled.status !== 'active') {
          total += evaluateStrategic(rolled);
          continue;
        }
        const replies = legalActions(rolled);
        const inner = scoreActions(rolled, replies, evaluateStrategic);
        const bestInner = inner.reduce((m, x) => (x.value > m ? x.value : m), -Infinity);
        total += Number.isFinite(bestInner) ? bestInner : evaluateStrategic(rolled);
      }
      const value = total / samples;
      if (value > bestValue) {
        bestValue = value;
        best = cand.action;
      }
    }
    return [best, r];
  },
};

export const BOTS: Record<BotName, Bot> = {
  random: RandomBot,
  greedy: GreedyBot,
  heuristic: HeuristicBot,
  search: SearchBot,
};

/** Simulation runs with the invariants on; that is the point of the harness. */
export function enableInvariants(on: boolean): void {
  setInvariantChecking(on);
}
