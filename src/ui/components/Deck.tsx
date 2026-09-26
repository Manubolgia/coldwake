import { hearingRadius } from '../../game/actions';
import type { ActionOption, GameState } from '../../game/types';
import { Icon } from '../art/Icon';
import { ActionRow, GROUPS, keyOf } from './Actions';
import { DieFace } from './Die';

export type Tab = ActionOption['group'];

/**
 * Everything you can do, folded into one strip along the bottom: this round's
 * dice, the kinds of thing you can do, and End round. Tapping a kind opens its
 * actions just above, so the list never pushes the story off the screen.
 */
export function Deck({
  s,
  options,
  die,
  onDie,
  tab,
  onTab,
  onAct,
  onEnd,
  locked,
  rolling,
  pinned,
  flashKey,
}: {
  s: GameState;
  options: ActionOption[];
  die: number | null;
  onDie: (id: number) => void;
  tab: Tab | null;
  onTab: (t: Tab | null) => void;
  onAct: (o: ActionOption) => void;
  onEnd: () => void;
  /** The narrator is speaking, or a card is waiting: hands off. */
  locked: boolean;
  rolling: boolean;
  /** Wide screens keep the list open. */
  pinned: boolean;
  flashKey: string | null;
}) {
  const unused = s.dice.filter((d) => !d.used).length;
  const radius = hearingRadius(s);
  const calm = Math.min(unused, s.player.stress);
  const groups = GROUPS.filter((g) => options.some((o) => o.group === g.id));
  const open = tab && groups.some((g) => g.id === tab) ? tab : pinned ? (groups[0]?.id ?? null) : null;
  const list = open ? options.filter((o) => o.group === open) : [];
  const g = GROUPS.find((x) => x.id === open);

  return (
    <footer className={`deck ${locked ? 'locked' : ''} ${pinned ? 'pinned' : ''}`}>
      {open && !locked && (
        <div className={`drawer g-${open}`} key={open} role="region" aria-label={g?.title}>
          <div className="drawer-head">
            <span className="eyebrow">{g?.title}</span>
            {!pinned && (
              <button className="drawer-x" onClick={() => onTab(null)} aria-label="Close actions">
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
          <div className="drawer-list">
            {list.map((o) => (
              <ActionRow key={keyOf(o)} o={o} die={die} onAct={onAct} flash={flashKey === keyOf(o)} />
            ))}
          </div>
        </div>
      )}
      <div className="deck-tabs" role="tablist" aria-label="What you can do">
        {groups.map((x) => {
          const n = options.filter((o) => o.group === x.id && !o.disabled).length;
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={open === x.id}
              className={`tab g-${x.id} ${open === x.id ? 'sel' : ''}`}
              data-group={x.id}
              disabled={locked}
              onClick={() => onTab(open === x.id && !pinned ? null : x.id)}
            >
              <Icon name={x.icon} size={18} />
              <span>{x.short}</span>
              {n > 0 && <i className="count">{n}</i>}
            </button>
          );
        })}
      </div>
      <div className="dicerow">
        <div className="dice" role="group" aria-label="Your dice this round">
          {s.dice.map((d) => (
            <DieFace
              key={`${s.round}-${d.id}`}
              value={d.value}
              className={`${d.source} ${d.used ? 'used' : ''} ${die === d.id && !d.used ? 'sel' : ''} ${rolling && !d.used ? 'rolling' : ''}`}
              onClick={d.used ? undefined : () => onDie(d.id)}
              label={`${d.used ? 'Used die' : 'Die'} showing ${d.value}${d.source === 'companion' ? ' from your companion' : d.source === 'stim' ? ' from a stim' : ''}`}
            />
          ))}
        </div>
        <div className={`noise-meter ${radius > 0 ? 'loud' : ''}`} aria-label={`Noise ${s.noise}`}>
          <span className="noise-bars">
            {[1, 2, 3, 4].map((i) => (
              <i key={i} className={s.noise >= i ? 'on' : ''} />
            ))}
          </span>
          <b>
            <Icon name="noise" size={12} /> {radius === 0 ? 'Silent' : `Heard ${radius} away`}
          </b>
        </div>
        <button className={`btn end ${unused === 0 ? 'primary' : ''}`} onClick={onEnd} disabled={locked} data-testid="end-round">
          End round
          <small>{unused === 0 ? 'The ship moves' : calm > 0 ? `−${calm} stress` : `${unused} unused`}</small>
        </button>
      </div>
    </footer>
  );
}
