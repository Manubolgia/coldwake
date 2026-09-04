import { RULES, shuttleRequirement, turnLimit } from '../../engine';
import type { GameState } from '../../engine/types';
import { tokensInBag } from '../../engine/noise';

export function StatusStrip({ state, onMenu }: { state: GameState; onMenu: () => void }): React.ReactElement {
  const pips = '●'.repeat(state.player.ap) + '○'.repeat(Math.max(0, RULES.apPerTurn - state.player.ap));
  return (
    <div className="strip display">
      <span>
        T <b>{state.turn}</b>/{turnLimit(state.depth)}
      </span>
      <span>
        PWR <b>{state.ship.power}</b>
      </span>
      <span>
        SHT <b>{state.ship.shuttleCharge}</b>/{shuttleRequirement(state.role, state.depth)}
      </span>
      <span>
        RCT <b>{state.ship.reactorOutput}</b>
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

export function Feed({ state }: { state: GameState }): React.ReactElement {
  const lines = state.feed.slice(-6);
  return (
    <div className="feed" data-testid="feed">
      {lines.map((l, i) => (
        <div key={i} className={l.kind === 'alarm' ? 'alarm' : ''}>
          {l.text}
        </div>
      ))}
    </div>
  );
}
