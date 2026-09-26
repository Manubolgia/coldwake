import type { GameState } from '../../game/types';
import { Icon } from '../art/Icon';
import type { SheetTab } from './Sheets';

export function Hud({ s, onSheet }: { s: GameState; onSheet: (t: SheetTab) => void }) {
  const p = s.player;
  const hot = p.stress >= p.maxStress - 2;
  const low = s.clock <= 4;
  return (
    <header className="hud">
      <div className="vitals">
        <span className="hearts" aria-label={`Health ${p.hp} of ${p.maxHp}`}>
          {Array.from({ length: p.maxHp }, (_, i) => (
            <Icon key={i} name="hp" size={15} className={i < p.hp ? 'full' : 'empty'} />
          ))}
        </span>
        <span className={`stressbar ${hot ? 'hot' : ''}`} aria-label={`Stress ${p.stress} of ${p.maxStress}`}>
          {Array.from({ length: p.maxStress }, (_, i) => (
            <b key={i} className={i < p.stress ? 'on' : ''} />
          ))}
        </span>
      </div>
      <div className={`clock ${low ? 'low' : ''}`} aria-label={`${s.scenario.clockKind} ${s.clock} rounds`}>
        <small>{s.scenario.clockKind}</small>
        <b>
          {s.clock}
          <i> rounds</i>
        </b>
      </div>
      <nav className="hud-btns" aria-label="Details">
        <button className="hud-btn" onClick={() => onSheet('goals')} aria-label="Goals">
          <Icon name="goals" size={19} />
          <span>Goals</span>
        </button>
        <button className="hud-btn" onClick={() => onSheet('you')} aria-label="You and your kit">
          <Icon name="you" size={19} />
          <span>You</span>
        </button>
        <button className="hud-btn" onClick={() => onSheet('journal')} aria-label="Journal">
          <Icon name="journal" size={19} />
          <span>Log</span>
        </button>
        <button className="hud-btn" onClick={() => onSheet('menu')} aria-label="Menu">
          <Icon name="menu" size={19} />
          <span>Menu</span>
        </button>
      </nav>
    </header>
  );
}
