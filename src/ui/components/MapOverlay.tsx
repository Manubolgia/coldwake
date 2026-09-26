import { useState } from 'react';
import { roomName } from '../../game/rules';
import type { ActionOption, GameState } from '../../game/types';
import { Icon } from '../art/Icon';
import { ActionRow, keyOf } from './Actions';
import { ShipMap } from './ShipMap';
import { Threats } from './Stage';

export function MapLegend() {
  return (
    <div className="maplegend">
      <span>
        <i style={{ background: 'var(--cyan)' }} />
        You
      </span>
      <span>
        <i style={{ background: 'var(--red)' }} />
        Creature
      </span>
      <span>
        <i style={{ background: 'rgba(255,77,94,.35)', borderRadius: 2 }} />
        Can hear you
      </span>
      <span>
        <i style={{ background: 'var(--cyan)', transform: 'rotate(45deg)', borderRadius: 1 }} />
        Objective
      </span>
      <span>
        <i style={{ background: 'var(--amber)', transform: 'rotate(45deg)', borderRadius: 1 }} />
        Secret
      </span>
    </div>
  );
}

/** The whole ship. Tap a room next to you to see what going there costs, then go. */
export function MapPanel({
  s,
  options,
  die,
  onAct,
  locked,
}: {
  s: GameState;
  options: ActionOption[];
  die: number | null;
  onAct: (o: ActionOption) => void;
  locked: boolean;
}) {
  const [pick, setPick] = useState<string | null>(null);
  const opt = pick ? options.find((o) => (o.id === 'move' || o.id === 'force') && o.target === pick) : undefined;
  const r = pick ? s.rooms[pick] : undefined;
  return (
    <div className="mappanel">
      <ShipMap s={s} onRoom={(id) => setPick(id === pick ? null : id)} highlight={pick} />
      <MapLegend />
      {r && (
        <div className="map-pick">
          {opt && !locked ? (
            <ActionRow key={keyOf(opt)} o={opt} die={die} onAct={(o) => (onAct(o), setPick(null))} flash={false} />
          ) : (
            <p className="blurb">
              {r.id === s.player.room
                ? 'You are here.'
                : `${r.known ? roomName(s, r.id) : 'An unexplored room'} — not next to you. Rooms you can reach from here have a brighter edge.`}
            </p>
          )}
        </div>
      )}
      {!r && <p className="blurb map-tip">Tap a room next to yours to go there.</p>}
    </div>
  );
}

export function MapOverlay(props: { s: GameState; options: ActionOption[]; die: number | null; onAct: (o: ActionOption) => void; onClose: () => void; locked: boolean }) {
  return (
    <div className="backdrop" onClick={props.onClose} role="dialog" aria-modal="true" aria-label="Ship map">
      <div className="sheet mapsheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h3 className="sheet-title">
            <Icon name="map" /> The {props.s.scenario.shipName}
          </h3>
          <button className="icon-btn" onClick={props.onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">
          <MapPanel {...props} onAct={(o) => (props.onAct(o), props.onClose())} />
          <Threats s={props.s} />
        </div>
      </div>
    </div>
  );
}
