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

export function Boot({ instant, onDone }: { instant: boolean; onDone: () => void }): React.ReactElement {
  const [shown, setShown] = useState(instant ? LINES.length : 0);

  useEffect(() => {
    if (instant) {
      const t = setTimeout(onDone, 300);
      return () => clearTimeout(t);
    }
    if (shown >= LINES.length) {
      const t = setTimeout(onDone, 500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((n) => n + 1), 130);
    return () => clearTimeout(t);
  }, [shown, instant, onDone]);

  return (
    <div
      className="boot"
      onClick={onDone}
      role="button"
      tabIndex={0}
      data-testid="boot"
      aria-label="skip boot sequence"
    >
      {LINES.slice(0, shown).map((l, i) => (
        <div key={i} className={l === 'COLDWAKE' ? 'title glow' : ''}>
          {l || ' '}
        </div>
      ))}
      <span className="cursor" />
    </div>
  );
}
