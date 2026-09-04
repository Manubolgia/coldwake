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
 * Rhythm, not speed. A line is typed quickly; what makes it land is where it
 * stops — a beat before bad news arrives, a breath at every full stop, and a
 * longer silence after something that matters. The blinking cursor sitting
 * alone through a pre-pause is the tension: you can see the ship deciding how
 * to tell you.
 */
type Beat = {
  /** Milliseconds a character takes. */
  tick: number;
  /** Before the line begins — the cursor waits here. */
  pre: number;
  /** After a comma, a semicolon or a dash. */
  clause: number;
  /** After a full stop, a question mark, an exclamation. */
  sentence: number;
  /** After the line is finished, before the next one starts. */
  gap: number;
};

const BEATS: Record<string, Beat> = {
  sys: { tick: 12, pre: 70, clause: 80, sentence: 180, gap: 120 },
  player: { tick: 12, pre: 70, clause: 80, sentence: 180, gap: 120 },
  threat: { tick: 15, pre: 400, clause: 110, sentence: 280, gap: 220 },
  alarm: { tick: 16, pre: 520, clause: 120, sentence: 320, gap: 260 },
  // Teaching, not tension: brisk enough to read along with.
  guide: { tick: 8, pre: 180, clause: 60, sentence: 150, gap: 150 },
};

/**
 * The first blow lands slowly; the ones behind it tumble out. Repeating the
 * full dramatic pause on every line of a bad hour turns tension into waiting.
 */
function soften(beat: Beat): Beat {
  return { ...beat, pre: Math.round(beat.pre * 0.35), sentence: Math.round(beat.sentence * 0.6) };
}

const HELD = 6;

function beatFor(line: DisplayLine | undefined): Beat {
  return BEATS[line?.kind ?? 'sys'] ?? (BEATS.sys as Beat);
}

const LEAD = '. . . ';
const MARKER = '>> ';
const LEAD_TICK = 120;

/**
 * What a line looks like on screen. Advisories are marked; the first bad news
 * of an hour is preceded by three slow dots — the ship taking a breath before
 * it tells you. Follow-up lines skip the dots, or the device wears out.
 */
export function displayText(line: DisplayLine, previous: DisplayLine | undefined): string {
  if (line.kind === 'guide') return `:: ${line.text}`;
  const grave = line.kind === 'alarm' || line.kind === 'threat';
  if (!grave || previous?.kind === line.kind) return line.text;
  // The dots go inside the marker, not in front of it.
  return line.text.startsWith(MARKER)
    ? `${MARKER}${LEAD}${line.text.slice(MARKER.length)}`
    : `${LEAD}${line.text}`;
}

function leadLength(text: string): number {
  if (text.startsWith(`${MARKER}${LEAD}`)) return MARKER.length + LEAD.length;
  return text.startsWith(LEAD) ? LEAD.length : 0;
}

/** How long to wait before writing the character at `chars`. */
function delayFor(text: string, chars: number, beat: Beat): number {
  const lead = leadLength(text);
  if (chars === 0) return beat.pre;
  // Inside the dots, one slow tick each; the marker itself is instant.
  if (chars < lead) return chars <= MARKER.length ? 1 : LEAD_TICK;
  const previous = text[chars - 1];
  const next = text[chars];
  if (previous === undefined) return beat.tick;
  if ('.!?'.includes(previous) && (next === ' ' || next === undefined)) return beat.sentence;
  if (',;:—'.includes(previous)) return beat.clause;
  return beat.tick;
}

/**
 * Reveals the text on a clock rather than a timer chain. Each line gets a
 * schedule — the millisecond at which every character appears, including its
 * pauses — and a frame loop reads the clock against it. Typing therefore takes
 * exactly as long as it is written to take, however slow the device is at
 * painting it, and holding simply makes the clock run faster.
 */
function scheduleFor(text: string, beat: Beat): number[] {
  const at: number[] = new Array(text.length + 1);
  let t = beat.pre;
  at[0] = 0;
  for (let i = 1; i <= text.length; i++) {
    at[i] = t;
    t += delayFor(text, i, beat);
  }
  return at;
}

export function useTypedFeed(lines: DisplayLine[], instant: boolean, fast = false): TypedFeed {
  const [done, setDone] = useState(lines.length);
  const [chars, setChars] = useState(0);
  const previousLength = useRef(lines.length);
  // Where the current burst of writing began, so a long hour can spend its
  // drama on the first few lines and hurry the rest.
  const burstStart = useRef(lines.length);
  const fastRef = useRef(fast);
  fastRef.current = fast;

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
      burstStart.current = lines.length;
      return undefined;
    }
    if (done >= lines.length) {
      burstStart.current = lines.length;
      return undefined;
    }
    const line = lines[done];
    if (!line) return undefined;

    const previousLine = done > 0 ? lines[done - 1] : undefined;
    const deep = done - burstStart.current;
    let beat = beatFor(line);
    if (previousLine !== undefined && previousLine.kind === line.kind) beat = soften(beat);
    // Three lines in, the hour has made its point; get to the end of it. By the
    // ninth line the ship is reading out a list, and reads it like one.
    if (deep >= 3) beat = { ...soften(beat), tick: Math.round(beat.tick * 0.7) };
    if (deep >= 6) beat = { ...soften(beat), tick: Math.round(beat.tick * 0.45) };
    if (deep >= 9) beat = { ...soften(beat), tick: Math.round(beat.tick * 0.3), pre: 40, gap: 60 };

    const text = displayText(line, previousLine);
    const at = scheduleFor(text, beat);
    const startedAt = performance.now();
    let elapsed = 0;
    let last = startedAt;
    let frame = 0;
    let shown = 0;

    const step = (now: number): void => {
      elapsed += (now - last) * (fastRef.current ? HELD : 1);
      last = now;
      let next = shown;
      while (next < text.length && (at[next + 1] as number) <= elapsed) next += 1;
      if (next !== shown) {
        shown = next;
        setChars(next);
      }
      if (shown >= text.length && elapsed >= (at[text.length] as number) + beat.gap) {
        setDone((d) => d + 1);
        setChars(0);
        return;
      }
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // `chars` is deliberately absent: the frame loop owns it for this line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, done, instant]);

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
