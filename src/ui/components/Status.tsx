import {
  RULES,
  allProgress,
  boardCap,
  forecast,
  hiveWake,
  infectionCount,
  infectionThreshold,
  perceivedIds,
  turnLimit,
} from '../../engine';
import type { GameState, Objective } from '../../engine/types';
import { useFlash } from '../hooks';

/** A number that inverts for a moment when it changes. */
function Value({ n, instant }: { n: number; instant: boolean }): React.ReactElement {
  return <b className={useFlash(n, instant) ? 'inverse' : ''}>{n}</b>;
}

export function StatusStrip({
  state,
  instant,
  onMenu,
}: {
  state: GameState;
  instant: boolean;
  onMenu: () => void;
}): React.ReactElement {
  const pips = '●'.repeat(state.player.ap) + '○'.repeat(Math.max(0, RULES.apPerTurn - state.player.ap));
  const infection = infectionCount(state);
  const threshold = infectionThreshold(state.depth);
  return (
    <div className="strip">
      <span>
        HOUR <Value n={state.turn} instant={instant} />
        <span className="dim">/{turnLimit(state.depth)}</span>
      </span>
      <span>
        POWER <Value n={state.ship.power} instant={instant} />
      </span>
      {/* Infection was a face-down card that decided the ending at the moment
          of escape. It is a number now, and it is on screen from the first one. */}
      <span className={infection >= threshold ? 'alarm' : ''}>
        INFECTION <Value n={infection} instant={instant} />
        <span className="dim">/{threshold}</span>
      </span>
      <span className="pips glow" aria-label="time left this hour">
        {pips}
      </span>
      <button
        style={{ border: 'none', minHeight: 'auto', padding: '2px 4px' }}
        onClick={onMenu}
        aria-label="menu"
        data-testid="menu-button"
      >
        ≡
      </button>
    </div>
  );
}

const TRACK_NAME: Record<Objective, string> = {
  run: 'RUN',
  burn: 'BURN',
  call: 'CALL',
  know: 'KNOW',
};

/**
 * All four routes, always, with the one you declared marked. The old game
 * assigned an ending after the fact and the player could not tell what they
 * were playing for; this is that fix, and it is four lines long.
 */
export function Objectives({ state }: { state: GameState }): React.ReactElement {
  return (
    <div className="objectives" data-testid="objectives">
      {allProgress(state).map((p) => {
        const declared = p.objective === state.objective;
        const cls = ['track', declared ? 'declared' : '', p.ready ? 'ready' : ''].filter(Boolean).join(' ');
        return (
          <span key={p.objective} className={cls} data-objective={p.objective}>
            <span className="dim">{declared ? '▸' : ' '}</span>
            {TRACK_NAME[p.objective]} <span className="glow">{p.label}</span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * The state of the ship, in the terms the rules actually use. Every number the
 * player has to reason about gets a noun and a unit here, so no rule is left
 * living only in prose.
 */
export function Readout({ state }: { state: GameState }): React.ReactElement {
  const seen = perceivedIds(state);
  const cap = boardCap(state.depth);
  const wake = hiveWake(state.depth);
  const fc = forecast(state);
  const board = state.threats.filter((t) => t.type !== 'mother').length;
  return (
    <div className="readout" data-testid="readout">
      <span className="dim">REACTOR</span>
      <span>
        {state.ship.reactorOutput}
        <span className="dim">/{RULES.reactorOutputMax} PER HOUR</span>
      </span>
      <span className="dim">│</span>
      {/* IN SIGHT is what you can currently make out. ABOARD is how many the
          ship will hold at once — the cap, printed, so a quiet hour is legible
          as pressure going somewhere else rather than as nothing happening. */}
      <span className="dim">IN SIGHT</span>
      <span className={seen.size > 0 ? 'alarm' : ''}>{seen.size}</span>
      <span className="dim">
        of {board}/{cap} aboard
      </span>
      <span className="dim">│</span>
      <span className="dim">THE HOLD</span>
      {state.ship.motherWoken ? (
        <span className="alarm" data-testid="mother-awake">
          MOTHER IS UP · CANNOT BE KILLED
        </span>
      ) : (
        <span className={state.ship.hive >= wake - 2 ? 'alarm' : ''}>
          {'█'.repeat(Math.min(state.ship.hive, wake))}
          {'░'.repeat(Math.max(0, wake - state.ship.hive))}{' '}
          <span className="dim">
            {state.ship.hive}/{wake}
          </span>
        </span>
      )}
      <span className="dim">│</span>
      <span className="dim">
        KIT {state.player.deck.length + state.player.discard.length} · GONE {state.player.burned.length}
      </span>
      {state.player.carryingSpecimen ? (
        <>
          <span className="dim">│</span>
          <span className="alarm">CARRYING THE SPECIMEN</span>
        </>
      ) : null}
      {fc.willDraw.length > 0 ? (
        <>
          <span className="dim">│</span>
          <span className="alarm" data-testid="will-draw">
            {fc.willDraw.length} COMPARTMENT{fc.willDraw.length === 1 ? '' : 'S'} LOUD ENOUGH TO DRAW
          </span>
        </>
      ) : null}
    </div>
  );
}
