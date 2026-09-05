import { cardCost, cardOf, isInfection, isSpent } from '../../engine';
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
      {state.player.hand.length === 0 ? (
        <div className="card ghost">NOTHING AT HAND</div>
      ) : null}
      {state.player.hand.map((uid) => {
        const c = cardOf(uid);
        const spent = isSpent(state, uid);
        const classes = [
          'card',
          selected === uid ? 'selected' : '',
          isInfection(uid) ? 'panic' : '',
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
              {isInfection(uid)
                ? 'IN YOUR BLOOD · THE MEDBAY CUTS IT OUT'
                : `${cardCost(state, uid) === 0 ? 'FREE THIS HOUR' : `TIME ${cardCost(state, uid)}`} · ${
                    c.noise === 0 ? 'SILENT' : `HEARD ${c.noise} AWAY`
                  }`}
              {c.burn ? ' · ONE USE' : ''}
              {spent ? ' · EMPTY' : ''}
            </span>
          </button>
        );
      })}
    </div>
  );
}
