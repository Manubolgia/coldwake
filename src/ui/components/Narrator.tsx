import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { STAT_NAMES } from '../../game/content/roles';
import { sign, statParts } from '../../game/rules';
import type { GameState, StoryCard } from '../../game/types';
import { audio } from '../audio';
import type { NarrLine } from '../narration';
import { DieFace } from './Die';
import { Typed } from './Typed';

const KIND_LABEL: Record<StoryCard['kind'], string> = {
  intro: 'You wake',
  discovery: 'A new room',
  encounter: 'Encounter',
  event: 'The ship',
  clue: 'Log recovered',
  truth: 'The truth',
  panic: 'Panic',
  survivor: 'Survivor',
  result: 'What happens',
  companion: 'Companion',
  info: 'Notice',
};

const BAND = { clean: 'Clean', cost: 'Cost', fail: 'Fail' } as const;

function odds(bonus: number): string {
  const clean = 6 - bonus;
  const cost = 4 - bonus;
  if (clean <= 1) return 'always clean';
  if (clean > 6 && cost > 6) return 'will fail';
  if (clean > 6) return `can’t be clean · cost on ${Math.max(1, cost)}+`;
  return `clean on ${clean}+${cost > 1 ? ` · cost on ${cost}–${clean - 1}` : ` · otherwise cost`}`;
}

interface Pace {
  cps: number;
  pause: number;
}

export function Narrator({
  s,
  lines,
  shown,
  busy,
  onSkip,
  onLineDone,
  card,
  pace,
  onChoose,
  onContinue,
}: {
  s: GameState;
  lines: NarrLine[];
  shown: number;
  busy: boolean;
  onSkip: () => void;
  onLineDone: (id: number) => void;
  card: StoryCard | null;
  pace: Pace;
  onChoose: (i: number) => void;
  onContinue: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const showCard = !!card && !busy;

  // Keep the line being written in view.
  useLayoutEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [shown, lines.length, showCard]);

  if (showCard) {
    return (
      <section className={`narrator card-mode t-${card.tone}`} data-testid="narrator" aria-live="polite">
        <CardView key={card.uid} s={s} card={card} pace={pace} onChoose={onChoose} onContinue={onContinue} />
      </section>
    );
  }

  const visible = lines.slice(0, Math.min(lines.length, shown + 1));
  return (
    <section
      className={`narrator lines-mode ${busy ? 'speaking' : 'resting'}`}
      data-testid="narrator"
      aria-live="polite"
      onClick={busy ? onSkip : undefined}
    >
      <div className="narr-scroll" ref={box}>
        {visible.map((l, i) => {
          const old = i < visible.length - 3;
          return (
            <p key={l.id} className={`line ${l.tone ? `t-${l.tone}` : ''} ${l.dm ? 'dm' : ''} ${old ? 'old' : ''}`}>
              {l.head && <span className="dm-head">{l.head}</span>}
              {i < shown ? l.text : <Typed text={l.text} cps={pace.cps} pause={pace.pause} onDone={() => onLineDone(l.id)} />}
            </p>
          );
        })}
      </div>
      {busy && (
        <span className="narr-hint" aria-hidden="true">
          tap to skip
        </span>
      )}
    </section>
  );
}

function CardView({ s, card, pace, onChoose, onContinue }: { s: GameState; card: StoryCard; pace: Pace; onChoose: (i: number) => void; onContinue: () => void }) {
  const [landed, setLanded] = useState(!card.roll);
  const [typed, setTyped] = useState(false);
  const [hurry, setHurry] = useState(false);
  const first = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (typed) first.current?.focus({ preventScroll: true });
  }, [typed]);

  return (
    <div className="card-view" onClick={!typed ? () => (landed ? setHurry(true) : undefined) : undefined}>
      <div className="kind">
        <span className="eyebrow">{KIND_LABEL[card.kind]}</span>
        <span className="eyebrow">Round {s.round}</span>
      </div>
      <h2 id={`card-${card.uid}`}>{card.title}</h2>
      {card.roll && <RollBox roll={card.roll} fast={!Number.isFinite(pace.cps)} onLanded={() => setLanded(true)} />}
      <p className="text">{landed ? <Typed text={card.text} cps={pace.cps} pause={pace.pause} done={hurry} onDone={() => setTyped(true)} /> : <span className="unwritten">{card.text}</span>}</p>
      <div className={`choices ${typed ? 'in' : ''}`}>
        {typed &&
          (card.choices.length ? (
            card.choices.map((ch, i) => {
              const bonus = ch.stat ? statParts(s, ch.stat).total + (ch.mod ?? 0) : 0;
              return (
                <button key={i} ref={i === 0 ? first : undefined} className="choice" onClick={() => onChoose(i)} style={{ animationDelay: `${i * 90}ms` }}>
                  <b>{ch.label}</b>
                  {ch.stat ? (
                    <small>
                      <em>
                        {STAT_NAMES[ch.stat]} {sign(bonus)}
                      </em>{' '}
                      · roll a die · {odds(bonus)}
                    </small>
                  ) : (
                    <small>{ch.hint ?? 'No roll'}</small>
                  )}
                </button>
              );
            })
          ) : (
            <button ref={first} className="btn primary wide" onClick={onContinue} data-testid="continue">
              Continue
            </button>
          ))}
        {!typed && (
          <span className="narr-hint static" aria-hidden="true">
            tap to skip
          </span>
        )}
      </div>
    </div>
  );
}

function RollBox({ roll, fast, onLanded }: { roll: NonNullable<StoryCard['roll']>; fast: boolean; onLanded: () => void }) {
  const [face, setFace] = useState(fast ? roll.die : 1 + Math.floor(Math.random() * 6));
  const [landed, setLanded] = useState(fast);
  const cb = useRef(onLanded);
  cb.current = onLanded;
  useEffect(() => {
    if (fast) {
      cb.current();
      return;
    }
    const tumble = window.setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 85);
    const stop = window.setTimeout(() => {
      window.clearInterval(tumble);
      setFace(roll.die);
      setLanded(true);
      audio.play(roll.band === 'clean' ? 'clean' : roll.band === 'cost' ? 'cost' : 'fail');
      window.setTimeout(() => cb.current(), 450);
    }, 1000);
    audio.play('die');
    return () => {
      window.clearInterval(tumble);
      window.clearTimeout(stop);
    };
  }, [fast, roll]);
  return (
    <div className={`rollbox ${landed ? 'landed' : 'tumbling'}`} aria-label={`Rolled ${roll.die}, total ${roll.total}, ${roll.band}`}>
      <DieFace value={face} className={landed ? 'landed' : 'tumble'} />
      <span className="eq">
        {landed ? roll.die : '?'} {sign(roll.bonus)} {STAT_NAMES[roll.stat]} = <b>{landed ? roll.total : '?'}</b>
      </span>
      {landed && <span className={`band stamp ${roll.band}`}>{BAND[roll.band]}</span>}
    </div>
  );
}
