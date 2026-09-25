import { describePlan, hearingRadius, planCreature, visibleCreatures } from '../../game/actions';
import { CREATURES } from '../../game/content/creatures';
import { roomName } from '../../game/rules';
import type { GameState } from '../../game/types';
import { Art } from '../art/Art';
import { Icon } from '../art/Icon';

export function RoomPanel({ s }: { s: GameState }) {
  const r = s.rooms[s.player.room]!;
  const lines = s.log.slice(-3);
  return (
    <section className="roompanel" aria-label="Where you are">
      <Art art={r.type} className="art" />
      <div className="overlay">
        <span className="eyebrow">You are in</span>
        <h2>{roomName(s, r.id)}</h2>
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
      </div>
      <div className="narration" aria-live="polite">
        {lines.map((l, i) => (
          <p key={s.log.length - lines.length + i} className={`${i === lines.length - 1 ? 'latest' : ''} ${l.tone ? `t-${l.tone}` : ''}`}>
            {l.text}
          </p>
        ))}
      </div>
    </section>
  );
}

export function Threats({ s, className = '' }: { s: GameState; className?: string }) {
  const seen = visibleCreatures(s);
  const radius = hearingRadius(s);
  if (!seen.length) {
    return (
      <div className={`threats ${className}`}>
        <div className="threat calm">
          <span className="dot" />
          <span>
            {radius > 0
              ? `Nothing in sight. Your noise carries ${radius} room${radius > 1 ? 's' : ''} — anything in the red rooms will come.`
              : 'Nothing you can see is moving. Stay quiet and it stays that way.'}
          </span>
        </div>
      </div>
    );
  }
  const sorted = seen.slice().sort((a, b) => Number(b.room === s.player.room) - Number(a.room === s.player.room));
  return (
    <div className={`threats ${className}`} aria-label="Threats">
      {sorted.map((c) => {
        const plan = planCreature(s, c);
        const here = c.room === s.player.room;
        return (
          <div key={c.id} className={`threat ${here ? 'here' : ''}`}>
            <span className="dot" />
            <span>
              {describePlan(s, plan)}
              {!here && <span style={{ color: 'var(--muted)' }}> · {s.rooms[c.room]!.known ? roomName(s, c.room) : 'unexplored room'}</span>}
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
