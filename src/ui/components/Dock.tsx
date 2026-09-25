import { hearingRadius } from '../../game/actions';
import type { GameState } from '../../game/types';
import { Icon } from '../art/Icon';
import { DieFace } from './Die';

export function Dock({
  s,
  selected,
  onSelect,
  onEnd,
  onSheet,
  rolling,
}: {
  s: GameState;
  selected: number | null;
  onSelect: (id: number) => void;
  onEnd: () => void;
  onSheet: (tab: 'goals' | 'you' | 'journal') => void;
  rolling: boolean;
}) {
  const unused = s.dice.filter((d) => !d.used).length;
  const radius = hearingRadius(s);
  const calm = Math.min(unused, s.player.stress);
  return (
    <footer className="dock">
      <div className="dicerow">
        <div className="dice" role="group" aria-label="Your dice this round">
          {s.dice.map((d) => (
            <DieFace
              key={`${s.round}-${d.id}`}
              value={d.value}
              className={`${d.source} ${d.used ? 'used' : ''} ${selected === d.id && !d.used ? 'sel' : ''} ${rolling && !d.used ? 'rolling' : ''}`}
              onClick={d.used ? undefined : () => onSelect(d.id)}
              label={`${d.used ? 'Used die' : 'Die'} showing ${d.value}${d.source === 'companion' ? ' from your companion' : d.source === 'stim' ? ' from a stim' : ''}`}
            />
          ))}
        </div>
        <div className={`noise-meter ${radius > 0 ? 'loud' : ''}`} aria-label={`Noise ${s.noise}`}>
          <b>
            <Icon name="noise" size={14} /> {radius === 0 ? 'Silent' : `Heard ${radius} room${radius > 1 ? 's' : ''} away`}
          </b>
          <span className="noise-bars">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={s.noise >= i ? 'on' : ''} />
            ))}
          </span>
        </div>
      </div>
      <div className="dockrow">
        <button className="btn tabbtn" onClick={() => onSheet('goals')} aria-label="Goals">
          <Icon name="goals" />
          Goals
        </button>
        <button className="btn tabbtn" onClick={() => onSheet('you')} aria-label="You and your kit">
          <Icon name="you" />
          You
        </button>
        <button className="btn tabbtn" onClick={() => onSheet('journal')} aria-label="Journal">
          <Icon name="journal" />
          Log
        </button>
        <button className={`btn end ${unused === 0 ? 'primary' : ''}`} onClick={onEnd} data-testid="end-round">
          End round
          <small>{unused === 0 ? 'The ship moves' : calm > 0 ? `${unused} unused: −${calm} stress` : `${unused} ${unused > 1 ? 'dice' : 'die'} unused`}</small>
        </button>
      </div>
    </footer>
  );
}
