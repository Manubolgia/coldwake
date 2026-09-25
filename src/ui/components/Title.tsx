import { useEffect, useRef } from 'react';
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

function Ship() {
  return (
    <svg className="title-ship" viewBox="0 0 520 260" aria-hidden="true">
      <defs>
        <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1c2a3d" />
          <stop offset="1" stopColor="#070b12" />
        </linearGradient>
        <filter id="shipglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <radialGradient id="planet" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#3a86c4" />
          <stop offset="0.6" stopColor="#123456" />
          <stop offset="1" stopColor="#040a14" />
        </radialGradient>
      </defs>
      <circle cx="430" cy="250" r="170" fill="url(#planet)" opacity="0.55" />
      <path d="M270 250 a170 170 0 0 1 300 -120" stroke="#7fd6ff" strokeOpacity="0.35" strokeWidth="2" fill="none" />
      <g className="art-breathe" style={{ transformOrigin: '260px 130px' }}>
        <path d="M60 128 L150 104 L330 98 L420 112 L470 128 L420 144 L330 158 L150 152 Z" fill="url(#hull)" stroke="#5ce1e6" strokeOpacity="0.4" />
        <path d="M150 104 L170 76 L260 72 L280 98 M150 152 L170 180 L260 184 L280 158" fill="#0b121d" stroke="#5ce1e6" strokeOpacity="0.3" />
        <path d="M200 110 H320 M200 146 H320 M110 128 H440" stroke="#5ce1e6" strokeOpacity="0.15" />
        {[190, 214, 238, 262, 286, 310].map((x, i) => (
          <rect key={x} x={x} y={120} width={8} height={4} fill={i === 3 ? '#ff4d5e' : '#ffd27f'} opacity={i === 3 ? 0.9 : 0.5} className={i === 3 ? 'art-blink' : undefined} />
        ))}
        <ellipse cx="52" cy="128" rx="18" ry="10" fill="#5ce1e6" opacity="0.6" filter="url(#shipglow)" />
        <ellipse cx="56" cy="128" rx="7" ry="5" fill="#dffcff" />
      </g>
    </svg>
  );
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
      <Ship />
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
