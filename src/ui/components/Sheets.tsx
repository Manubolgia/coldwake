import { ROOM_ACTIONS } from '../../game/content/actions';
import { CREATURES } from '../../game/content/creatures';
import { EXITS, PERSONALS } from '../../game/content/exits';
import { INCIDENTS } from '../../game/content/incidents';
import { INVENTORY_SIZE, ITEMS } from '../../game/content/items';
import { ROLES, STAT_DESC, STAT_NAMES, TRAITS } from '../../game/content/roles';
import { ROOMS } from '../../game/content/rooms';
import { act, cluesNeeded, creatureName, roomName, sign, statParts } from '../../game/rules';
import type { GameState, Stat } from '../../game/types';
import { Icon } from '../art/Icon';
import type { Settings } from '../persistence';

export type SheetTab = 'goals' | 'you' | 'journal' | 'menu';

export function Sheet({
  s,
  tab,
  onTab,
  onClose,
  onDrop,
  settings,
  onSettings,
  onHowTo,
  onQuit,
  onAbandon,
}: {
  s: GameState;
  tab: SheetTab;
  onTab: (t: SheetTab) => void;
  onClose: () => void;
  onDrop: (i: number) => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onHowTo: () => void;
  onQuit: () => void;
  onAbandon: () => void;
}) {
  return (
    <div className="backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Details">
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="tabs" role="tablist">
            {(
              [
                ['goals', 'Goals', 'goals'],
                ['you', 'You', 'you'],
                ['journal', 'Log', 'journal'],
                ['menu', 'Menu', 'menu'],
              ] as const
            ).map(([id, label, icon]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'sel' : ''} onClick={() => onTab(id)}>
                <Icon name={icon} size={16} />
                {label}
              </button>
            ))}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" />
          </button>
        </div>
        <div className="sheet-body">
          {tab === 'goals' && <Goals s={s} />}
          {tab === 'you' && <You s={s} onDrop={onDrop} />}
          {tab === 'journal' && <Journal s={s} />}
          {tab === 'menu' && <Menu settings={settings} onSettings={onSettings} onHowTo={onHowTo} onQuit={onQuit} onAbandon={onAbandon} />}
        </div>
      </div>
    </div>
  );
}

function whereIs(s: GameState, type: keyof typeof ROOMS): { text: string; cls: string } {
  const rooms = Object.values(s.rooms).filter((r) => r.type === type);
  if (rooms.some((r) => r.id === s.player.room)) return { text: 'You are here', cls: 'here' };
  if (rooms.some((r) => r.known)) return { text: `${ROOMS[type].name} — on the map`, cls: 'found' };
  return { text: `${ROOMS[type].name} — not found yet`, cls: '' };
}

export function Goals({ s }: { s: GameState }) {
  const inc = INCIDENTS[s.scenario.incident];
  const need = cluesNeeded(s);
  const p = PERSONALS[s.scenario.personal];
  const a = act(s);
  return (
    <>
      <div className="card">
        <span className="eyebrow">The {s.scenario.shipName} · {s.scenario.shipClass}</span>
        <h3>
          <Icon name="clock" /> {s.scenario.clockKind} {s.clock} rounds
        </h3>
        <p className="blurb">
          Act {a === 1 ? 'I' : a === 2 ? 'II' : 'III'} of III. When the clock runs out, you go down with the ship. Each act, more of them can be loose at once and the nest breeds faster.
        </p>
      </div>
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Two ways off the ship — finish either one
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {s.scenario.exits.map((e) => {
            const def = EXITS[e];
            const steps = s.progress.steps[e];
            return (
              <div className="card" key={e}>
                <h3>
                  <Icon name="launch" /> {def.name}
                </h3>
                <p className="blurb">{def.blurb}</p>
                <ul className="steps">
                  {def.steps.map((st, i) => {
                    const done = steps[i];
                    const w = whereIs(s, st.room);
                    const actionId = ROOM_ACTIONS.find((d) => d.step?.exit === e && d.step.step === i);
                    const work = actionId?.work ? s.progress.work[actionId.id] ?? 0 : 0;
                    let extra = '';
                    if (actionId?.work && !done && work > 0) extra = ` · progress ${work}/${actionId.work}`;
                    if (e === 'beacon' && i === 2 && s.progress.rescueIn !== null) extra = s.progress.rescueIn > 0 ? ` · docks in ${s.progress.rescueIn} rounds` : ' · docked now';
                    return (
                      <li key={i} className={done ? 'done' : ''}>
                        <span className="tick">{done && <Icon name="check" size={14} />}</span>
                        <span>
                          <span className="what">{st.label}</span>
                          <span className={`where ${done ? '' : w.cls}`}>
                            {e === 'shuttle' && i === 0 ? st.desc : w.text}
                            {extra}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <span className="eyebrow" style={{ color: 'var(--amber)' }}>
          Your secret
        </span>
        <h3>{p.name}</h3>
        <p className="blurb">{p.text}</p>
        <p style={{ fontSize: 13, color: s.progress.personalDone || personalProgress(s) ? 'var(--green)' : 'var(--muted)' }}>{personalStatus(s)}</p>
      </div>
      <div className="card">
        <span className="eyebrow" style={{ color: 'var(--violet)' }}>
          What happened here
        </span>
        <h3>{s.progress.truth ? `The truth: ${inc.truthTitle}` : `${Math.min(s.progress.clues.length, need)} of ${need} logs found`}</h3>
        <p className="blurb">
          {s.progress.truth
            ? inc.truth(ctxLite(s))
            : 'Logs are hidden around the ship — in rooms you haven’t entered, in recordings, in the lab. Piece together the truth and you learn how to fight back.'}
        </p>
        {s.progress.clues.map((i) => (
          <div className="log-entry" key={i}>
            <b>{inc.clues[i]!.who}</b>
            <p>{inc.clues[i]!.text}</p>
          </div>
        ))}
      </div>
      <Bestiary s={s} />
    </>
  );
}

function ctxLite(s: GameState) {
  return {
    ship: s.scenario.shipName,
    shipClass: s.scenario.shipClass,
    you: s.player.name,
    creature: INCIDENTS[s.scenario.incident].creature,
    brood: INCIDENTS[s.scenario.incident].brood_name,
    broods: INCIDENTS[s.scenario.incident].brood_plural,
    nest: INCIDENTS[s.scenario.incident].nestName,
    mate: s.companion?.name ?? 'nobody',
    mateThey: s.companion?.pronoun ?? 'they',
    room: roomName(s, s.player.room),
    clockKind: s.scenario.clockKind,
  };
}

function personalProgress(s: GameState): boolean {
  const has = (id: string) => s.player.items.some((i) => i.id === id);
  switch (s.scenario.personal) {
    case 'blackbox':
      return has('blackbox');
    case 'sample':
      return has('sample');
    case 'together':
      return !!s.companion;
    case 'sibling':
      return !!s.companion?.sibling;
    case 'burn':
      return s.progress.selfDestruct;
    default:
      return false;
  }
}

function personalStatus(s: GameState): string {
  if (s.progress.personalDone) return 'Done.';
  switch (s.scenario.personal) {
    case 'blackbox':
      return personalProgress(s) ? 'You have the recorder. Now get it off the ship.' : 'Not yet. The recorder is on the Bridge.';
    case 'sample':
      return personalProgress(s) ? 'You have the sample. Now get it off the ship.' : `Not yet. The sample is in the nest.`;
    case 'together':
      return personalProgress(s) ? `${s.companion!.name} is with you. Keep them alive.` : 'No one is with you yet. Survivors may be hiding in rooms you haven’t entered.';
    case 'sibling':
      return personalProgress(s) ? 'Your sibling is with you. Get them out.' : 'You haven’t found them yet. They are somewhere aboard, hiding.';
    case 'burn':
      return personalProgress(s) ? 'The overload is armed. Get off the ship.' : 'Needs the command codes (Bridge or Captain’s Quarters), then the Reactor.';
    case 'kill': {
      const inc = INCIDENTS[s.scenario.incident];
      return inc.primary !== inc.brood ? `Not yet. ${inc.creature} still lives.` : `${s.progress.kills} of 3 killed.`;
    }
    case 'truth':
      return `${s.progress.clues.length} of ${cluesNeeded(s)} logs found.`;
    case 'wipe':
      return 'Not yet. The records are in the Laboratory.';
  }
}

function Bestiary({ s }: { s: GameState }) {
  const seen = (Object.keys(CREATURES) as (keyof typeof CREATURES)[]).filter((k) => s.progress.flags.includes(`seen:${k}`));
  if (!seen.length) return null;
  return (
    <div className="card">
      <span className="eyebrow" style={{ color: 'var(--red)' }}>
        What you’ve seen
      </span>
      {seen.map((k) => {
        const d = CREATURES[k];
        return (
          <div key={k} style={{ display: 'grid', gap: 4 }}>
            <b style={{ fontFamily: 'var(--display)', letterSpacing: '0.04em' }}>{creatureName(s, k)}</b>
            <p className="blurb">{d.behaviour}</p>
            <p style={{ fontSize: 12.5, color: 'var(--soft)' }}>
              {d.hp} health · needs {d.guard}+ to hit cleanly · hits for {d.damage}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function You({ s, onDrop }: { s: GameState; onDrop: (i: number) => void }) {
  const p = s.player;
  const role = ROLES[p.role];
  return (
    <>
      <div className="card">
        <span className="eyebrow">{role.name}</span>
        <h3>{p.name}</h3>
        <p className="blurb">{role.tagline}</p>
        <p style={{ fontSize: 13.5, color: 'var(--cyan)' }}>
          <b>{role.perkName}.</b> {role.perk}
        </p>
      </div>
      <div className="stats4">
        {(['might', 'tech', 'wits', 'nerve'] as Stat[]).map((st) => {
          const sp = statParts(s, st);
          return (
            <div className="stat" key={st}>
              <span className="eyebrow">{STAT_NAMES[st]}</span>
              <b>{sign(sp.total)}</b>
              <small>{STAT_DESC[st]}</small>
              {sp.parts.length > 0 && <small style={{ color: 'var(--dim)' }}>{sp.parts.join(' · ')}</small>}
            </div>
          );
        })}
      </div>
      <div className="card">
        <dl className="kv">
          <dt>Health</dt>
          <dd>
            {p.hp} / {p.maxHp}
            {p.hp <= 2 ? ' — badly hurt: one fewer die' : ''}
          </dd>
          <dt>Stress</dt>
          <dd>
            {p.stress} / {p.maxStress} — you panic at {p.maxStress}
          </dd>
          <dt>Infection</dt>
          <dd>{p.infectionKnown ? (p.infected ? `Infected. Purge it at a Medbay or Lab.` : 'Clean, at the last scan.') : 'Unknown. A Medbay scan will tell you.'}</dd>
          {p.traits.length > 0 && (
            <>
              <dt>Traits</dt>
              <dd>
                {p.traits.map((t) => (
                  <div key={t} style={{ color: TRAITS[t].good ? 'var(--green)' : '#ffb3bb' }}>
                    {TRAITS[t].name} — {TRAITS[t].desc}
                  </div>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>
      {s.companion && (
        <div className="card">
          <span className="eyebrow" style={{ color: 'var(--green)' }}>
            With you
          </span>
          <h3>{s.companion.name}</h3>
          <p className="blurb">
            The {s.companion.job}. Adds a die every round, and +1 to {STAT_NAMES[s.companion.helps]} checks. Health {s.companion.hp}. Creatures that attack may go for {s.companion.pronoun === 'they' ? 'them' : s.companion.pronoun === 'she' ? 'her' : 'him'} instead of you.
          </p>
        </div>
      )}
      <div>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Kit — {p.items.length} of {INVENTORY_SIZE}
        </div>
        <div className="items">
          {p.items.map((it, i) => (
            <div className="item" key={`${it.id}-${i}`}>
              <span className="ic">
                <Icon name={ITEMS[it.id].kind === 'weapon' ? 'fight' : it.id in ICONS ? ICONS[it.id]! : 'box'} />
              </span>
              <span>
                <b>
                  {ITEMS[it.id].name}
                  {it.uses !== undefined && ITEMS[it.id].kind === 'weapon' ? ` · ${it.uses} left` : ''}
                </b>
                <small>{ITEMS[it.id].desc}</small>
              </span>
              {ITEMS[it.id].kind !== 'quest' && (
                <button className="drop" onClick={() => onDrop(i)}>
                  Drop
                </button>
              )}
            </div>
          ))}
          {!p.items.length && <p className="empty">Empty hands.</p>}
        </div>
      </div>
    </>
  );
}

const ICONS: Partial<Record<string, string>> = {
  medkit: 'medkit',
  stim: 'stim',
  sedative: 'sedative',
  flare: 'flare',
  emp: 'emp',
  foam: 'foam',
  toolkit: 'power',
  tracker: 'scan',
  flashlight: 'light',
  keycard: 'key',
  codes: 'key',
  fuelcell: 'power',
  blackbox: 'box',
  sample: 'sample',
};

function Journal({ s }: { s: GameState }) {
  const rounds: Record<number, typeof s.log> = {};
  for (const l of s.log) (rounds[l.round] ??= []).push(l);
  const order = Object.keys(rounds)
    .map(Number)
    .sort((a, b) => b - a);
  return (
    <>
      <div className="card">
        <span className="eyebrow">Your story so far</span>
        <ul className="beats">
          {s.beats.map((b, i) => (
            <li key={i}>
              <span>Round {b.round}</span>
              {b.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="journal">
        {order.map((r) => (
          <div className="round" key={r}>
            <span className="eyebrow">Round {r}</span>
            {rounds[r]!.map((l, i) => (
              <p key={i} className={l.tone ? `t-${l.tone}` : ''}>
                {l.text}
              </p>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

export function Menu({
  settings,
  onSettings,
  onHowTo,
  onQuit,
  onAbandon,
}: {
  settings: Settings;
  onSettings: (s: Settings) => void;
  onHowTo: () => void;
  onQuit: () => void;
  onAbandon: () => void;
}) {
  return (
    <>
      <div className="card">
        <div className="toggle-row">
          <span>Sound</span>
          <button className={`toggle ${settings.sound ? 'on' : ''}`} role="switch" aria-checked={settings.sound} aria-label="Sound" onClick={() => onSettings({ ...settings, sound: !settings.sound })} />
        </div>
        <div className="toggle-row">
          <span>Reduce motion</span>
          <button
            className={`toggle ${settings.reducedMotion ? 'on' : ''}`}
            role="switch"
            aria-checked={settings.reducedMotion}
            aria-label="Reduce motion"
            onClick={() => onSettings({ ...settings, reducedMotion: !settings.reducedMotion })}
          />
        </div>
        <div className="toggle-row">
          <span>Text size</span>
          <div className="segmented" style={{ width: 210 }}>
            {(['small', 'medium', 'large'] as const).map((t) => (
              <button key={t} className={settings.textSize === t ? 'sel' : ''} onClick={() => onSettings({ ...settings, textSize: t })} style={{ textAlign: 'center' }}>
                <b style={{ fontSize: t === 'small' ? 12 : t === 'medium' ? 14 : 16 }}>Aa</b>
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="btn wide" onClick={onHowTo}>
        <Icon name="info" /> How to play
      </button>
      <button className="btn wide" onClick={onQuit}>
        Save and quit to title
      </button>
      <button className="btn wide danger" onClick={onAbandon}>
        Abandon this run
      </button>
    </>
  );
}
