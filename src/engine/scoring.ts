import { RULES } from './content';
import { isPanic, ownedCards } from './deck';
import type { Ending, GameState } from './types';

export type ResolveCause = 'death' | 'timeout' | 'launch';

export function endingFor(state: GameState, cause: ResolveCause): Ending {
  if (cause === 'launch') {
    return state.player.carry.filter((c) => c.id === 'infested').length >= RULES.carry.carrierThreshold
      ? 'carrier'
      : 'clean_break';
  }
  if (state.ship.scuttleArmed) return 'scuttle';
  if (state.ship.beaconSent) return 'beacon';
  return 'lost';
}

export function baseScore(state: GameState): number {
  const s = RULES.score;
  const surviving = ownedCards(state).filter((u) => !isPanic(u)).length;
  return (
    state.ship.shuttleCharge * s.powerBanked +
    state.ship.searched.length * s.nodesSearched +
    state.stats.threatsKilled * s.threatsKilled +
    state.turn * s.turnsSurvived +
    surviving * s.survivingCards +
    state.stats.salvageScore
  );
}

export function scoreFor(state: GameState, ending: Ending): number {
  return Math.round(baseScore(state) * RULES.endings[ending].multiplier);
}

/** End the run. Everything that finishes a run goes through here. */
export function resolveRun(state: GameState, cause: ResolveCause): void {
  if (state.status !== 'active') return;
  const ending = endingFor(state, cause);
  const score = scoreFor(state, ending);
  state.status = ending;
  state.player.pendingWounds = 0;
  state.phase = 'action';
  state.resumeEndTurn = false;
  state.result = {
    ending,
    score,
    turn: state.turn,
    infested: state.player.carry.filter((c) => c.id === 'infested').length,
    cause: cause === 'death' ? 'deck' : cause === 'timeout' ? 'timeout' : 'launch',
  };
  state.feed.push({
    turn: state.turn,
    kind: 'alarm',
    text: `>> RUN RESOLVED: ${RULES.endings[ending].name}. SCORE ${score}.`,
  });
}
