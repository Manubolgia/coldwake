import { RULES, depthDef } from './content';
import { infectionCount, isInfection, ownedCards } from './deck';
import { fuseTurns, infectionThreshold, relayHold, shuttleRequirement } from './state';
import type { Ending, GameState, Objective } from './types';

export type ResolveCause = 'attrition' | 'timeout' | 'objective';

/** How far along each of the four routes this run actually is, right now. */
export type Progress = {
  objective: Objective;
  /** Where the tracker stands, and what it has to reach. */
  have: number;
  need: number;
  /** The tracker is full: the objective is finished, or one action from it. */
  ready: boolean;
  /** One short line for the status strip. */
  label: string;
};

export function shuttleProgress(state: GameState): Progress {
  const need = shuttleRequirement(state.role, state.depth);
  return {
    objective: 'run',
    have: state.ship.shuttleCharge,
    need,
    ready: state.ship.shuttleCharge >= need,
    label: `SHUTTLE ${state.ship.shuttleCharge}/${need}`,
  };
}

export function fuseProgress(state: GameState): Progress {
  const need = fuseTurns(state.depth);
  const have = state.ship.scuttleArmed ? state.turn - state.ship.scuttleArmedTurn : 0;
  return {
    objective: 'burn',
    have,
    need,
    ready: state.ship.scuttleArmed && have >= need,
    label: state.ship.scuttleArmed ? `FUSE ${have}/${need}` : 'FUSE NOT ARMED',
  };
}

export function relayProgress(state: GameState): Progress {
  const need = relayHold(state.depth);
  return {
    objective: 'call',
    have: state.ship.relayHeld,
    need,
    ready: state.ship.beaconSent && state.ship.relayHeld >= need,
    label: state.ship.beaconSent ? `RELAY ${state.ship.relayHeld}/${need}` : 'RELAY SILENT',
  };
}

export function specimenProgress(state: GameState): Progress {
  const have = state.player.carryingSpecimen ? 1 : state.ship.specimenTaken ? 1 : 0;
  return {
    objective: 'know',
    have,
    need: 1,
    ready: state.player.carryingSpecimen,
    label: state.player.carryingSpecimen ? 'SPECIMEN CARRIED' : 'SPECIMEN IN THE HOLD',
  };
}

/** All four trackers, always, in a fixed order. Nothing here is hidden. */
export function allProgress(state: GameState): Progress[] {
  return [shuttleProgress(state), fuseProgress(state), relayProgress(state), specimenProgress(state)];
}

/** The overload has run its fuse and is going off now. */
export function scuttleReady(state: GameState): boolean {
  return fuseProgress(state).ready;
}

export function relayReady(state: GameState): boolean {
  return relayProgress(state).ready;
}

export function baseScore(state: GameState): number {
  const s = RULES.score;
  const surviving = ownedCards(state).filter((u) => !isInfection(u)).length;
  return (
    state.ship.shuttleCharge * s.powerBanked +
    state.ship.searched.length * s.nodesSearched +
    state.stats.threatsKilled * s.threatsKilled +
    state.stats.threatsShaken * s.threatsShaken +
    state.turn * s.turnsSurvived +
    surviving * s.survivingCards +
    state.stats.cures * s.cures +
    state.stats.salvageScore
  );
}

/**
 * The ending multiplies the run by between 0.8 and 1.25, and no further. In the
 * old game it ran from 0.3 to 1.5, which meant the last flag set outweighed
 * every decision taken before it — §3.1.
 */
export function scoreFor(state: GameState, ending: Ending, declared: boolean): number {
  const base = baseScore(state) * RULES.endings[ending].multiplier;
  return Math.round(declared ? base * RULES.declaredBonus : base);
}

export function objectiveOf(ending: Ending): Objective | undefined {
  return RULES.endings[ending].objective;
}

/** How you reach an ending, with the shipped numbers filled in. */
export function endingHow(ending: Ending, state?: GameState): string {
  const depth = state?.depth ?? 1;
  const role = state?.role ?? 'engineer';
  return RULES.endings[ending].how
    .split('{threshold}')
    .join(String(infectionThreshold(depth)))
    .split('{shuttle}')
    .join(String(shuttleRequirement(role, depth)))
    .split('{fuse}')
    .join(String(fuseTurns(depth)))
    .split('{hold}')
    .join(String(relayHold(depth)));
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
 * An ending is a rule firing. This says which rule fired, on this run's own
 * numbers, and what the nearest different answer would have been — and because
 * every objective was declared and tracked, none of it is news.
 */
export function endingReport(state: GameState): EndingReport {
  const r = state.result;
  const ending = r?.ending ?? 'adrift';
  const declared = RULES.objectives[state.objective];
  const threshold = infectionThreshold(state.depth);
  const infection = r?.infection ?? infectionCount(state);
  const bonus = RULES.declaredBonus;
  const said = `You said you were here to ${declared.name}.`;

  switch (ending) {
    case 'escaped':
      return {
        verdict: RULES.endings.escaped.verdict,
        why:
          `You launched on hour ${r?.turn ?? state.turn} with ${state.ship.shuttleCharge} banked and ` +
          `${infection} infection in the deck — under the ${threshold} that makes the shuttle a delivery.`,
        instead:
          r?.declared === true
            ? `Declared and delivered, so the run carries the ${bonus}× for finishing what you set out to do.`
            : `${said} You finished a RUN instead, which is still a win — it just does not carry the ${bonus}×.`,
      };
    case 'carrier':
      return {
        verdict: RULES.endings.carrier.verdict,
        why:
          `You launched carrying ${infection} infection and ${threshold} is the number. ` +
          'You could see the count the whole way. The shuttle made the relay, and so did it.',
        instead:
          `Two hours in the MEDBAY at ${RULES.systemActions.cure?.ap ?? 2} time and ` +
          `${RULES.systemActions.cure?.power ?? 2} power an hour would have cut it under the line. ` +
          'So would arming the overload instead of lifting off.',
      };
    case 'overload':
      return {
        verdict: RULES.endings.overload.verdict,
        why:
          `You armed it on hour ${state.ship.scuttleArmedTurn} and were still alive ` +
          `${fuseTurns(state.depth)} hours later when it went. Nothing aboard outlived you.`,
        instead:
          r?.declared === true
            ? `Declared and delivered: the ${bonus}× is for choosing the hard one and holding to it.`
            : `${said} The overload is what you got to, and it counts.`,
      };
    case 'relay':
      return {
        verdict: RULES.endings.relay.verdict,
        why:
          `You broadcast and then held the transmitter ${relayHold(state.depth)} straight hours ` +
          'with the reactor up and the bulkheads down.',
        instead:
          r?.declared === true
            ? `Declared and delivered, at ${bonus}×.`
            : `${said} You held the relay instead, and it counts.`,
      };
    case 'specimen':
      return {
        verdict: RULES.endings.specimen.verdict,
        why:
          'You cut it out of the nest, carried it while it called to everything aboard, and put it up the wire from COMMS.',
        instead:
          r?.declared === true
            ? `Declared and delivered, at ${bonus}×.`
            : `${said} You took the specimen instead, and it counts.`,
      };
    case 'killed':
      return {
        verdict: RULES.endings.killed.verdict,
        why:
          `${state.stats.wounds} wounds, and each one took a capability for good. ` +
          `The last one had nothing left to take. ${infection} infection was in the deck by then.`,
        instead:
          'Every wound in this game is telegraphed the hour before it lands: the forecast under the ' +
          'schematic names what is about to reach you. Bracing, sealing, luring or simply walking away ' +
          'are all cheaper than a wound.',
      };
    default:
      return {
        verdict: RULES.endings.adrift.verdict,
        why:
          `The orbit closed on hour ${r?.turn ?? state.turn}. ${said} ` +
          progressSummary(state),
        instead:
          'All four routes stay open to the last hour, and three of them do not need the shuttle. ' +
          'The overload needs the bridge and the power; the relay needs comms and a working reactor; ' +
          'the specimen needs the hold and one trip to comms.',
      };
  }
}

/** Where each tracker stood when the window shut. */
function progressSummary(state: GameState): string {
  return allProgress(state)
    .map((p) => p.label)
    .join(' · ');
}

/**
 * End the run. Everything that finishes a run goes through here. The ending is
 * whichever objective was actually completed — it is never inferred from a
 * corpse.
 */
export function resolveRun(state: GameState, cause: ResolveCause, ending?: Ending): void {
  if (state.status !== 'active') return;
  const infection = infectionCount(state);
  let final: Ending;
  if (ending !== undefined) {
    final = ending;
  } else if (cause === 'attrition') {
    final = 'killed';
  } else {
    // The window closed. An overload already past its fuse still goes off.
    final = scuttleReady(state) ? 'overload' : relayReady(state) ? 'relay' : 'adrift';
  }
  const objective = objectiveOf(final);
  const declared = objective !== undefined && objective === state.objective;
  const score = scoreFor(state, final, declared);
  state.status = final;
  state.player.pendingWounds = 0;
  state.phase = 'action';
  state.resumeEndTurn = false;
  state.result = {
    ending: final,
    objective: objective ?? state.objective,
    declared,
    score,
    turn: state.turn,
    infection,
    cause,
  };
  const name = RULES.endings[final].name ?? (final === 'killed' ? 'KILLED' : 'ADRIFT');
  state.feed.push({ turn: state.turn, kind: 'alarm', text: `>> ${name}.` });
}

export { depthDef };
