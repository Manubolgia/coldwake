import type { ReactNode } from 'react';
import { describePlan, planCreature, visibleCreatures } from '../../game/actions';
import { CREATURES } from '../../game/content/creatures';
import { roomName } from '../../game/rules';
import type { GameState, StoryCard } from '../../game/types';
import { Art } from '../art/Art';
import { Icon } from '../art/Icon';
import { ShipMap } from './ShipMap';

const MOTES: [number, number, number, number][] = Array.from({ length: 14 }, (_, i) => [(i * 37) % 100, 30 + ((i * 53) % 65), -((i * 1.7) % 14), 11 + (i % 5) * 2]);

/**
 * The scene you are standing in, drawn full-bleed behind everything else: the
 * room as it is right now (on fire, dark, with whatever is in there with you),
 * or the story card being told. The narrator speaks over the middle of it.
 */
export function Stage({
  s,
  card,
  onMap,
  showMinimap,
  children,
}: {
  s: GameState;
  card: StoryCard | null;
  onMap: () => void;
  showMinimap: boolean;
  children: ReactNode;
}) {
  const r = s.rooms[s.player.room]!;
  const here = s.creatures.filter((c) => c.room === r.id).map((c) => c.kind);
  const art = card ? card.art : r.type;
  const artKey = card ? `card-${card.uid}` : `room-${r.id}-${r.hazards.join('')}-${here.join('')}`;
  return (
    <section className={`stage ${card ? `carded t-${card.tone}` : ''}`} aria-label="Where you are">
      <div className="scene" key={artKey}>
        <Art art={art} className="scene-art" hazards={card ? undefined : r.hazards} creatures={card ? undefined : here} />
      </div>
      <div className="motes" aria-hidden="true">
        {MOTES.map(([x, y, d, t], i) => (
          <i key={i} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s`, animationDuration: `${t}s` }} />
        ))}
      </div>
      <div className="stage-shade" />
      <div className="stage-top">
        <div className="where">
          <span className="eyebrow">You are in</span>
          <h2 data-testid="room-name">{roomName(s, r.id)}</h2>
          <Chips s={s} />
        </div>
        {showMinimap && (
          <button className="minimap" onClick={onMap} aria-label="Open the ship map">
            <ShipMap s={s} mini />
            <span className="minimap-label">
              <Icon name="map" size={12} /> Map
            </span>
          </button>
        )}
      </div>
      <div className="stage-mid">{children}</div>
      <Threats s={s} />
    </section>
  );
}

function Chips({ s }: { s: GameState }) {
  const r = s.rooms[s.player.room]!;
  return (
    <div className="chips">
      {r.hazards.includes('fire') && (
        <span className="chip red">
          <Icon name="fire" size={12} /> On fire
        </span>
      )}
      {r.hazards.includes('breach') && (
        <span className="chip red">
          <Icon name="breach" size={12} /> Open to space
        </span>
      )}
      {r.hazards.includes('dark') && (
        <span className="chip violet">
          <Icon name="dark" size={12} /> Dark
        </span>
      )}
      {s.player.hidden && (
        <span className="chip green">
          <Icon name="hide" size={12} /> Hidden
        </span>
      )}
      {s.companion && (
        <span className="chip cyan">
          <Icon name="person" size={12} /> {s.companion.name.split(' ')[0]}
        </span>
      )}
      {s.player.infected && s.player.infectionKnown && (
        <span className="chip red">
          <Icon name="sample" size={12} /> Infected
        </span>
      )}
      {s.progress.rescueIn !== null && (
        <span className="chip amber">
          <Icon name="signal" size={12} /> {s.progress.rescueIn > 0 ? `Rescue in ${s.progress.rescueIn}` : 'Rescue docked'}
        </span>
      )}
      {s.progress.selfDestruct && (
        <span className="chip red">
          <Icon name="fire" size={12} /> Overload armed
        </span>
      )}
    </div>
  );
}

export function Threats({ s }: { s: GameState }) {
  const seen = visibleCreatures(s);
  if (!seen.length) return null;
  const sorted = seen.slice().sort((a, b) => Number(b.room === s.player.room) - Number(a.room === s.player.room));
  return (
    <div className="threats" aria-label="Threats">
      {sorted.map((c) => {
        const plan = planCreature(s, c);
        const here = c.room === s.player.room;
        return (
          <div key={c.id} className={`threat ${here ? 'here' : ''} ${plan.kind}`}>
            <span className="dot" />
            <span className="what">
              {describePlan(s, plan)}
              {!here && <span className="far"> · {s.rooms[c.room]!.known ? roomName(s, c.room) : 'unexplored room'}</span>}
            </span>
            <span className="hp">
              {c.hp}/{CREATURES[c.kind].hp}
            </span>
          </div>
        );
      })}
    </div>
  );
}
