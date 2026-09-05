import { RULES, shuttleRequirement, turnLimit } from '../../engine';
import { THREATS } from '../../engine/content';
import type { GameState, TokenType } from '../../engine/types';
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
      {/* Two different numbers, and the player asked which was which: ABOARD is
          what is on the schematic right now, STILL OUT THERE is what has not
          shown itself — most of which turns out to be nothing. */}
      <span className="dim">ABOARD</span>
      <span className={state.threats.length > 0 ? 'alarm' : ''}>{state.threats.length}</span>
      <span className="dim">│</span>
      <span className="dim">STILL OUT THERE</span>
      {known ? (
        <span className="glow" data-testid="bag-known">
          {(
            [
              ['blank', 'NOTHING', 'NOTHING'],
              ...THREATS.types.map((t) => [t.id, t.name, t.namePlural] as const),
            ] as const
          )
            .filter(([t]) => (state.bag[t as TokenType] ?? 0) > 0)
            .map(([t, one, many]) => {
              const n = state.bag[t as TokenType] ?? 0;
              return `${n} ${n === 1 ? one : many}`;
            })
            .join(' · ')}
        </span>
      ) : (
        <span>
          {'▓'.repeat(Math.min(total, 12))} <span className="dim">{total}</span>
          <span className="dim"> MOSTLY NOTHING</span>
        </span>
      )}
      <span className="dim">│</span>
      {/* The marks alone never said what the marks were for. The count against
          the threshold is the whole CARRIER rule, printed where it is read. */}
      <span className="dim">BLOOD</span>
      <span>
        {carry.slice(0, 6).map((c, i) => (
          <span key={i} className={c.revealed && c.id === 'infested' ? 'inverse-alarm' : ''}>
            {c.revealed ? (c.id === 'infested' ? '█' : '▒') : '?'}
          </span>
        ))}
        {carry.length > 6 ? <span className="dim">+{carry.length - 6}</span> : null}
        <span className={infested >= RULES.carry.carrierThreshold ? 'alarm' : 'dim'}>
          {' '}
          {infested}/{RULES.carry.carrierThreshold} INFECTED
        </span>
        {carry.length - revealed.length > 0 ? (
          <span className="dim"> · {carry.length - revealed.length} UNREAD</span>
        ) : null}
        {infested >= RULES.carry.carrierThreshold ? <span className="alarm"> · CARRIER</span> : null}
      </span>
      <span className="dim">│</span>
      <span className="dim">
        KIT {state.player.deck.length + state.player.discard.length} · LOST{' '}
        {state.player.burned.length}
      </span>
    </div>
  );
}
