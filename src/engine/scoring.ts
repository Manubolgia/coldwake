import { RULES } from './content';
import { isPanic, ownedCards } from './deck';
import type { Ending, GameState } from './types';

export type ResolveCause = 'death' | 'timeout' | 'launch';

/** An overload armed too late never reaches critical before the orbit does. */
export function scuttleReady(state: GameState): boolean {
  if (!state.ship.scuttleArmed) return false;
  const fuse = RULES.systemActions.armScuttle?.fuseTurns ?? 0;
  return state.turn - state.ship.scuttleArmedTurn >= fuse;
}

export function endingFor(state: GameState, cause: ResolveCause): Ending {
  if (cause === 'launch') {
    return state.player.carry.filter((c) => c.id === 'infested').length >= RULES.carry.carrierThreshold
      ? 'carrier'
      : 'clean_break';
  }
  if (scuttleReady(state)) return 'scuttle';
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

/** How you reach an ending, with the shipped numbers filled in. */
export function endingHow(ending: Ending): string {
  return RULES.endings[ending].how
    .split('{threshold}')
    .join(String(RULES.carry.carrierThreshold))
    .split('{fuse}')
    .join(String(RULES.systemActions.armScuttle?.fuseTurns ?? 3));
}

export type EndingReport = {
  /** What the ending is, in one clause. */
  verdict: string;
  /** Why this run got this one and not another. */
  why: string;
  /** The nearest thing that would have changed it. */
  instead: string;
};

/**
 * The ending screen used to print a name and a piece of prose, and the
 * playtest kept answering "no" to whether the loss was understood. An ending
 * is a rule firing; this says which rule fired, on this run's numbers, and
 * what the nearest different answer would have been.
 */
export function endingReport(state: GameState): EndingReport {
  const ending = state.result?.ending ?? 'lost';
  const cause = state.result?.cause ?? 'timeout';
  const threshold = RULES.carry.carrierThreshold;
  const infested = state.player.carry.filter((c) => c.id === 'infested').length;
  const fuse = RULES.systemActions.armScuttle?.fuseTurns ?? 3;
  const ran =
    cause === 'deck'
      ? 'Something took the last thing you could still do'
      : 'The orbit closed with you still aboard';

  switch (ending) {
    case 'clean_break':
      return {
        verdict: RULES.endings.clean_break.verdict,
        why:
          `You launched on hour ${state.result?.turn ?? state.turn} with ${state.ship.shuttleCharge} banked, ` +
          `carrying ${infested} infested ${infested === 1 ? 'sample' : 'samples'} — under the ${threshold} that would have made it a delivery.`,
        instead: `One more infested sample aboard and the same launch would have been a CARRIER, at ${RULES.endings.carrier.multiplier}× instead of ${RULES.endings.clean_break.multiplier}×.`,
      };
    case 'carrier':
      return {
        verdict: RULES.endings.carrier.verdict,
        why:
          `You launched carrying ${infested} infested ${infested === 1 ? 'sample' : 'samples'}, and ${threshold} is the number. ` +
          'The shuttle made the relay. So did what was in your blood.',
        instead:
          'Reading your blood in the medbay early enough to flush one, or arming the overload instead of lifting off, ' +
          'were the two ways out of this.',
      };
    case 'scuttle':
      return {
        verdict: RULES.endings.scuttle.verdict,
        why:
          `You armed the overload on hour ${state.ship.scuttleArmedTurn} and it reached critical ${fuse} hours later, ` +
          `on hour ${state.ship.scuttleArmedTurn + fuse}. ${ran}, but nothing aboard outlived you.`,
        instead:
          `A CLEAN BREAK is worth ${RULES.endings.clean_break.multiplier}× against this ` +
          `${RULES.endings.scuttle.multiplier}×, but it needs the shuttle and the shuttle needs the ` +
          'power banked in time. Once it did not, this was the best ending left.',
      };
    case 'beacon':
      return {
        verdict: RULES.endings.beacon.verdict,
        why:
          `${ran}. You had broadcast from comms, so the record leaves even though you do not — ` +
          'and the overload was never armed, which is the only thing that outranks a broadcast.',
        instead: `Arming the overload before the end would have made this a SCUTTLE, at ${RULES.endings.scuttle.multiplier}× instead of ${RULES.endings.beacon.multiplier}×.`,
      };
    default:
      return {
        verdict: RULES.endings.lost.verdict,
        why: `${ran}, with nothing broadcast and no overload armed. Nothing left the ship, including the news.`,
        instead:
          'Once the shuttle is out of reach there are still two endings worth playing for: the overload on the bridge, ' +
          'or a broadcast from comms. Both have to be chosen before the last hour, not in it.',
      };
  }
}

/** End the run. Everything that finishes a run goes through here. */
export function resolveRun(state: GameState, cause: ResolveCause): void {
  if (state.status !== 'active') return;
  const ending = endingFor(state, cause);
  // §4.10: at the moment of escape, every sample is read.
  for (const c of state.player.carry) c.revealed = true;
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
    text: `>> ${RULES.endings[ending].name}.`,
  });
}
