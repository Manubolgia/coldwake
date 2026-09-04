import { RULES, shuttleRequirement, turnLimit } from '../../engine';
import type { GameState } from '../../engine/types';
import { tokensInBag } from '../../engine/noise';
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
  const need = shuttleRequirement(state.role, state.depth);
  const short = state.ship.shuttleCharge < need;
  return (
    <div className="strip">
      <span>
        HOUR <Value n={state.turn} instant={instant} />
        <span className="dim">/{turnLimit(state.depth)}</span>
      </span>
      <span>
        POWER <Value n={state.ship.power} instant={instant} />
      </span>
      {/* The number the whole run is about, named so that nothing has to
          explain where to look for it. */}
      <span className={short ? '' : 'alarm'}>
        SHUTTLE <Value n={state.ship.shuttleCharge} instant={instant} />
        <span className="dim">/{need}</span>
      </span>
      <span className="pips glow" aria-label="actions left this hour">
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

export function Readout({ state }: { state: GameState }): React.ReactElement {
  const known = state.bagKnownTurn === state.turn;
  const total = tokensInBag(state);
  const carry = state.player.carry;
  const revealed = carry.filter((c) => c.revealed);
  const infested = revealed.filter((c) => c.id === 'infested').length;
  return (
    <div className="readout" data-testid="readout">
      <span className="dim">REACTOR</span>
      <span>
        {state.ship.reactorOutput}
        <span className="dim">/HR</span>
      </span>
      <span className="dim">│</span>
      <span className="dim">STILL OUT THERE</span>
      {known ? (
        <span className="glow" data-testid="bag-known">
          {(
            [
              ['blank', 'NOTHING'],
              ['contact', 'MOVING'],
              ['drifter', 'HEAVY'],
              ['burrower', 'IN THE DUCTS'],
              ['chorus', 'SINGING'],
            ] as const
          )
            .filter(([t]) => (state.bag[t] ?? 0) > 0)
            .map(([t, label]) => `${state.bag[t]} ${label}`)
            .join(' · ')}
        </span>
      ) : (
        <span>
          {'▓'.repeat(Math.min(total, 12))} <span className="dim">{total}</span>
        </span>
      )}
      <span className="dim">│</span>
      <span className="dim">BLOOD</span>
      <span>
        {carry.slice(0, 6).map((c, i) => (
          <span key={i} className={c.revealed && c.id === 'infested' ? 'inverse-alarm' : ''}>
            {c.revealed ? (c.id === 'infested' ? '█' : '▒') : '?'}
          </span>
        ))}
        {carry.length > 6 ? <span className="dim">+{carry.length - 6}</span> : null}
        {infested >= RULES.carry.carrierThreshold ? <span className="alarm"> CARRIER</span> : null}
      </span>
      <span className="dim">│</span>
      <span className="dim">
        KIT {state.player.deck.length + state.player.discard.length} · LOST{' '}
        {state.player.burned.length}
      </span>
    </div>
  );
}
