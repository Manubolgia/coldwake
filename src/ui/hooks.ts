import { useEffect, useRef, useState } from 'react';
import type { DisplayLine } from './guidance';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = (): void => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

/**
 * The terminal writes rather than prints. Ordinary lines run out quickly;
 * anything the ship is alarmed about is typed one character at a time, with a
 * beat before it, because that pause is where the tension lives.
 */
export type TypedFeed = {
  /** Lines fully written. */
  done: number;
  /** Characters written of the line currently being typed. */
  chars: number;
  complete: boolean;
  skip: () => void;
};

/**
 * Written at reading pace, not at machine pace. Holding the screen multiplies
 * all of it, so an impatient player is never made to wait and a new one is
 * never outrun.
 */
const SPEED = {
  normal: { tick: 18, step: 1, gap: 150 },
  loud: { tick: 28, step: 1, gap: 320 },
  guide: { tick: 16, step: 1, gap: 260 },
};
const HELD = 6;

const isLoud = (line: DisplayLine | undefined): boolean =>
  line?.kind === 'alarm' || line?.kind === 'threat';

export function useTypedFeed(lines: DisplayLine[], instant: boolean, fast = false): TypedFeed {
  const [done, setDone] = useState(lines.length);
  const [chars, setChars] = useState(0);
  const previousLength = useRef(lines.length);

  // A new run rewinds the terminal rather than replaying the old one.
  if (lines.length < previousLength.current) {
    previousLength.current = lines.length;
    if (done > lines.length) {
      setDone(lines.length);
      setChars(0);
    }
  }
  previousLength.current = lines.length;

  useEffect(() => {
    if (instant) {
      if (done !== lines.length || chars !== 0) {
        setDone(lines.length);
        setChars(0);
      }
      return;
    }
    if (done >= lines.length) return;
    const line = lines[done];
    if (!line) return;
    const base = line.kind === 'guide' ? SPEED.guide : isLoud(line) ? SPEED.loud : SPEED.normal;
    const speed = fast
      ? { tick: Math.max(4, Math.round(base.tick / HELD)), step: base.step * 3, gap: 20 }
      : base;
    const length = line.kind === 'guide' ? line.text.length + 3 : line.text.length;
    if (chars >= length) {
      const t = window.setTimeout(() => {
        setDone((d) => d + 1);
        setChars(0);
      }, speed.gap);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(
      () => setChars((c) => Math.min(c + speed.step, length)),
      chars === 0 && isLoud(line) ? speed.gap : speed.tick,
    );
    return () => window.clearTimeout(t);
  }, [lines, done, chars, instant, fast]);

  return {
    done,
    chars,
    complete: done >= lines.length,
    skip: () => {
      setDone(lines.length);
      setChars(0);
    },
  };
}

/** Inverse-video flash whenever a readout value changes. */
export function useFlash(value: number | string, instant: boolean): boolean {
  const [flashing, setFlashing] = useState(false);
  const previous = useRef(value);
  useEffect(() => {
    if (previous.current === value) return;
    previous.current = value;
    if (instant) return;
    setFlashing(true);
    const t = window.setTimeout(() => setFlashing(false), 320);
    return () => window.clearTimeout(t);
  }, [value, instant]);
  return flashing;
}

/** One line, written out. Used for the endings, which deserve a beat. */
export function useTypedText(text: string, instant: boolean, tick = 55): string {
  const [shown, setShown] = useState(instant ? text.length : 0);
  useEffect(() => {
    if (instant) {
      setShown(text.length);
      return;
    }
    if (shown >= text.length) return;
    const t = window.setTimeout(() => setShown((n) => n + 1), tick);
    return () => window.clearTimeout(t);
  }, [shown, text, instant, tick]);
  return text.slice(0, Math.min(shown, text.length));
}
