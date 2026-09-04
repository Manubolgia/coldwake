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
  return (
    <div className="strip display">
      <span>
        T <Value n={state.turn} instant={instant} />/{turnLimit(state.depth)}
      </span>
      <span>
        PWR <Value n={state.ship.power} instant={instant} />
      </span>
      <span>
        SHT <Value n={state.ship.shuttleCharge} instant={instant} />/
        {shuttleRequirement(state.role, state.depth)}
      </span>
      <span>
        RCT <Value n={state.ship.reactorOutput} instant={instant} />
      </span>
      <span className="pips glow">{pips}</span>
      <button
        style={{ border: 'none', minHeight: 'auto', padding: '2px 4px' }}
        onClick={onMenu}
        aria-label="menu"
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
      <span className="dim">BAG</span>
      {known ? (
        <span className="glow" data-testid="bag-known">
          {(['blank', 'contact', 'drifter', 'burrower', 'chorus'] as const)
            .filter((t) => (state.bag[t] ?? 0) > 0)
            .map((t) => `${t[0]?.toUpperCase()}${state.bag[t]}`)
            .join(' ')}
        </span>
      ) : (
        <span>
          {'▓'.repeat(Math.min(total, 12))} <span className="dim">{total} UNKNOWN</span>
        </span>
      )}
      <span className="dim">│</span>
      <span className="dim">CARRY</span>
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
        DECK {state.player.deck.length + state.player.discard.length} · BURNED {state.player.burned.length}
      </span>
    </div>
  );
}
