import { useCallback, useEffect, useRef, useState } from 'react';
import type { DisplayLine } from '../guidance';
import { displayText, useTypedFeed } from '../hooks';

/**
 * How long the finished text stays up before the ship hands control back. The
 * pauses inside the writing do most of the dwelling now, so this is the last
 * beat rather than the whole one — long enough to look up from the last line.
 */
function readingTime(lines: DisplayLine[], from: number): number {
  const last = lines.at(-1);
  const weight = last?.kind === 'alarm' ? 1400 : last?.kind === 'threat' ? 1100 : 700;
  const chars = lines.slice(from).reduce((n, l) => n + l.text.length, 0);
  return Math.min(2200, Math.max(weight, chars * 8));
}

/**
 * The ship's readout. Everything the player learns arrives here, written out at
 * reading pace rather than printed. A tap finishes the line; holding the screen
 * runs the whole thing fast.
 */
export function Terminal({
  lines,
  resolving,
  instant,
  onComplete,
}: {
  lines: DisplayLine[];
  resolving: boolean;
  instant: boolean;
  onComplete: () => void;
}): React.ReactElement {
  const [held, setHeld] = useState(false);
  const pressedAt = useRef(0);
  const typed = useTypedFeed(lines, instant, held);
  const scroller = useRef<HTMLDivElement>(null);
  const wasComplete = useRef(true);
  const startedAt = useRef(0);
  const holdTimer = useRef<number | undefined>(undefined);

  const finishNow = useCallback(() => {
    if (holdTimer.current !== undefined) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = undefined;
    }
    onComplete();
  }, [onComplete]);

  // Finish, then hold the last of it on screen long enough to be read.
  useEffect(() => {
    if (typed.complete && !wasComplete.current) {
      const wait = instant || held ? 0 : readingTime(lines, startedAt.current);
      holdTimer.current = window.setTimeout(() => {
        holdTimer.current = undefined;
        onComplete();
      }, wait);
      wasComplete.current = true;
      return () => {
        if (holdTimer.current !== undefined) window.clearTimeout(holdTimer.current);
      };
    }
    if (!typed.complete && wasComplete.current) {
      startedAt.current = Math.max(0, typed.done - 1);
    }
    wasComplete.current = typed.complete;
    return undefined;
  }, [typed.complete, typed.done, onComplete, instant, held, lines]);

  // Scrolling forces a layout, so it happens once a line rather than once a
  // character — at a character it made the typing render-bound rather than
  // paced, and every measured beat was a lie.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [typed.done, resolving]);

  const press = useCallback(() => {
    pressedAt.current = Date.now();
    setHeld(true);
  }, []);
  const release = useCallback(() => {
    // A tap finishes the sentence, and a second tap dismisses what is left on
    // screen; a hold has already run both forward.
    if (Date.now() - pressedAt.current < 200) {
      if (typed.complete) finishNow();
      else typed.skip();
    }
    setHeld(false);
  }, [typed, finishNow]);

  const window_ = resolving ? 26 : 6;
  const first = Math.max(0, typed.done + 1 - window_);
  const visible = lines.slice(first, typed.done);
  const current = lines[typed.done];
  const age = (index: number): string => {
    const back = visible.length - index;
    if (back > 8) return 'ghost';
    if (back > 3) return 'dim';
    return '';
  };
  const tone = (line: DisplayLine, index: number): string => {
    if (line.kind === 'guide') return age(index) === 'ghost' ? 'ghost' : 'guide';
    const faded = age(index);
    if (faded !== '') return faded;
    return line.kind === 'alarm' ? 'alarm' : line.kind === 'threat' ? '' : 'dim';
  };
  const body = (line: DisplayLine, index: number): string =>
    displayText(line, index > 0 ? lines[index - 1] : undefined);

  return (
    <div
      className={`terminal${resolving ? ' resolving' : ''}`}
      data-testid="terminal"
      data-resolving={resolving ? 'yes' : 'no'}
      data-complete={typed.complete ? 'yes' : 'no'}
      data-held={held ? 'yes' : 'no'}
      onPointerDown={press}
      onPointerUp={release}
      onPointerCancel={() => setHeld(false)}
      onPointerLeave={() => setHeld(false)}
      role="log"
      aria-live="polite"
      ref={scroller}
    >
      {visible.map((l, i) => (
        <div key={first + i} className={tone(l, i)}>
          {body(l, first + i)}
        </div>
      ))}
      {current ? (
        <div
          className={
            current.kind === 'guide'
              ? 'guide'
              : current.kind === 'alarm'
                ? 'alarm'
                : current.kind === 'threat'
                  ? ''
                  : 'dim'
          }
        >
          {body(current, typed.done).slice(0, typed.chars)}
          <span className="caret" />
        </div>
      ) : (
        <div className="dim">
          {'> '}
          <span className="caret idle" />
        </div>
      )}
      {resolving ? (
        <div className="ghost skip-hint">{held ? 'RUNNING' : 'HOLD TO RUN IT FAST'}</div>
      ) : null}
    </div>
  );
}
