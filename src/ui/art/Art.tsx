import { useId, type ReactNode } from 'react';
import { ROOMS } from '../../game/content/rooms';
import type { CreatureKind, RoomType } from '../../game/types';
import { ICON_PATHS } from './paths';

// Every illustration in the game is drawn here, in SVG, in code. Rooms share
// one perspective corridor and differ by props and light; creatures share a
// red-lit corridor; everything else is an emblem.

const W = 400;
const H = 220;
const BX = 110;
const BY = 55;
const BW = 180;
const BH = 110;

const CREATURE_KINDS: CreatureKind[] = ['stalker', 'crawler', 'changed', 'drone', 'mimic'];

const EMBLEMS: Record<string, { icon: string; color: string }> = {
  hull: { icon: 'calm', color: '#5ce1e6' },
  box: { icon: 'box', color: '#6be38f' },
  speaker: { icon: 'sound', color: '#b18cff' },
  light: { icon: 'power', color: '#ffd27f' },
  photo: { icon: 'person', color: '#ffb547' },
  vent: { icon: 'menu', color: '#ff9c6b' },
  nest: { icon: 'skull', color: '#ff4d5e' },
  eye: { icon: 'eye', color: '#ff4d5e' },
  door: { icon: 'door', color: '#ffb547' },
  fire: { icon: 'fire', color: '#ff7a3d' },
  dark: { icon: 'dark', color: '#7fb2ff' },
  breach: { icon: 'breach', color: '#ff4d5e' },
  pipe: { icon: 'calm', color: '#7ff0ff' },
  body: { icon: 'skull', color: '#a3adbd' },
  wall: { icon: 'log', color: '#ffb547' },
  drone: { icon: 'scan', color: '#5ce1e6' },
  survivor: { icon: 'person', color: '#6be38f' },
  spores: { icon: 'flare', color: '#d8ff7f' },
  room: { icon: 'door', color: '#5ce1e6' },
  wire: { icon: 'emp', color: '#ffb547' },
  log: { icon: 'log', color: '#b18cff' },
  truth: { icon: 'eye', color: '#b18cff' },
  panic: { icon: 'stress', color: '#ff4d5e' },
  scan: { icon: 'scan', color: '#5ce1e6' },
  infection: { icon: 'sample', color: '#b0ff8f' },
  alarm: { icon: 'signal', color: '#ff4d5e' },
};

export function Art({ art, className }: { art: string; className?: string }) {
  if (art in ROOMS) return <RoomScene type={art as RoomType} className={className} />;
  if ((CREATURE_KINDS as string[]).includes(art)) return <CreatureScene kind={art as CreatureKind} className={className} />;
  const e = EMBLEMS[art] ?? EMBLEMS.room!;
  return <Emblem icon={e.icon} color={e.color} className={className} />;
}

// ── the corridor ───────────────────────────────────────────────────────

function Corridor({ a, id, children, dim = 1 }: { a: string; id: string; children?: ReactNode; dim?: number }) {
  const floorLines: ReactNode[] = [];
  for (let i = 0; i <= 6; i++) {
    const bx = BX + (BW / 6) * i;
    const fx = 200 + (bx - 200) * 3.6;
    floorLines.push(<line key={`f${i}`} x1={bx} y1={BY + BH} x2={fx} y2={H} />);
  }
  for (const [y, k] of [
    [172, 0.3],
    [184, 0.7],
    [201, 1.2],
  ] as const) {
    const t = (y - (BY + BH)) / (H - (BY + BH));
    const x0 = BX - BX * t;
    floorLines.push(<line key={`h${y}`} x1={x0} y1={y} x2={W - x0} y2={y} strokeOpacity={0.4 * k} />);
  }
  const panels: ReactNode[] = [];
  for (const x of [28, 62, 90]) {
    const top = (x * BY) / BX;
    panels.push(<line key={`l${x}`} x1={x} y1={top} x2={x} y2={H - (x * (H - BY - BH)) / BX} />);
    panels.push(<line key={`r${x}`} x1={W - x} y1={top} x2={W - x} y2={H - (x * (H - BY - BH)) / BX} />);
  }
  return (
    <>
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1220" />
          <stop offset="1" stopColor="#04060a" />
        </linearGradient>
        <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={a} stopOpacity={0.16 * dim} />
          <stop offset="1" stopColor={a} stopOpacity={0.03} />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="0.5" cy="0.45" r="0.6">
          <stop offset="0" stopColor={a} stopOpacity={0.28 * dim} />
          <stop offset="1" stopColor={a} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-vig`} cx="0.5" cy="0.5" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={0.85} />
        </radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
      </defs>
      <rect width={W} height={H} fill={`url(#${id}-bg)`} />
      <polygon points={`0,0 ${W},0 ${BX + BW},${BY} ${BX},${BY}`} fill="#0a1019" />
      <polygon points={`0,${H} ${W},${H} ${BX + BW},${BY + BH} ${BX},${BY + BH}`} fill="#070a11" />
      <polygon points={`0,0 ${BX},${BY} ${BX},${BY + BH} 0,${H}`} fill="#080d16" />
      <polygon points={`${W},0 ${BX + BW},${BY} ${BX + BW},${BY + BH} ${W},${H}`} fill="#080d16" />
      <rect x={BX} y={BY} width={BW} height={BH} fill={`url(#${id}-wall)`} />
      <g stroke={a} strokeOpacity={0.14} strokeWidth={1}>
        {floorLines}
        {panels}
      </g>
      <g stroke={a} strokeOpacity={0.32} strokeWidth={1} fill="none">
        <rect x={BX} y={BY} width={BW} height={BH} />
        <line x1={0} y1={0} x2={BX} y2={BY} />
        <line x1={W} y1={0} x2={BX + BW} y2={BY} />
        <line x1={0} y1={H} x2={BX} y2={BY + BH} />
        <line x1={W} y1={H} x2={BX + BW} y2={BY + BH} />
      </g>
      <g className="art-flicker">
        <polygon points="165,54 235,54 262,26 138,26" fill={a} opacity={0.35 * dim} filter={`url(#${id}-blur)`} />
        <polygon points="172,53 228,53 246,32 154,32" fill={a} opacity={0.55 * dim} />
      </g>
      <rect width={W} height={H} fill={`url(#${id}-glow)`} />
      {children}
      <g className="art-dust" fill={a}>
        {[
          [60, 90, 1.2],
          [140, 40, 0.8],
          [320, 70, 1],
          [260, 150, 0.7],
          [90, 160, 0.9],
          [350, 130, 1.1],
          [200, 30, 0.6],
        ].map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r} opacity={0.35} />
        ))}
      </g>
      <rect width={W} height={H} fill={`url(#${id}-vig)`} />
    </>
  );
}

function Frame({ children, className, label }: { children: ReactNode; className?: string; label?: string }) {
  return (
    <svg className={className} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      {children}
    </svg>
  );
}

// ── rooms ──────────────────────────────────────────────────────────────

export function RoomScene({ type, className }: { type: RoomType; className?: string }) {
  const raw = useId().replace(/:/g, '');
  const id = `r${raw}`;
  const a = ROOMS[type].accent;
  return (
    <Frame className={className} label={ROOMS[type].name}>
      <Corridor a={a} id={id} dim={type === 'nest' ? 0.7 : 1}>
        <g stroke={a} fill="none" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
          {props(type, a, id)}
        </g>
      </Corridor>
    </Frame>
  );
}

function glowRect(x: number, y: number, w: number, h: number, a: string, id: string, o = 0.5) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={a} opacity={o * 0.6} filter={`url(#${id}-blur)`} stroke="none" />
      <rect x={x} y={y} width={w} height={h} fill={a} opacity={o} stroke="none" />
    </>
  );
}

function props(type: RoomType, a: string, id: string): ReactNode {
  switch (type) {
    case 'cryo':
      return (
        <>
          {[130, 170, 210, 250].map((x, i) => (
            <g key={x}>
              <rect x={x} y={75} width={26} height={78} rx={13} fill={a} fillOpacity={i === 1 ? 0.25 : 0.08} />
              <rect x={x + 5} y={84} width={16} height={46} rx={8} strokeOpacity={0.5} />
            </g>
          ))}
          <ellipse cx={200} cy={200} rx={120} ry={10} fill={a} fillOpacity={0.08} stroke="none" filter={`url(#${id}-blur)`} />
          <path d="M40 210 q30 -8 60 0 M300 212 q30 -10 70 -2" strokeOpacity={0.4} />
        </>
      );
    case 'medbay':
      return (
        <>
          <rect x={185} y={66} width={30} height={30} rx={3} strokeOpacity={0.7} />
          <path d="M200 72v18M191 81h18" strokeWidth={3} />
          <rect x={232} y={70} width={44} height={28} rx={2} fill={a} fillOpacity={0.08} />
          <path d="M236 86h8l3-8 4 14 3-6h18" />
          <path d="M120 180 L290 180 L300 196 L110 196 Z" fill={a} fillOpacity={0.1} />
          <path d="M130 196v18M280 196v18" />
          <rect x={140} y={170} width={40} height={10} rx={4} fill={a} fillOpacity={0.15} />
        </>
      );
    case 'armory':
      return (
        <>
          {[125, 150, 175, 200, 225, 250].map((x) => (
            <g key={x}>
              <path d={`M${x} 70 v80`} strokeOpacity={0.6} />
              <path d={`M${x + 8} 78 l5 60`} strokeOpacity={x % 50 === 0 ? 0.9 : 0.25} />
            </g>
          ))}
          <g strokeOpacity={0.18}>
            {Array.from({ length: 10 }, (_, i) => (
              <path key={i} d={`M${112 + i * 18} 57 l-10 106`} />
            ))}
          </g>
          <rect x={150} y={176} width={100} height={26} fill={a} fillOpacity={0.08} />
          <path d="M150 189h100" strokeOpacity={0.5} />
        </>
      );
    case 'galley':
      return (
        <>
          {[150, 200, 250].map((x) => (
            <g key={x}>
              <path d={`M${x} 26 v22`} strokeOpacity={0.5} />
              <path d={`M${x - 10} 58 h20 l-4 -10 h-12 z`} fill={a} fillOpacity={0.3} />
              <ellipse cx={x} cy={62} rx={16} ry={4} fill={a} fillOpacity={0.12} stroke="none" filter={`url(#${id}-blur)`} />
            </g>
          ))}
          <path d="M70 176 L330 176 L350 192 L50 192 Z" fill={a} fillOpacity={0.1} />
          <path d="M80 192v24M320 192v24" />
          {[110, 160, 210, 260].map((x) => (
            <rect key={x} x={x} y={168} width={18} height={8} rx={2} strokeOpacity={0.6} />
          ))}
        </>
      );
    case 'quarters':
      return (
        <>
          {[0, 1, 2].map((r) => (
            <g key={r}>
              <rect x={122} y={66 + r * 32} width={68} height={22} fill={a} fillOpacity={0.07} />
              <rect x={210} y={66 + r * 32} width={68} height={22} fill={a} fillOpacity={r === 1 ? 0.18 : 0.07} />
              <path d={`M126 ${80 + r * 32} h20 M214 ${80 + r * 32} h20`} strokeOpacity={0.6} />
            </g>
          ))}
          <path d="M210 66 q10 20 0 40 q-8 20 0 34" strokeOpacity={0.5} />
          <rect x={186} y={70} width={6} height={10} fill={a} fillOpacity={0.5} stroke="none" />
        </>
      );
    case 'engineering':
      return (
        <>
          <path d="M110 75 H290 M110 90 H250 q12 0 12 12 V165 M140 55 V165 M290 120 H200 q-10 0 -10 10 V165" strokeOpacity={0.6} strokeWidth={3} />
          {[
            [170, 110],
            [225, 110],
          ].map(([x, y]) => (
            <g key={x}>
              <circle cx={x} cy={y} r={11} fill={a} fillOpacity={0.12} />
              <path d={`M${x} ${y} l6 -5`} />
            </g>
          ))}
          <rect x={120} y={130} width={12} height={8} fill="#ff4d5e" stroke="none" opacity={0.8} className="art-blink" />
          <path d="M20 200 l40 -30 M360 205 l-30 -25" strokeWidth={4} strokeOpacity={0.3} />
        </>
      );
    case 'reactor':
      return (
        <>
          <ellipse cx={200} cy={110} rx={40} ry={52} fill={a} opacity={0.35} stroke="none" filter={`url(#${id}-blur)`} className="art-pulse" />
          <rect x={172} y={62} width={56} height={96} rx={20} fill={a} fillOpacity={0.18} />
          <rect x={186} y={70} width={28} height={80} rx={12} fill={a} fillOpacity={0.55} stroke="none" className="art-pulse" />
          {[78, 100, 122, 144].map((y) => (
            <ellipse key={y} cx={200} cy={y} rx={34} ry={5} strokeOpacity={0.7} />
          ))}
          <path d="M60 205 L140 170 M340 205 L260 170" strokeOpacity={0.35} strokeWidth={3} />
        </>
      );
    case 'bridge':
      return (
        <>
          <rect x={115} y={60} width={170} height={70} rx={6} fill="#02040a" strokeOpacity={0.6} />
          {[
            [130, 72],
            [160, 100],
            [210, 80],
            [250, 110],
            [270, 70],
            [185, 118],
            [235, 66],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.4 : 0.8} fill="#fff" stroke="none" opacity={0.85} />
          ))}
          <path d="M200 60 V130" strokeOpacity={0.3} />
          <path d="M100 172 L300 172 L320 190 L80 190 Z" fill={a} fillOpacity={0.12} />
          {glowRect(120, 176, 40, 6, a, id, 0.5)}
          {glowRect(240, 176, 40, 6, a, id, 0.5)}
          <path d="M185 200 q15 -30 30 0 v16 h-30 z" fill="#05070c" strokeOpacity={0.7} />
        </>
      );
    case 'comms':
      return (
        <>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={122 + i * 54} y={68} width={48} height={34} rx={2} fill={a} fillOpacity={0.08} />
              <path d={`M${126 + i * 54} 86 q5 -${6 + i * 3} 10 0 t10 0 t10 0 t10 0`} strokeOpacity={0.9} />
            </g>
          ))}
          <path d="M160 150 a40 40 0 0 1 80 0 z" fill={a} fillOpacity={0.1} />
          <path d="M200 150 l18 -26" />
          <circle cx={218} cy={122} r={3} fill={a} stroke="none" className="art-blink" />
        </>
      );
    case 'lab':
      return (
        <>
          {[74, 104, 134].map((y) => (
            <g key={y}>
              <path d={`M118 ${y + 16} H282`} strokeOpacity={0.5} />
              {[128, 152, 176, 200, 224, 248, 268].map((x, i) => (
                <rect key={x} x={x} y={y} width={12} height={16} rx={3} fill={a} fillOpacity={(i + y) % 5 === 0 ? 0.5 : 0.12} />
              ))}
            </g>
          ))}
          <path d="M224 104 l6 16 M232 104 l-4 18" stroke="#ff4d5e" strokeOpacity={0.8} />
          <path d="M120 182 H280 L292 196 H108 Z" fill={a} fillOpacity={0.1} />
        </>
      );
    case 'hydroponics':
      return (
        <>
          {[70, 100, 130].map((y) => (
            <g key={y}>
              <path d={`M114 ${y + 22} H286`} strokeOpacity={0.4} />
              {Array.from({ length: 9 }, (_, i) => {
                const x = 124 + i * 19;
                return <path key={i} d={`M${x} ${y + 22} q-6 -10 0 -18 q6 8 0 18 M${x} ${y + 22} q7 -6 10 -12`} fill={a} fillOpacity={0.18} strokeOpacity={0.7} />;
              })}
            </g>
          ))}
          <rect x={112} y={57} width={176} height={4} fill="#c38cff" opacity={0.6} stroke="none" filter={`url(#${id}-blur)`} />
          <path d="M30 210 q20 -40 50 -20 M370 210 q-25 -35 -55 -15" strokeOpacity={0.4} fill={a} fillOpacity={0.05} />
        </>
      );
    case 'cargo':
      return (
        <>
          {[
            [118, 115, 50, 50],
            [170, 125, 44, 40],
            [216, 105, 64, 60],
            [128, 70, 40, 45],
            [226, 62, 44, 43],
          ].map(([x, y, w, h], i) => (
            <g key={i}>
              <rect x={x} y={y} width={w} height={h} fill={a} fillOpacity={0.08 + (i % 2) * 0.05} />
              <path d={`M${x} ${y} L${x! + w!} ${y! + h!} M${x! + w!} ${y} L${x} ${y! + h!}`} strokeOpacity={0.25} />
            </g>
          ))}
          <rect x={20} y={150} width={70} height={60} fill={a} fillOpacity={0.06} strokeOpacity={0.4} />
          <rect x={318} y={140} width={70} height={75} fill={a} fillOpacity={0.06} strokeOpacity={0.4} />
        </>
      );
    case 'security':
      return (
        <>
          {Array.from({ length: 12 }, (_, i) => {
            const x = 118 + (i % 4) * 42;
            const y = 64 + Math.floor(i / 4) * 30;
            const red = i === 6;
            return (
              <g key={i}>
                <rect x={x} y={y} width={38} height={26} fill={red ? '#ff4d5e' : a} fillOpacity={red ? 0.3 : 0.1} stroke={red ? '#ff4d5e' : a} className={red ? 'art-blink' : undefined} />
                {i % 3 === 1 && <path d={`M${x + 6} ${y + 18} h10 l4 -6 h10`} strokeOpacity={0.5} />}
              </g>
            );
          })}
          <path d="M120 182 H280 L292 196 H108 Z" fill={a} fillOpacity={0.1} />
        </>
      );
    case 'observation':
      return (
        <>
          <path d="M110 165 V110 a90 55 0 0 1 180 0 V165" fill="#02040a" strokeOpacity={0.5} />
          <circle cx={235} cy={140} r={46} fill="#2c6fb8" fillOpacity={0.35} stroke="#7fb2ff" strokeOpacity={0.6} />
          <path d="M195 128 q40 -14 80 6" stroke="#fff" strokeOpacity={0.35} />
          {[
            [140, 90],
            [170, 70],
            [260, 80],
            [150, 130],
            [215, 62],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1} fill="#fff" stroke="none" />
          ))}
          <path d="M140 200 h120 v12 h-120 z" fill={a} fillOpacity={0.12} />
        </>
      );
    case 'airlock':
      return (
        <>
          <circle cx={200} cy={110} r={46} fill={a} fillOpacity={0.06} strokeWidth={3} />
          <circle cx={200} cy={110} r={34} fill="#030509" />
          <path d="M200 76 V144 M166 110 H234" strokeOpacity={0.5} />
          <circle cx={200} cy={110} r={8} fill={a} fillOpacity={0.6} stroke="none" className="art-blink" />
          {Array.from({ length: 8 }, (_, i) => (
            <path key={i} d={`M${112 + i * 22} 165 l12 -10`} stroke="#ffb547" strokeWidth={4} strokeOpacity={0.6} />
          ))}
          <path d="M60 60 v80 M340 60 v80" strokeOpacity={0.4} />
          <path d="M52 70 q8 30 0 60 M348 70 q-8 30 0 60" strokeOpacity={0.25} />
        </>
      );
    case 'podbay':
      return (
        <>
          {[140, 200, 260].map((x, i) => (
            <g key={x}>
              <ellipse cx={x} cy={110} rx={24} ry={34} fill={a} fillOpacity={i === 1 ? 0.18 : 0.05} strokeOpacity={i === 1 ? 1 : 0.35} />
              <ellipse cx={x} cy={102} rx={11} ry={13} fill="#03050a" strokeOpacity={0.6} />
            </g>
          ))}
          <path d="M130 165 l10 -14 h120 l10 14" strokeOpacity={0.4} />
          {glowRect(170, 58, 60, 4, a, id, 0.7)}
        </>
      );
    case 'hangar':
      return (
        <>
          <rect x={112} y={58} width={176} height={100} fill="#02040a" strokeOpacity={0.4} />
          {[70, 90, 110, 130].map((y) => (
            <path key={y} d={`M112 ${y} H288`} strokeOpacity={0.12} />
          ))}
          <path d="M120 190 L200 150 L300 170 L318 190 L280 200 H140 Z" fill={a} fillOpacity={0.15} strokeWidth={1.6} />
          <path d="M200 150 L220 190 M150 196 l-20 18 M280 198 l20 16" strokeOpacity={0.6} />
          <path d="M240 162 h30 l8 10 h-38 z" fill={a} fillOpacity={0.45} stroke="none" />
        </>
      );
    case 'captain':
      return (
        <>
          <rect x={120} y={64} width={50} height={96} fill={a} fillOpacity={0.05} />
          {[80, 100, 120, 140].map((y) => (
            <path key={y} d={`M122 ${y} h46`} strokeOpacity={0.4} />
          ))}
          {[125, 131, 137, 146, 152, 160].map((x, i) => (
            <rect key={x} x={x} y={84 + (i % 2) * 20} width={4} height={14} fill={a} fillOpacity={0.4} stroke="none" />
          ))}
          <rect x={196} y={70} width={62} height={44} fill="#1d3b2a" fillOpacity={0.5} strokeOpacity={0.8} />
          <circle cx={227} cy={96} r={10} fill="#5fbf7f" fillOpacity={0.5} stroke="none" />
          <path d="M150 180 H290 L300 196 H140 Z" fill="#6b4a2a" fillOpacity={0.35} />
          <rect x={250} y={170} width={8} height={12} fill={a} fillOpacity={0.6} stroke="none" />
        </>
      );
    case 'maintenance':
      return (
        <>
          <rect x={130} y={70} width={60} height={44} rx={3} />
          {[78, 86, 94, 102].map((y) => (
            <path key={y} d={`M136 ${y} h48`} strokeOpacity={0.6} />
          ))}
          <path d="M210 60 V165 M230 60 V165 M210 90 H290 M210 104 H290" strokeWidth={4} strokeOpacity={0.35} />
          <rect x={120} y={130} width={70} height={30} fill={a} fillOpacity={0.08} />
          <path d="M300 200 l-30 -18 M320 205 l-10 -30" strokeOpacity={0.4} />
        </>
      );
    case 'nest':
      return (
        <>
          {Array.from({ length: 7 }, (_, i) => (
            <path key={i} d={`M${60 + i * 48} 0 q${i % 2 ? 30 : -30} 110 0 220`} strokeOpacity={0.3} strokeWidth={5} />
          ))}
          {[
            [150, 150],
            [180, 160],
            [215, 152],
            [245, 162],
            [200, 132],
            [165, 128],
          ].map(([x, y], i) => (
            <g key={i}>
              <ellipse cx={x} cy={y} rx={12} ry={15} fill={a} fillOpacity={0.35} stroke="none" filter={`url(#${id}-blur)`} className="art-pulse" />
              <ellipse cx={x} cy={y} rx={9} ry={12} fill={a} fillOpacity={0.25} strokeOpacity={0.8} />
            </g>
          ))}
          <path d="M0 220 q100 -40 200 -30 q100 10 200 30" fill={a} fillOpacity={0.12} stroke="none" />
        </>
      );
  }
}

// ── creatures ──────────────────────────────────────────────────────────

export function CreatureScene({ kind, className }: { kind: CreatureKind; className?: string }) {
  const raw = useId().replace(/:/g, '');
  const id = `c${raw}`;
  const a = '#ff4d5e';
  return (
    <Frame className={className} label={kind}>
      <Corridor a={a} id={id} dim={0.6}>
        <ellipse cx={200} cy={150} rx={110} ry={70} fill="#ff2436" opacity={0.18} filter={`url(#${id}-blur)`} />
        <g className="art-breathe">{creature(kind, id)}</g>
      </Corridor>
    </Frame>
  );
}

function eyes(pts: [number, number][], id: string, color = '#ff4d5e', r = 2.4) {
  return pts.map(([x, y], i) => (
    <g key={i}>
      <circle cx={x} cy={y} r={r * 3} fill={color} opacity={0.5} filter={`url(#${id}-blur)`} />
      <circle cx={x} cy={y} r={r} fill="#ffe4e6" />
    </g>
  ));
}

function creature(kind: CreatureKind, id: string): ReactNode {
  const body = '#020305';
  const rim = '#ff4d5e';
  switch (kind) {
    case 'stalker':
      return (
        <>
          <path
            d="M200 220 L188 170 L172 214 L178 150 L160 118 L168 92 L186 80 C176 60 190 34 230 22 C250 16 262 22 262 26 C236 30 214 44 214 70 L222 86 L240 96 L248 124 L230 150 L236 214 L220 172 L212 220 Z"
            fill={body}
            stroke={rim}
            strokeOpacity={0.55}
            strokeWidth={1.4}
          />
          <path d="M168 96 L128 132 L118 168 M240 100 L278 128 L292 170" stroke={rim} strokeOpacity={0.5} strokeWidth={5} fill="none" strokeLinecap="round" />
          <path d="M168 96 L128 132 L118 168 M240 100 L278 128 L292 170" stroke={body} strokeWidth={3.5} fill="none" strokeLinecap="round" />
          <path d="M196 76 q10 -8 22 -6" stroke={rim} strokeOpacity={0.9} strokeWidth={1.4} fill="none" />
          <path d="M190 98 l8 22 l8 -22" stroke={rim} strokeOpacity={0.35} fill="none" />
        </>
      );
    case 'crawler':
      return (
        <>
          {[-1, 1].map((side) =>
            [0, 1, 2, 3].map((i) => (
              <path
                key={`${side}${i}`}
                d={`M${200 + side * 18} ${160 + i * 4} q${side * (40 + i * 10)} -${40 - i * 6} ${side * (70 + i * 12)} ${30 + i * 6}`}
                stroke={rim}
                strokeOpacity={0.55}
                strokeWidth={4}
                fill="none"
              />
            )),
          )}
          <ellipse cx={200} cy={165} rx={42} ry={24} fill={body} stroke={rim} strokeOpacity={0.6} />
          <ellipse cx={200} cy={148} rx={20} ry={14} fill={body} stroke={rim} strokeOpacity={0.6} />
          {eyes(
            [
              [192, 146],
              [200, 142],
              [208, 146],
            ],
            id,
            rim,
            1.8,
          )}
        </>
      );
    case 'changed':
      return (
        <>
          <path
            d="M190 220 L184 168 L166 176 L160 150 L176 116 L192 108 C184 96 186 78 202 74 C220 72 226 94 214 108 L232 118 L246 150 L236 178 L218 166 L214 220 Z"
            fill={body}
            stroke={rim}
            strokeOpacity={0.5}
          />
          <path d="M176 118 q-24 20 -20 60 M232 118 q30 16 22 56" stroke={body} strokeWidth={7} fill="none" strokeLinecap="round" />
          <path d="M194 112 q-8 30 4 60 q6 20 -2 48 M206 110 q12 26 2 54 M200 120 q-30 10 -40 40" stroke="#ffb547" strokeOpacity={0.6} strokeWidth={1} fill="none" className="art-pulse" />
          {eyes(
            [
              [196, 92],
              [210, 90],
            ],
            id,
            '#ffb547',
            1.8,
          )}
        </>
      );
    case 'drone':
      return (
        <>
          <path d="M150 110 L120 150 L130 196 M250 110 L280 150 L270 196" stroke={rim} strokeOpacity={0.5} strokeWidth={5} fill="none" />
          <path d="M150 110 L120 150 L130 196 M250 110 L280 150 L270 196" stroke={body} strokeWidth={3} fill="none" />
          <rect x={150} y={78} width={100} height={80} rx={14} fill={body} stroke={rim} strokeOpacity={0.6} />
          <path d="M160 170 L180 158 H220 L240 170 L226 214 H174 Z" fill={body} stroke={rim} strokeOpacity={0.5} />
          <circle cx={200} cy={116} r={22} fill="#1a0306" stroke={rim} strokeOpacity={0.8} />
          <circle cx={200} cy={116} r={14} fill={rim} opacity={0.35} filter={`url(#${id}-blur)`} />
          {eyes([[200, 116]], id, rim, 5)}
          <path d="M160 90 h14 M226 90 h14" stroke={rim} strokeOpacity={0.6} />
        </>
      );
    case 'mimic':
      return (
        <>
          <path
            d="M200 220 L182 220 L178 160 L162 170 L156 130 L176 108 L190 104 C178 92 178 66 198 62 C220 60 226 88 212 102 L228 110 L244 132 L238 170 L222 160 L218 220 Z"
            fill={body}
            stroke={rim}
            strokeOpacity={0.5}
          />
          <path d="M214 64 C238 60 246 84 232 100" stroke={rim} strokeOpacity={0.8} fill="none" />
          <path d="M200 70 L206 104" stroke={rim} strokeOpacity={0.7} fill="none" />
          <path d="M190 90 q10 8 20 0" stroke="#ffe4e6" strokeOpacity={0.9} fill="none" strokeWidth={1.4} />
          {eyes(
            [
              [192, 80],
              [228, 76],
            ],
            id,
            rim,
            1.8,
          )}
        </>
      );
  }
}

// ── emblems ────────────────────────────────────────────────────────────

export function Emblem({ icon, color, className }: { icon: string; color: string; className?: string }) {
  const raw = useId().replace(/:/g, '');
  const id = `e${raw}`;
  const d = ICON_PATHS[icon] ?? ICON_PATHS.info!;
  return (
    <Frame className={className} label={icon}>
      <defs>
        <radialGradient id={`${id}-g`} cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor={color} stopOpacity={0.3} />
          <stop offset="0.6" stopColor={color} stopOpacity={0.05} />
          <stop offset="1" stopColor="#04060a" stopOpacity={0} />
        </radialGradient>
        <filter id={`${id}-b`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <rect width={W} height={H} fill="#05080e" />
      <rect width={W} height={H} fill={`url(#${id}-g)`} />
      <g fill="none" stroke={color}>
        {[40, 64, 92].map((r, i) => (
          <circle key={r} cx={200} cy={110} r={r} strokeOpacity={0.22 - i * 0.06} strokeDasharray={i === 1 ? '2 6' : undefined} className={i === 1 ? 'art-spin' : undefined} />
        ))}
        <path d="M0 110 H110 M290 110 H400" strokeOpacity={0.12} />
      </g>
      <g transform="translate(164 74) scale(3)" fill="none" stroke={color} strokeWidth={1.1} strokeLinecap="round" strokeLinejoin="round">
        <path d={d} filter={`url(#${id}-b)`} strokeOpacity={0.8} />
        <path d={d} />
      </g>
      <g fill={color} className="art-dust">
        {[
          [80, 50],
          [320, 60],
          [60, 170],
          [340, 170],
          [130, 190],
          [270, 30],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1} opacity={0.5} />
        ))}
      </g>
    </Frame>
  );
}
