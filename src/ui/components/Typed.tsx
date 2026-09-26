import { useEffect, useRef, useState } from 'react';
import { schedule } from '../narration';

/**
 * Writes `text` out a character at a time. The unwritten part is laid out but
 * invisible, so the box is its final size from the first letter and nothing
 * below it jumps as the words arrive.
 */
export function Typed({
  text,
  cps,
  pause,
  done = false,
  onDone,
}: {
  text: string;
  cps: number;
  pause: number;
  /** Show it all now. */
  done?: boolean;
  onDone?: () => void;
}) {
  const instant = done || !Number.isFinite(cps);
  const [n, setN] = useState(instant ? text.length : 0);
  const fired = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    fired.current = false;
    if (instant) {
      setN(text.length);
      return;
    }
    setN(0);
    const times = schedule(text, cps, pause);
    const start = performance.now();
    let k = 0;
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      while (k < times.length && times[k]! <= t) k++;
      setN(k);
      if (k < text.length) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, cps, pause, instant]);

  useEffect(() => {
    if (n >= text.length && !fired.current) {
      fired.current = true;
      onDoneRef.current?.();
    }
  }, [n, text]);

  const writing = n < text.length;
  return (
    <>
      <span aria-hidden="true">
        {text.slice(0, n)}
        {writing && <span className="caret" />}
        <span className="unwritten">{text.slice(n)}</span>
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
}
