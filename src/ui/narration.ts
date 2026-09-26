import { useEffect, useRef, useState } from 'react';
import { planCreature, visibleCreatures, describePlan } from '../game/actions';
import type { GameState, LogEntry } from '../game/types';
import type { TextSpeed } from './persistence';

// The narrator. Everything the engine writes to the log is read out in the
// middle of the screen, one line at a time, at a pace you can follow — the
// way a game master tells you what just happened before asking what you do
// next. Story cards wait until the narrator has finished speaking.

export type Tone = NonNullable<LogEntry['tone']>;

export interface NarrLine {
  id: number;
  text: string;
  tone?: Tone;
  /** Table talk from the narrator (round openings), not prose from the ship. */
  dm?: boolean;
  head?: string;
}

/** Characters per second, and how long the narrator lingers on punctuation. */
export const PACE: Record<TextSpeed, { cps: number; pause: number; gap: number }> = {
  slow: { cps: 22, pause: 1.4, gap: 900 },
  normal: { cps: 34, pause: 1, gap: 650 },
  fast: { cps: 70, pause: 0.45, gap: 300 },
  instant: { cps: Infinity, pause: 0, gap: 0 },
};

/** When each character of `text` appears, in ms from the start. */
export function schedule(text: string, cps: number, pause: number): number[] {
  const out: number[] = [];
  const per = 1000 / cps;
  let t = 0;
  for (let i = 0; i < text.length; i++) {
    t += per;
    out.push(t);
    const ch = text[i]!;
    const next = text[i + 1];
    if ((ch === '.' || ch === '!' || ch === '?') && (next === ' ' || next === undefined || next === '”')) t += 340 * pause;
    else if (ch === '…') t += 420 * pause;
    else if (ch === '—') t += 200 * pause;
    else if ((ch === ',' || ch === ';' || ch === ':') && next === ' ') t += 120 * pause;
  }
  return out;
}

function list(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** The narrator opens each round by telling you where you stand. */
export function roundLine(s: GameState, id: number): NarrLine {
  const parts: string[] = [];
  const seen = visibleCreatures(s);
  if (seen.length) {
    for (const c of seen.slice(0, 2)) parts.push(`${describePlan(s, planCreature(s, c))}.`);
    if (seen.length > 2) parts.push(`${seen.length - 2} more ${seen.length - 2 > 1 ? 'are' : 'is'} out there.`);
  } else {
    const calm = ['Nothing is moving that you can see.', 'The corridors are quiet. For now.', 'You hear nothing but the ship.', 'Nothing stirs nearby.'];
    parts.push(calm[s.round % calm.length]!);
  }
  const dice = s.dice.map((d) => String(d.value));
  parts.push(`The dice come up ${list(dice)}.`);
  return {
    id,
    head: `Round ${s.round} · ${s.scenario.clockKind} ${s.clock}`,
    text: parts.join(' '),
    tone: seen.some((c) => c.room === s.player.room) ? 'danger' : seen.length ? 'tense' : 'calm',
    dm: true,
  };
}

interface Narr {
  batch: NarrLine[];
  /** Lines fully written. The one after them is being written now. */
  shown: number;
}

export function useNarration(s: GameState, speed: TextSpeed) {
  const fresh = s.round === 1 && s.log.length <= 1 && s.cards.some((c) => c.kind === 'intro');
  const seen = useRef(fresh ? 0 : s.log.length);
  const lastRound = useRef(s.round);
  const pendingRound = useRef(fresh);
  const nextId = useRef(1);
  const [n, setN] = useState<Narr>(() => {
    if (fresh) return { batch: [], shown: 0 };
    // Coming back to a run: the last few things that happened, already told.
    const recent = s.log.filter((l) => l.round === s.round).slice(-3);
    const batch = (recent.length ? recent : s.log.slice(-1)).map((l) => ({ id: nextId.current++, text: l.text, tone: l.tone }));
    return { batch, shown: batch.length };
  });

  useEffect(() => {
    const added = s.log.slice(seen.current);
    seen.current = s.log.length;
    const cardTexts = new Set(s.cards.map((c) => c.text));
    const lines: NarrLine[] = added.filter((l) => !cardTexts.has(l.text)).map((l) => ({ id: nextId.current++, text: l.text, tone: l.tone }));
    if (s.round !== lastRound.current) {
      lastRound.current = s.round;
      pendingRound.current = true;
    }
    if (pendingRound.current && !s.cards.length && s.status === 'playing') {
      pendingRound.current = false;
      lines.push(roundLine(s, nextId.current++));
    }
    if (!lines.length) return;
    setN((prev) => (prev.shown < prev.batch.length ? { batch: [...prev.batch, ...lines], shown: prev.shown } : { batch: lines, shown: 0 }));
  }, [s]);

  const busy = n.shown < n.batch.length;
  const gap = PACE[speed].gap;
  const lineDone = (id: number) => {
    window.setTimeout(() => {
      setN((prev) => {
        const i = prev.batch.findIndex((l) => l.id === id);
        return i === prev.shown ? { ...prev, shown: i + 1 } : prev;
      });
    }, gap);
  };

  return {
    lines: n.batch,
    shown: n.shown,
    busy,
    /** Tap while the narrator is speaking: say the rest at once. */
    skip: () => {
      if (busy) setN((prev) => ({ ...prev, shown: prev.batch.length }));
    },
    lineDone,
  };
}
