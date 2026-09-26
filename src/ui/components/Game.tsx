import { useEffect, useMemo, useRef, useState } from 'react';
import { getActions } from '../../game/engine';
import type { Action, ActionOption, GameState } from '../../game/types';
import { PACE, useNarration } from '../narration';
import type { Settings } from '../persistence';
import { Coach } from './Coach';
import { Deck, type Tab } from './Deck';
import { Hud } from './Hud';
import { MapOverlay, MapPanel } from './MapOverlay';
import { Narrator } from './Narrator';
import { Sheet, type SheetTab } from './Sheets';
import { Stage } from './Stage';

function useWide(): boolean {
  const q = '(min-width: 900px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return wide;
}

export function Game({
  s,
  dispatch,
  onDrop,
  settings,
  onSettings,
  onHowTo,
  onQuit,
  onAbandon,
  showTips,
  onTipsDone,
  hurt,
  onSettled,
}: {
  s: GameState;
  dispatch: (a: Action) => void;
  onDrop: (i: number) => void;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onHowTo: () => void;
  onQuit: () => void;
  onAbandon: () => void;
  showTips: boolean;
  onTipsDone: () => void;
  hurt: number;
  /** The run is over and the narrator has said its last line. */
  onSettled: () => void;
}) {
  const options = useMemo(() => getActions(s), [s]);
  const unused = s.dice.filter((d) => !d.used);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  const [map, setMap] = useState(false);
  const [tab, setTab] = useState<Tab | null>('room');
  const [rolling, setRolling] = useState(false);
  const wide = useWide();

  const speed = settings.textSpeed ?? 'normal';
  const pace = PACE[speed];
  const narr = useNarration(s, speed);
  const card = s.cards[0] ?? null;
  const telling = card && !narr.busy ? card : null;
  const locked = narr.busy || !!card || s.status !== 'playing';

  // The run has ended: let the narrator finish the last moments, then move on.
  const over = s.status !== 'playing';
  const settled = useRef(onSettled);
  settled.current = onSettled;
  useEffect(() => {
    if (!over || narr.busy) return;
    const t = window.setTimeout(() => settled.current(), 1600);
    return () => window.clearTimeout(t);
  }, [over, narr.busy]);

  // Keep a sensible die selected: the one you picked, else the highest.
  const sel = selected !== null && unused.some((d) => d.id === selected) ? selected : unused.length ? unused.reduce((a, b) => (b.value > a.value ? b : a)).id : null;

  // Dice tumble in at the start of each round.
  useEffect(() => {
    setRolling(true);
    setSelected(null);
    const t = window.setTimeout(() => setRolling(false), 600);
    return () => window.clearTimeout(t);
  }, [s.round]);

  // Something just came into the room: put the ways to deal with it in front of you.
  const hasDanger = options.some((o) => o.group === 'danger');
  const hadDanger = useRef(hasDanger);
  useEffect(() => {
    if (hasDanger && !hadDanger.current) setTab('danger');
    hadDanger.current = hasDanger;
  }, [hasDanger]);

  const act = (o: ActionOption) => {
    if (locked) return;
    if (o.id === 'take') {
      dispatch({ type: 'act', id: o.id, target: o.target!, die: -1 });
      return;
    }
    if (sel === null) return;
    dispatch(o.target !== undefined ? { type: 'act', id: o.id, target: o.target, die: sel } : { type: 'act', id: o.id, die: sel });
  };

  const narrator = (
    <Narrator
      s={s}
      lines={narr.lines}
      shown={narr.shown}
      busy={narr.busy}
      onSkip={narr.skip}
      onLineDone={narr.lineDone}
      card={card}
      pace={pace}
      onChoose={(i) => dispatch({ type: 'choose', index: i })}
      onContinue={() => dispatch({ type: 'continue' })}
    />
  );

  const deck = (
    <Deck
      s={s}
      options={options}
      die={sel}
      onDie={setSelected}
      tab={tab}
      onTab={setTab}
      onAct={act}
      onEnd={() => !locked && dispatch({ type: 'endRound' })}
      locked={locked}
      rolling={rolling}
      pinned={wide}
      flashKey={null}
    />
  );

  // A hit shakes the screen. Animated in place: remounting would lose the narrator's place.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hurt || settings.reducedMotion) return;
    root.current?.animate(
      [
        { transform: 'translate(0, 0)' },
        { transform: 'translate(-6px, 2px)' },
        { transform: 'translate(5px, -3px)' },
        { transform: 'translate(-4px, 1px)' },
        { transform: 'translate(3px, 0)' },
        { transform: 'translate(0, 0)' },
      ],
      { duration: 450 },
    );
  }, [hurt, settings.reducedMotion]);

  return (
    <div className={`game ${wide ? 'wide' : 'narrow'} ${telling ? 'telling' : ''}`} ref={root}>
      <Hud s={s} onSheet={setSheet} />
      <Stage s={s} card={telling} onMap={() => setMap(true)} showMinimap={!wide}>
        {narrator}
      </Stage>
      {wide ? (
        <aside className="rail">
          <div className="railmap">
            <MapPanel s={s} options={options} die={sel} onAct={act} locked={locked} />
          </div>
          {deck}
        </aside>
      ) : (
        deck
      )}
      {showTips && !locked && !sheet && !map && <Coach onDone={onTipsDone} />}
      {map && !wide && <MapOverlay s={s} options={options} die={sel} onAct={act} onClose={() => setMap(false)} locked={locked} />}
      {sheet && (
        <Sheet
          s={s}
          tab={sheet}
          onTab={setSheet}
          onClose={() => setSheet(null)}
          onDrop={onDrop}
          settings={settings}
          onSettings={onSettings}
          onHowTo={onHowTo}
          onQuit={onQuit}
          onAbandon={onAbandon}
        />
      )}
      {hurt > 0 && <div className="hurt-flash" key={`f${hurt}`} />}
    </div>
  );
}
