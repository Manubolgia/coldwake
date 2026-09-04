import { useEffect, useRef } from 'react';
import type { LogLine } from '../../engine/types';
import { useTypedFeed } from '../hooks';

/**
 * The ship's readout. Everything the player learns arrives here, written out
 * rather than printed, so a turn resolves at the terminal's pace and not
 * instantly. Tapping it skips to the end.
 */
export function Terminal({
  lines,
  resolving,
  instant,
  onComplete,
}: {
  lines: LogLine[];
  resolving: boolean;
  instant: boolean;
  onComplete: () => void;
}): React.ReactElement {
  const typed = useTypedFeed(lines, instant);
  const scroller = useRef<HTMLDivElement>(null);
  const wasComplete = useRef(true);

  useEffect(() => {
    if (typed.complete && !wasComplete.current) onComplete();
    wasComplete.current = typed.complete;
  }, [typed.complete, onComplete]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [typed.done, typed.chars, resolving]);

  // Older output does not vanish, it burns in: the further back a line is, the
  // dimmer it sits, until it is part of the chrome.
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
  const tone = (line: LogLine, index: number): string => {
    const faded = age(index);
    if (faded !== '') return faded;
    return line.kind === 'alarm' ? 'alarm' : line.kind === 'threat' ? '' : 'dim';
  };

  return (
    <div
      className={`terminal${resolving ? ' resolving' : ''}`}
      data-testid="terminal"
      data-resolving={resolving ? 'yes' : 'no'}
      data-complete={typed.complete ? 'yes' : 'no'}
      onClick={typed.skip}
      role="log"
      aria-live="polite"
      ref={scroller}
    >
      {visible.map((l, i) => (
        <div key={first + i} className={tone(l, i)}>
          {l.text}
        </div>
      ))}
      {current ? (
        <div className={current.kind === 'alarm' ? 'alarm' : current.kind === 'threat' ? '' : 'dim'}>
          {current.text.slice(0, typed.chars)}
          <span className="caret" />
        </div>
      ) : (
        <div className="dim">
          {'> '}
          <span className="caret idle" />
        </div>
      )}
      {resolving && !typed.complete ? <div className="ghost skip-hint">TAP TO SKIP</div> : null}
    </div>
  );
}
