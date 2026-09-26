import { useEffect, useRef } from 'react';
import { Art } from '../art/Art';
import { Icon } from '../art/Icon';

function Starfield({ reduced }: { reduced: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const stars = Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), z: Math.random() * 0.9 + 0.1, t: Math.random() * 6 }));
    const resize = () => {
      c.width = c.clientWidth * dpr;
      c.height = c.clientHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);
    let last = performance.now();
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const w = c.width;
      const h = c.height;
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.3, 0, w * 0.5, h * 0.3, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(40, 90, 120, 0.25)');
      g.addColorStop(0.5, 'rgba(60, 30, 90, 0.08)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      for (const s of stars) {
        if (!reduced) {
          s.x -= dt * 0.006 * s.z;
          if (s.x < 0) s.x += 1;
          s.t += dt;
        }
        const a = 0.35 + 0.65 * s.z * (0.75 + 0.25 * Math.sin(s.t * 2));
        ctx.fillStyle = `rgba(220, 240, 255, ${a})`;
        const r = s.z * 1.4 * dpr;
        ctx.beginPath();
        ctx.arc(s.x * w, s.y * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [reduced]);
  return <canvas ref={ref} className="starfield" aria-hidden="true" />;
}

export function Title({
  hasSave,
  onContinue,
  onNew,
  onHowTo,
  onMemorial,
  sound,
  onSound,
  reduced,
}: {
  hasSave: boolean;
  onContinue: () => void;
  onNew: () => void;
  onHowTo: () => void;
  onMemorial: () => void;
  sound: boolean;
  onSound: () => void;
  reduced: boolean;
}) {
  return (
    <main className="title-screen">
      <Starfield reduced={reduced} />
      <div className="title-art" aria-hidden="true">
        <Art art="title" className="scene-art" />
      </div>
      <div className="title-block">
        <h1 className="logo">COLDWAKE</h1>
        <p className="tagline">You wake alone. Something else is awake too.</p>
        <div className="title-buttons">
          {hasSave && (
            <button className="btn primary wide" onClick={onContinue}>
              Continue your story
            </button>
          )}
          <button className={`btn wide ${hasSave ? '' : 'primary'}`} onClick={onNew}>
            New story
          </button>
          <button className="btn wide ghost" onClick={onHowTo}>
            How to play
          </button>
          <button className="btn wide ghost" onClick={onMemorial}>
            The memorial
          </button>
        </div>
        <div className="title-foot">
          <button onClick={onSound} aria-label={sound ? 'Mute sound' : 'Turn sound on'}>
            <Icon name={sound ? 'sound' : 'mute'} size={16} /> Sound {sound ? 'on' : 'off'}
          </button>
          <span>Headphones recommended</span>
        </div>
      </div>
    </main>
  );
}
