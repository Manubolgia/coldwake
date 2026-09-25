import { STAT_NAMES } from '../../game/content/roles';
import type { ActionOption } from '../../game/types';
import { Icon } from '../art/Icon';

const GROUPS: { id: ActionOption['group']; title: string }[] = [
  { id: 'danger', title: 'Danger' },
  { id: 'goal', title: 'Objectives' },
  { id: 'room', title: 'Here' },
  { id: 'kit', title: 'Your kit' },
  { id: 'move', title: 'Move' },
];

const BAND_LABEL = { clean: 'Clean', cost: 'Cost', fail: 'Fail' } as const;

export function keyOf(o: ActionOption): string {
  return `${o.id}|${o.target ?? ''}`;
}

export function Actions({
  options,
  die,
  onAct,
  flashKey,
}: {
  options: ActionOption[];
  die: number | null;
  onAct: (o: ActionOption) => void;
  flashKey: string | null;
}) {
  return (
    <div className="actions">
      {GROUPS.map((g) => {
        const list = options.filter((o) => o.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id} className={`group ${g.id}`} aria-label={g.title}>
            <div className="eyebrow">{g.title}</div>
            {list.map((o) => (
              <ActionRow key={keyOf(o)} o={o} die={die} onAct={onAct} flash={flashKey === keyOf(o)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

function ActionRow({ o, die, onAct, flash }: { o: ActionOption; die: number | null; onAct: (o: ActionOption) => void; flash: boolean }) {
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
