import { useEffect, useMemo, useRef, useState } from 'react';
import { getActions } from '../../game/engine';
import type { Action, ActionOption, GameState } from '../../game/types';
import { Actions, keyOf } from './Actions';
import { Coach } from './Coach';
import { Dock } from './Dock';
import { RoomPanel, Threats } from './RoomPanel';
import { Goals, Sheet, type SheetTab } from './Sheets';
import { ShipMap } from './ShipMap';
import { StoryModal } from './StoryModal';
import { TopBar } from './TopBar';
import type { Settings } from '../persistence';

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
}) {
  const options = useMemo(() => getActions(s), [s]);
  const unused = s.dice.filter((d) => !d.used);
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<SheetTab | null>(null);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const card = s.cards[0];
  const wide = useWide();

  // Keep a sensible die selected: the one you picked, else the highest.
  const sel = selected !== null && unused.some((d) => d.id === selected) ? selected : unused.length ? unused.reduce((a, b) => (b.value > a.value ? b : a)).id : null;

  // Dice tumble in at the start of each round.
  useEffect(() => {
    setRolling(true);
    setSelected(null);
    const t = window.setTimeout(() => setRolling(false), 600);
    return () => window.clearTimeout(t);
  }, [s.round]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [s.player.room]);

  const act = (o: ActionOption) => {
    if (o.id === 'take') {
      dispatch({ type: 'act', id: o.id, target: o.target!, die: -1 });
      return;
    }
    if (sel === null) return;
    dispatch(o.target !== undefined ? { type: 'act', id: o.id, target: o.target, die: sel } : { type: 'act', id: o.id, die: sel });
  };

  const onRoom = (id: string) => {
    const opt = options.find((o) => (o.id === 'move' || o.id === 'force') && o.target === id);
    if (!opt) return;
    const k = keyOf(opt);
    setFlashKey(k);
    setHighlight(id);
    window.setTimeout(() => {
      setFlashKey(null);
      setHighlight(null);
    }, 1300);
    const el = scrollRef.current?.querySelector(`[data-action="${CSS.escape(k)}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return (
    <div className={`game ${hurt ? 'shake' : ''}`} key={hurt ? `h${hurt}` : undefined}>
      <TopBar s={s} onMenu={() => setSheet('menu')} />
      <div className="side">
        <div className="mapwrap">
          <div className="mapcard">
            <ShipMap s={s} onRoom={onRoom} highlight={highlight} />
            <div className="maplegend">
              <span>
                <i style={{ background: 'var(--cyan)' }} />
                You
              </span>
              <span>
                <i style={{ background: 'var(--red)' }} />
                Creature
              </span>
              <span>
                <i style={{ background: 'rgba(255,77,94,.35)', borderRadius: 2 }} />
                Can hear you
              </span>
              <span>
                <i style={{ background: 'var(--cyan)', transform: 'rotate(45deg)', borderRadius: 1 }} />
                Objective
              </span>
            </div>
          </div>
        </div>
        {wide && (
          <>
            <Threats s={s} />
            <div style={{ display: 'grid', gap: 12 }}>
              <Goals s={s} />
            </div>
          </>
        )}
      </div>
      <div className="scroll" ref={scrollRef}>
        <RoomPanel s={s} />
        {!wide && <Threats s={s} />}
        <Actions options={options} die={sel} onAct={act} flashKey={flashKey} />
      </div>
      <Dock
        s={s}
        selected={sel}
        onSelect={setSelected}
        onEnd={() => dispatch({ type: 'endRound' })}
        onSheet={(t) => setSheet(t)}
        rolling={rolling}
      />
      {showTips && !card && !sheet && <Coach onDone={onTipsDone} />}
      {card && <StoryModal s={s} card={card} onChoose={(i) => dispatch({ type: 'choose', index: i })} onContinue={() => dispatch({ type: 'continue' })} />}
      {sheet && !card && (
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
