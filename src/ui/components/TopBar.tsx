import type { GameState } from '../../game/types';
import { Icon } from '../art/Icon';

export function TopBar({ s, onMenu }: { s: GameState; onMenu: () => void }) {
  const p = s.player;
  const hot = p.stress >= p.maxStress - 2;
  const low = s.clock <= 4;
  return (
    <header className="topbar">
      <div className="vital" aria-label={`Health ${p.hp} of ${p.maxHp}`}>
        <span className="eyebrow">Health</span>
        <span className="hearts">
          {Array.from({ length: p.maxHp }, (_, i) => (
            <Icon key={i} name="hp" size={16} className={i < p.hp ? 'full' : 'empty'} />
          ))}
        </span>
      </div>
      <div className="vital" aria-label={`Stress ${p.stress} of ${p.maxStress}`}>
        <span className="eyebrow">Stress</span>
        <span className={`stressbar ${hot ? 'hot' : ''}`}>
          {Array.from({ length: p.maxStress }, (_, i) => (
            <b key={i} className={i < p.stress ? 'on' : ''} />
          ))}
        </span>
      </div>
      <div className={`clock ${low ? 'low' : ''}`} aria-label={`${s.scenario.clockKind} ${s.clock} rounds`}>
        <small>{s.scenario.clockKind}</small>
        <b>
          {s.clock} <small>rounds</small>
        </b>
      </div>
      <button className="icon-btn" onClick={onMenu} aria-label="Menu">
        <Icon name="menu" />
      </button>
    </header>
  );
}
