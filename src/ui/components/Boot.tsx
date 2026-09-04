import { useEffect, useState } from 'react';

const LINES = [
  'KELL RECLAMATION & ASSAY',
  'BELLWETHER / ORE PROCESSOR / HULL 4471',
  '',
  'MEMORY CHECK ........ 640K OK',
  'REACTOR ............. OUTPUT DEGRADED',
  'LIFE SUPPORT ........ NOMINAL, 9 BERTHS',
  'CRYO BAY ............ 8 PODS OPEN',
  'ORBIT ............... DECAYING',
  '',
  'COLDWAKE',
];

const BODY = LINES.join('\n');
const TITLE_AT = BODY.length - (LINES[LINES.length - 1] as string).length;
const TICK = 11;
const STEP = 3;
// The self-test rattles out; the ship's name is typed, one letter at a time,
// after a pause. It is the only thing on this screen worth waiting for.
const TITLE_TICK = 62;
const TITLE_HOLD = 300;

/** The self-test types itself out. Under two seconds, and a tap skips it. */
export function Boot({ instant, onDone }: { instant: boolean; onDone: () => void }): React.ReactElement {
  const [written, setWritten] = useState(instant ? BODY.length : 0);
  const complete = written >= BODY.length;

  useEffect(() => {
    if (instant) {
      const t = window.setTimeout(onDone, 250);
      return () => window.clearTimeout(t);
    }
    if (complete) {
      // The name holds for a beat before the bay comes up.
      const t = window.setTimeout(onDone, 900);
      return () => window.clearTimeout(t);
    }
    const inTitle = written >= TITLE_AT;
    const delay = written === TITLE_AT ? TITLE_HOLD : inTitle ? TITLE_TICK : TICK;
    const step = inTitle ? 1 : STEP;
    const t = window.setTimeout(() => setWritten((n) => Math.min(n + step, BODY.length)), delay);
    return () => window.clearTimeout(t);
  }, [written, complete, instant, onDone]);

  const shown = BODY.slice(0, written).split('\n');

  return (
    <div
      className="boot"
      onClick={() => (complete ? onDone() : setWritten(BODY.length))}
      role="button"
      tabIndex={0}
      data-testid="boot"
      data-complete={complete ? 'yes' : 'no'}
      aria-label="skip boot sequence"
    >
      {shown.map((l, i) => (
        <div key={i} className={l.startsWith('COLDWAKE') ? 'title glow' : ''}>
          {l || ' '}
          {i === shown.length - 1 ? <span className={`caret${complete ? ' idle' : ''}`} /> : null}
        </div>
      ))}
    </div>
  );
}
