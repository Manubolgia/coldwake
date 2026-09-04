import { cardOf, isPanic, isSpent } from '../../engine';
import type { GameState, Uid } from '../../engine/types';

export function Hand({
  state,
  selected,
  onSelect,
}: {
  state: GameState;
  selected: Uid | null;
  onSelect: (uid: Uid | null) => void;
}): React.ReactElement {
  return (
    <div className="hand" data-testid="hand">
      {state.player.hand.length === 0 ? <div className="card ghost">EMPTY</div> : null}
      {state.player.hand.map((uid) => {
        const c = cardOf(uid);
        const spent = isSpent(state, uid);
        const classes = [
          'card',
          selected === uid ? 'selected' : '',
          isPanic(uid) ? 'panic' : '',
          spent ? 'spent' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={uid}
            className={classes}
            data-card={c.id}
            onClick={() => onSelect(selected === uid ? null : uid)}
          >
            <span className="name glow">{c.name}</span>
            <span className="body">{c.text}</span>
            <span className="foot">
              AP {c.ap} · N{c.noise}
              {c.burn ? ' · BURN' : ''}
              {spent ? ' · SPENT' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
