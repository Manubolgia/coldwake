import { STAT_NAMES } from '../../game/content/roles';
import type { ActionOption } from '../../game/types';
import { Icon } from '../art/Icon';

export const GROUPS: { id: ActionOption['group']; title: string; short: string; icon: string }[] = [
  { id: 'danger', title: 'Danger', short: 'Danger', icon: 'fight' },
  { id: 'goal', title: 'Objectives', short: 'Goal', icon: 'goals' },
  { id: 'room', title: 'In this room', short: 'Here', icon: 'search' },
  { id: 'kit', title: 'Your kit', short: 'Kit', icon: 'box' },
  { id: 'move', title: 'Move on', short: 'Move', icon: 'move' },
];

const BAND_LABEL = { clean: 'Clean', cost: 'Cost', fail: 'Fail' } as const;

export function keyOf(o: ActionOption): string {
  return `${o.id}|${o.target ?? ''}`;
}

export function ActionRow({ o, die, onAct, flash }: { o: ActionOption; die: number | null; onAct: (o: ActionOption) => void; flash: boolean }) {
  const free = o.id === 'take';
  const out = die !== null ? o.outcomes[die] : undefined;
  const bandCls = !o.flat && !free && out ? `b-${out.band}` : '';
  return (
    <button
      type="button"
      className={`action ${bandCls} ${flash ? 'flash' : ''}`}
      disabled={!!o.disabled || (!free && !out)}
      onClick={() => onAct(o)}
      data-action={keyOf(o)}
    >
      <span className="ic">
        <Icon name={o.icon} />
      </span>
      <span className="body">
        <span className="label">{o.label}</span>
        {o.desc && <span className="desc">{o.desc}</span>}
        {(o.stat || o.noise > 0 || o.mods.length > 0) && (
          <span className="meta">
            {o.stat && <span>{STAT_NAMES[o.stat]} check</span>}
            {o.mods.length > 0 && <span>{o.mods.join(' · ')}</span>}
            {o.noise > 0 && (
              <span className="noise">
                <Icon name="noise" size={12} />
                {o.noise}
              </span>
            )}
          </span>
        )}
      </span>
      <span className="outcome">
        {o.disabled ? (
          <span className="band any">{o.disabled}</span>
        ) : free ? (
          <span className="band any">Free</span>
        ) : o.flat ? (
          <>
            <span className="band any">Any die</span>
            {out && <span className="sum">{out.summary}</span>}
          </>
        ) : out ? (
          <>
            <span className={`band ${out.band}`}>{BAND_LABEL[out.band]}</span>
            <span className="sum">{out.summary}</span>
          </>
        ) : null}
      </span>
    </button>
  );
}
