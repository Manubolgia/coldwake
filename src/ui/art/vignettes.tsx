import type { ReactNode } from 'react';
import type { CreatureKind, Hazard } from '../../game/types';
import { creatureAt, limb, blob } from './creatures';
import { P, glowMat, mat, pts2, scaleAt, seeded, type V3 } from './kit3d';
import type { RoomArt } from './rooms';
import { onFloor, shell, stars, type Built, type Look } from './scene';

// Everything that is not a room: the creatures in their corridors, the ship's
// events, the things you find, and the last picture of every ending.

const RED = '#ff4d5e';

function look(haze: string, extra: Partial<Look> = {}): Look {
  return { bg: '#030407', haze, hazeO: 0.05, dust: '#dfefff', grade: haze, gradeO: 0.08, ...extra };
}

/** A plain service corridor, the backdrop for most events. */
function corridor(o: { lamp?: string | null; lampI?: number; door?: 'open' | 'shut'; doorGlow?: string; hw?: number; seed?: number } = {}): Built {
  return shell({ hw: o.hw ?? 2.2, ceil: 1.5, back: 10, lamp: o.lamp === undefined ? '#cfe8ff' : o.lamp, lampI: o.lampI ?? 0.8, door: o.door ?? 'open', doorGlow: o.doorGlow, ribEvery: 1.3, seed: o.seed, cables: 3 });
}

// ── creatures in their corridors ───────────────────────────────────────

export function creatureScene(kind: CreatureKind): RoomArt {
  const b = corridor({ lamp: '#ff3b4e', lampI: 0.1, door: 'open', doorGlow: '#ff7a5a', seed: kind.length * 17 });
  // Backlight from the far door, a red alarm lamp, and the thing in between.
  b.sc.light([0, 0.2, 8.4], '#ff6a5a', 1.2, 2.2);
  b.sc.light([0, 0.6, 6.2], '#ff3b4e', 0.5, 1.6);
  b.sc.light([1.8, 1, 2.4], RED, 0.25, 1);
  const z = kind === 'crawler' ? 5 : 4.4;
  const c = creatureAt(kind, kind === 'crawler' ? 0.2 : 0, z, { scale: kind === 'crawler' ? 1.6 : 1, glow: 1.3 });
  b.sc.sprite(c.d, c.el);
  b.sc.fog = { c: [0.016, 0.002, 0.004], d: 0.16 };
  const [fx, fy] = P([0, -0.3, 7]);
  b.sc.sprite(
    7,
    <g>
      <defs>
        <radialGradient id="cs-back" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ff7a6a" stopOpacity={0.45} />
          <stop offset="1" stopColor="#ff3b4e" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={fx} cy={fy} rx={170} ry={210} fill="url(#cs-back)" />
    </g>,
  );
  return {
    built: b,
    look: look(RED, { hazeO: 0.08, dust: '#ffc2c8', grade: '#ff2436', gradeO: 0.1, vignette: 0.96 }),
  };
}

// ── hazards and company, laid over a room ──────────────────────────────

export function dressRoom(r: RoomArt, hazards: Hazard[], creatures: CreatureKind[]): RoomArt {
  const b = r.built;
  if (!b) return r;
  const extraOver: ReactNode[] = [];
  let lookOut = r.look;
  if (creatures.length) {
    const spots: [number, number][] = [
      [0.1, 6],
      [-1.3, 6.8],
      [1.4, 6.6],
      [-0.6, 7.6],
      [0.9, 7.8],
    ];
    creatures.slice(0, 5).forEach((k, i) => {
      const [x, z] = spots[i]!;
      const c = creatureAt(k, x, z, { flip: i % 2 === 1, scale: k === 'crawler' ? 1.5 : 1, glow: 0.8 });
      b.sc.sprite(c.d, c.el);
    });
    b.sc.light([0, 0.4, 6.2], RED, 0.7, 1.6);
    lookOut = { ...lookOut, grade: '#ff2436', gradeO: 0.1 };
  }
  if (hazards.includes('dark')) {
    for (const L of b.sc.lights) L.i *= 0.12;
    b.cones = [];
    b.sc.light([0.3, -0.3, 1.2], '#e8f1ff', 1.1, 2.2);
    const [x1, y1] = P([-0.9, b.floor, 6.5]);
    const [x2, y2] = P([1.6, b.floor, 6.5]);
    extraOver.push(
      <g key="torch">
        <defs>
          <radialGradient id="torch-g" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#f2f7ff" stopOpacity={0.22} />
            <stop offset="1" stopColor="#f2f7ff" stopOpacity={0} />
          </radialGradient>
        </defs>
        <polygon points={`${360},${640} ${x1},${y1 - 40} ${x2},${y2 - 40}`} fill="#f2f7ff" opacity={0.05} />
        <ellipse cx={(x1 + x2) / 2} cy={(y1 + y2) / 2 - 20} rx={Math.abs(x2 - x1) * 0.7} ry={70} fill="url(#torch-g)" />
      </g>,
    );
    lookOut = { ...lookOut, vignette: 0.97, hazeO: lookOut.hazeO * 0.3 };
  }
  if (hazards.includes('fire')) {
    const spots: [number, number][] = [
      [-1.4, 5.2],
      [1.1, 6.4],
      [-0.2, 7.6],
    ];
    for (const [x, z] of spots) {
      b.sc.light([x, b.floor + 0.6, z - 0.4], '#ff7a2a', 1.4, 1.4);
      b.sc.sprite(z - 0.1, <Flames x={x} z={z} floor={b.floor} />);
    }
    extraOver.push(<Smoke key="smoke" />);
    lookOut = { ...lookOut, grade: '#ff6a1a', gradeO: 0.16, haze: '#ff7a2a', hazeO: 0.08, dust: '#ffb070' };
  }
  if (hazards.includes('breach')) {
    b.sc.light([0, 0, b.back - 1.2], '#9fc8ff', 1.2, 1.8);
    extraOver.push(<Breach key="breach" b={b} />);
    lookOut = { ...lookOut, grade: '#5ca8ff', gradeO: 0.1, dust: '#cfe3ff' };
  }
  return { ...r, look: lookOut, over: [r.over, ...extraOver] };
}

function Flames({ x, z, floor }: { x: number; z: number; floor: number }) {
  const { x: px, y: py, s } = onFloor(x, z, floor);
  const w = 0.9 * s;
  const h = 1.3 * s;
  const tongue = (dx: number, hh: number, ww: number, c: string, o: number, k: number) => (
    <path key={k} d={`M${px + dx - ww / 2} ${py} C${px + dx - ww / 2} ${py - hh * 0.5} ${px + dx - ww * 0.1} ${py - hh * 0.7} ${px + dx} ${py - hh} C${px + dx + ww * 0.15} ${py - hh * 0.6} ${px + dx + ww / 2} ${py - hh * 0.45} ${px + dx + ww / 2} ${py} Z`} fill={c} opacity={o} />
  );
  return (
    <g style={{ mixBlendMode: 'screen' }}>
      <defs>
        <radialGradient id="flame-glow" cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="#ff7a2a" stopOpacity={0.45} />
          <stop offset="1" stopColor="#ff5a1a" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse cx={px} cy={py - h * 0.3} rx={w * 1.6} ry={h * 1.1} fill="url(#flame-glow)" />
      {tongue(-w * 0.25, h * 0.75, w * 0.5, '#ff3d1a', 0.8, 1)}
      {tongue(w * 0.2, h * 0.9, w * 0.55, '#ff5a1a', 0.85, 2)}
      {tongue(0, h, w * 0.6, '#ff8a2a', 0.9, 3)}
      {tongue(-w * 0.05, h * 0.65, w * 0.35, '#ffd27a', 0.95, 4)}
      {tongue(w * 0.02, h * 0.35, w * 0.2, '#fff4d0', 1, 5)}
    </g>
  );
}

function Smoke() {
  return (
    <g>
      <defs>
        <linearGradient id="smoke-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0a0605" stopOpacity={0.9} />
          <stop offset="0.35" stopColor="#1a0e08" stopOpacity={0.45} />
          <stop offset="0.6" stopColor="#1a0e08" stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect width={600} height={600} fill="url(#smoke-g)" />
      {Array.from({ length: 14 }, (_, i) => (
        <circle key={i} cx={150 + ((i * 97) % 300)} cy={200 + ((i * 53) % 260)} r={1.4} fill="#ffb070" opacity={0.8} />
      ))}
    </g>
  );
}

function Breach({ b }: { b: Built }) {
  // A torn hole in the far wall with space behind it.
  const z = b.back - 0.01;
  const hole: V3[] = [
    [-0.9, -0.9, z],
    [-0.3, -1.2, z],
    [0.6, -0.8, z],
    [1.1, 0.1, z],
    [0.7, 0.9, z],
    [-0.2, 1.1, z],
    [-0.9, 0.6, z],
    [-1.2, -0.2, z],
  ];
  const pts = hole.map((v) => P(v));
  const rnd = seeded(77);
  return (
    <g>
      <defs>
        <clipPath id="breach-clip">
          <polygon points={pts2(pts as [number, number][])} />
        </clipPath>
      </defs>
      <polygon points={pts2(pts as [number, number][])} fill="#01030a" />
      <g clipPath="url(#breach-clip)">{stars(31, 90, [300, 100, 600, 500])}</g>
      <polygon points={pts2(pts as [number, number][])} fill="none" stroke="#9fc8ff" strokeWidth={2} strokeOpacity={0.6} />
      {Array.from({ length: 10 }, (_, i) => {
        const [px, py] = pts[i % pts.length]!;
        const dx = (px - 300) * (0.3 + rnd() * 0.6);
        const dy = (py - 280) * (0.3 + rnd() * 0.6);
        return <line key={i} x1={px + dx} y1={py + dy} x2={px + dx * 0.7} y2={py + dy * 0.7} stroke="#cfe3ff" strokeWidth={1} opacity={0.35} />;
      })}
      {Array.from({ length: 8 }, (_, i) => {
        const [px, py] = pts[(i * 3) % pts.length]!;
        const ox = (px - 300) * (1.4 + i * 0.25);
        const oy = (py - 280) * (1.4 + i * 0.25);
        return <polygon key={`d${i}`} points={`${300 + ox},${280 + oy} ${306 + ox},${275 + oy} ${310 + ox},${284 + oy}`} fill="#5a6270" />;
      })}
    </g>
  );
}

// ── events, finds and notices ──────────────────────────────────────────

/** A person, standing or slumped, as a flat silhouette. */
function person(x: number, z: number, pose: 'stand' | 'slump' | 'crouch', color: string, rim: string, floor = -1.6): { d: number; el: ReactNode } {
  const [px, py] = P([x, floor, z]);
  const s = scaleAt(z) / 100;
  let d: string[];
  if (pose === 'slump') {
    d = [
      limb([[-40, -2, 18], [0, -6, 16], [30, -4, 12], [60, -2, 9]]),
      blob([[-58, -30], [-40, -46], [-12, -44], [-2, -20], [-20, -6], [-48, -8]]),
      blob([[-70, -52], [-60, -66], [-44, -64], [-42, -48], [-56, -42]]),
      limb([[-20, -30, 10], [4, -20, 8], [24, -10, 5]]),
    ];
  } else if (pose === 'crouch') {
    d = [
      limb([[-8, -60, 16], [-26, -32, 13], [-14, -2, 9], [-24, 0, 5]]),
      limb([[8, -60, 16], [22, -36, 13], [16, -4, 9], [26, 0, 5]]),
      blob([[-20, -110], [0, -116], [18, -108], [20, -76], [12, -56], [-14, -56], [-22, -80]]),
      blob([[-12, -118], [-12, -134], [0, -142], [12, -134], [12, -118], [0, -112]]),
      limb([[-18, -104, 10], [-30, -80, 8], [-14, -66, 6]]),
      limb([[18, -104, 10], [30, -84, 8], [22, -70, 6]]),
    ];
  } else {
    d = [
      limb([[-8, -92, 15], [-10, -50, 12], [-10, -6, 9], [-18, 0, 5]]),
      limb([[8, -92, 15], [10, -50, 12], [10, -6, 9], [18, 0, 5]]),
      blob([[-20, -150], [0, -156], [20, -150], [22, -124], [14, -92], [-14, -92], [-22, -124]]),
      limb([[-20, -146, 10], [-26, -116, 8], [-28, -84, 6]]),
      limb([[20, -146, 10], [26, -116, 8], [28, -84, 6]]),
      limb([[0, -154, 9], [0, -160, 8]]),
      blob([[-11, -162], [-12, -178], [0, -186], [12, -178], [11, -162], [0, -156]]),
    ];
  }
  return {
    d: Math.hypot(x, floor + 1, z),
    el: (
      <g transform={`translate(${px.toFixed(1)} ${py.toFixed(1)}) scale(${s.toFixed(4)})`}>
        <ellipse cx={0} cy={0} rx={pose === 'slump' ? 80 : 40} ry={10} fill="url(#cw-ao)" />
        {d.map((p, i) => (
          <g key={i}>
            <path d={p} fill={rim} transform="translate(-1.5 -1.5)" opacity={0.6} />
            <path d={p} fill={color} />
          </g>
        ))}
      </g>
    ),
  };
}

export function vignette(key: string): RoomArt | null {
  switch (key) {
    case 'hull': {
      const b = corridor({ lamp: '#cfe8ff', lampI: 0.6, door: 'shut', doorGlow: RED, seed: 3 });
      b.sc.light([-1.8, 0.8, 4.5], '#ffb547', 0.6, 1.2);
      // Buckled ribs: a strut hanging loose.
      b.sc.poly([[-2.2, 1.5, 4], [-1.9, 1.5, 4.2], [0.6, -1.2, 4.9], [0.3, -1.3, 4.7]], mat('#56606d', { spec: 0.5 }), { n: [0, 0.5, -0.9] });
      return { built: b, look: look('#9fd6ff', { hazeO: 0.06 }), over: <Cracks /> };
    }
    case 'box': {
      const b = corridor({ lamp: '#ffe2b0', lampI: 0.8, door: 'shut', doorGlow: '#ffb547', seed: 5 });
      // An open crate spilling supplies, lit from above.
      b.sc.box([-0.7, b.floor, 3.4], [0.7, b.floor + 0.7, 4.3], mat('#5a4b33', { jitter: 0.2 }), { skip: ['top'], split: 2 });
      b.sc.poly([[-0.66, b.floor + 0.62, 3.44], [0.66, b.floor + 0.62, 3.44], [0.66, b.floor + 0.62, 4.26], [-0.66, b.floor + 0.62, 4.26]], mat('#15120e'), { n: [0, 1, 0] });
      b.sc.poly([[-0.72, b.floor + 0.7, 4.3], [0.72, b.floor + 0.7, 4.3], [0.72, b.floor + 1.05, 4.75], [-0.72, b.floor + 1.05, 4.75]], mat('#4a3d2a', { jitter: 0.2 }), { n: [0, 0.6, -0.8] });
      b.sc.box([-0.45, b.floor + 0.62, 3.6], [-0.1, b.floor + 0.8, 3.9], mat('#a83226'));
      b.sc.box([0.05, b.floor + 0.62, 3.7], [0.45, b.floor + 0.76, 4], mat('#c8d0d8'));
      b.sc.box([-0.2, b.floor + 0.62, 4], [0.15, b.floor + 0.72, 4.2], mat('#2e5a3a'));
      b.sc.box([0.7, b.floor, 3.1], [0.95, b.floor + 0.08, 3.3], mat('#c8d0d8'));
      b.sc.light([0, 0.4, 3], '#ffe2b0', 1.2, 1.4);
      b.cones.push({ p: [0, 1.44, 3.6], w: 0.9, color: '#ffe2b0', o: 0.2, spread: 0.5 });
      return { built: b, look: look('#ffb547', { hazeO: 0.06 }) };
    }
    case 'speaker': {
      const b = corridor({ lamp: '#b18cff', lampI: 0.4, door: 'shut', doorGlow: '#b18cff', seed: 7 });
      // An intercom grille on the wall ahead, humming.
      const iz = 5.2;
      b.sc.box([-0.45, -0.5, iz], [0.45, 0.6, iz + 0.12], mat('#3a414b', { spec: 0.4 }));
      for (let i = 0; i < 7; i++) b.sc.box([-0.35, -0.4 + i * 0.12, iz - 0.02], [0.35, -0.34 + i * 0.12, iz], mat('#12151a'));
      b.sc.box([0.3, 0.45, iz - 0.02], [0.38, 0.53, iz], glowMat('#b18cff', 1.8));
      b.sc.box([-2.2, b.floor, iz + 0.1], [2.2, b.ceil, iz + 0.14], mat('#2e3440', { jitter: 0.2 }), { split: 3 });
      b.sc.light([0, 0.2, iz - 0.8], '#b18cff', 0.9, 1);
      const [sx, sy] = P([0, 0.05, iz]);
      return {
        built: b,
        look: look('#b18cff', { hazeO: 0.08 }),
        over: (
          <g fill="none" stroke="#d9c4ff" strokeLinecap="round">
            {[50, 75, 105, 140].map((r, i) => (
              <g key={r}>
                <path d={`M${sx + r} ${sy - r * 0.8} A${r} ${r} 0 0 1 ${sx + r} ${sy + r * 0.8}`} strokeWidth={2.5 - i * 0.4} opacity={0.55 - i * 0.1} />
                <path d={`M${sx - r} ${sy - r * 0.8} A${r} ${r} 0 0 0 ${sx - r} ${sy + r * 0.8}`} strokeWidth={2.5 - i * 0.4} opacity={0.55 - i * 0.1} />
              </g>
            ))}
          </g>
        ),
      };
    }
    case 'light': {
      const b = corridor({ lamp: '#fff1c4', lampI: 1.1, door: 'open', doorGlow: '#ffd27f', seed: 9 });
      return { built: b, look: look('#ffd27f', { hazeO: 0.1, dust: '#fff1c4' }) };
    }
    case 'photo': {
      const b = shell({ lamp: '#ffe2bd', lampI: 0.5, door: 'none', back: 5.5, hw: 2.4, ceil: 1.4, seed: 11 });
      // A photograph taped to the wall, lit by a hand torch.
      const z = b.back - 0.03;
      b.sc.box([-0.55, -0.35, z - 0.01], [0.55, 0.45, z], mat('#e8dcc4'));
      b.sc.poly([[-0.48, -0.25, z - 0.012], [0.48, -0.25, z - 0.012], [0.48, 0.38, z - 0.012], [-0.48, 0.38, z - 0.012]], mat('#6b5a44', { jitter: 0.2 }), { n: [0, 0, -1] });
      b.sc.light([0.2, 0, 3.6], '#fff1d8', 1.4, 1.2);
      const [px, py] = P([0, 0.05, z]);
      const s = scaleAt(z);
      return {
        built: b,
        look: look('#ffb547', { hazeO: 0.05, vignette: 0.95 }),
        over: (
          <g>
            {[-0.22, 0.02, 0.24].map((dx, i) => (
              <g key={i} transform={`translate(${px + dx * s} ${py + 0.12 * s})`}>
                <circle cx={0} cy={-0.16 * s} r={0.07 * s} fill="#2a2219" />
                <path d={`M${-0.11 * s} ${0.1 * s} Q0 ${-0.12 * s} ${0.11 * s} ${0.1 * s} Z`} fill="#2a2219" />
              </g>
            ))}
            <rect x={px - 0.55 * s} y={py - 0.45 * s} width={1.1 * s} height={0.08 * s} fill="#d8cfa0" opacity={0.6} transform={`rotate(-8 ${px} ${py})`} />
          </g>
        ),
      };
    }
    case 'vent': {
      const b = shell({ lamp: null, door: 'none', back: 4, hw: 1.6, ceil: 1.2, seed: 13, fittings: null, runners: null, cables: 1 });
      // A vent opening, its cover torn off and lying on the floor, and eyes in the dark behind it.
      const z = b.back - 0.02;
      b.sc.box([-0.9, -0.6, z - 0.08], [0.9, 0.6, z], mat('#3a414b', { spec: 0.4 }), { skip: ['back'] });
      b.sc.poly([[-0.8, -0.5, z - 0.09], [0.8, -0.5, z - 0.09], [0.8, 0.5, z - 0.09], [-0.8, 0.5, z - 0.09]], mat('#030304'), { n: [0, 0, -1] });
      b.sc.box([-0.7, b.floor, 2.6], [0.9, b.floor + 0.04, 3.4], mat('#59616d', { spec: 0.5 }));
      for (let i = 0; i < 7; i++) b.sc.box([-0.65 + i * 0.22, b.floor + 0.04, 2.65], [-0.55 + i * 0.22, b.floor + 0.06, 3.35], mat('#2a2f36'));
      b.sc.light([0.5, 0.3, 1.8], '#ff9c6b', 0.8, 1.6);
      const [ex, ey] = P([0.1, 0.05, z]);
      return {
        built: b,
        look: look('#ff9c6b', { hazeO: 0.04, vignette: 0.97 }),
        over: (
          <g>
            {[
              [-10, 0],
              [12, -2],
            ].map(([dx, dy], i) => (
              <g key={i}>
                <circle cx={ex + dx!} cy={ey + dy!} r={9} fill={RED} opacity={0.25} />
                <circle cx={ex + dx!} cy={ey + dy!} r={2.2} fill="#ffe4e6" />
              </g>
            ))}
          </g>
        ),
      };
    }
    case 'eye': {
      const b = corridor({ lamp: '#ff3b4e', lampI: 0.15, door: 'open', doorGlow: '#300', seed: 15 });
      for (const L of b.sc.lights) L.i *= 0.4;
      b.sc.light([0, -0.4, 1.4], '#9fb8ff', 0.5, 1.5);
      const rnd = seeded(41);
      return {
        built: b,
        look: look(RED, { hazeO: 0.04, vignette: 0.98 }),
        over: (
          <g>
            {Array.from({ length: 6 }, (_, i) => {
              const z = 4.5 + rnd() * 4.5;
              const [x, y] = P([(rnd() - 0.5) * 3.2, -0.6 + rnd() * 1.4, z]);
              const m = scaleAt(z);
              const gap = 0.07 * m;
              return (
                <g key={i}>
                  {[-1, 1].map((sd) => (
                    <g key={sd}>
                      <circle cx={x + sd * gap} cy={y} r={0.06 * m} fill={RED} opacity={0.3} />
                      <circle cx={x + sd * gap} cy={y} r={0.016 * m} fill="#ffe4e6" />
                    </g>
                  ))}
                </g>
              );
            })}
          </g>
        ),
      };
    }
    case 'door': {
      const b = shell({ lamp: '#ffcf7a', lampI: 0.6, door: 'shut', doorGlow: '#ffb547', back: 5, hw: 2.2, ceil: 1.6, seed: 17 });
      // Claw marks gouged into the door.
      const [dx, dy] = P([0, -0.4, b.back - 0.03]);
      const s = scaleAt(b.back);
      return {
        built: b,
        look: look('#ffb547', { hazeO: 0.06 }),
        over: (
          <g stroke="#0a0a0a" strokeWidth={0.05 * s} strokeLinecap="round" opacity={0.85}>
            {[-0.2, -0.05, 0.1, 0.25].map((o, i) => (
              <path key={i} d={`M${dx + o * s} ${dy - 0.9 * s} q${0.08 * s} ${0.5 * s} ${-0.05 * s} ${1.1 * s}`} />
            ))}
          </g>
        ),
      };
    }
    case 'fire': {
      const b = corridor({ lamp: '#ff7a2a', lampI: 0.3, door: 'open', doorGlow: '#ff7a2a', seed: 19 });
      return dressRoom({ built: b, look: look('#ff7a2a') }, ['fire'], []);
    }
    case 'dark': {
      const b = corridor({ lamp: '#9fb8ff', lampI: 0.6, door: 'open', doorGlow: '#223', seed: 21 });
      return dressRoom({ built: b, look: look('#7fb2ff') }, ['dark'], []);
    }
    case 'breach': {
      const b = corridor({ lamp: '#9fc8ff', lampI: 0.5, door: 'shut', doorGlow: RED, seed: 23 });
      return dressRoom({ built: b, look: look('#9fc8ff') }, ['breach'], []);
    }
    case 'pipe': {
      const b = corridor({ lamp: '#9fe8ff', lampI: 0.6, door: 'shut', doorGlow: '#ffb547', seed: 25 });
      const pipe = mat('#6d5f4c', { spec: 0.5 });
      b.sc.pipeZ(-1.7, 1.1, 1, 10, 0.16, pipe);
      b.sc.pipeZ(1.6, 1.15, 1, 10, 0.12, mat('#5b7a8a', { spec: 0.5 }));
      const [sx, sy] = P([-1.7, 1, 4.5]);
      return {
        built: b,
        look: look('#9fe8ff', { hazeO: 0.12, dust: '#e8fbff' }),
        over: (
          <g style={{ mixBlendMode: 'screen' }}>
            <defs>
              <radialGradient id="steam-g" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#e8fbff" stopOpacity={0.5} />
                <stop offset="1" stopColor="#e8fbff" stopOpacity={0} />
              </radialGradient>
            </defs>
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse key={i} cx={sx + 20 + i * 28} cy={sy + 30 + i * 22} rx={30 + i * 18} ry={22 + i * 12} fill="url(#steam-g)" />
            ))}
          </g>
        ),
      };
    }
    case 'body': {
      const b = corridor({ lamp: '#cfe8ff', lampI: 0.6, door: 'shut', doorGlow: RED, seed: 27 });
      const p = person(-0.3, 3.8, 'slump', '#15171c', '#9fb8d8');
      b.sc.sprite(p.d, p.el);
      const f = onFloor(0.2, 4.1);
      return {
        built: b,
        look: look('#9fb8d8', { hazeO: 0.05 }),
        over: <ellipse cx={f.x + 10} cy={f.y + 4} rx={f.s * 0.6} ry={f.s * 0.12} fill="#3a0508" opacity={0.8} />,
      };
    }
    case 'wall': {
      const b = shell({ lamp: '#cfe8ff', lampI: 0.4, door: 'none', back: 5, hw: 2.4, ceil: 1.5, seed: 29 });
      b.sc.light([0.6, -0.2, 2.2], '#fff1d8', 1.2, 1.4);
      const [cx, cy] = P([0, 0.1, b.back - 0.02]);
      const s = scaleAt(b.back);
      return {
        built: b,
        look: look('#ffb547', { hazeO: 0.05, vignette: 0.95 }),
        over: (
          <text x={cx} y={cy} textAnchor="middle" fontFamily="'Chakra Petch', sans-serif" fontWeight={700} fontSize={0.5 * s} fill="#a3121f" opacity={0.95} transform={`rotate(-4 ${cx} ${cy})`} letterSpacing={0.05 * s}>
            IT’S OUT
          </text>
        ),
      };
    }
    case 'survivor': {
      const b = corridor({ lamp: '#ffe2b0', lampI: 0.4, door: 'shut', doorGlow: '#6be38f', seed: 31 });
      const p = person(0.6, 4.2, 'crouch', '#1a1d22', '#6be38f');
      b.sc.sprite(p.d, p.el);
      b.sc.light([0.6, -0.6, 3.4], '#fff1d8', 0.9, 1);
      return { built: b, look: look('#6be38f', { hazeO: 0.05 }) };
    }
    case 'spores': {
      const b = corridor({ lamp: '#ffe07a', lampI: 0.9, door: 'open', doorGlow: '#d8ff7f', seed: 33 });
      const rnd = seeded(8);
      return {
        built: b,
        look: look('#ffd24a', { hazeO: 0.2, dust: '#fff0a0', grade: '#ffcc33', gradeO: 0.14 }),
        over: (
          <g style={{ mixBlendMode: 'screen' }}>
            {Array.from({ length: 70 }, (_, i) => (
              <circle key={i} cx={rnd() * 600} cy={60 + rnd() * 480} r={0.8 + rnd() * 2.2} fill="#ffe98a" opacity={0.3 + rnd() * 0.6} />
            ))}
          </g>
        ),
      };
    }
    case 'room': {
      const b = corridor({ lamp: '#cfe8ff', lampI: 0.7, door: 'open', doorGlow: '#5ce1e6', seed: 35 });
      return { built: b, look: look('#5ce1e6', { hazeO: 0.06 }) };
    }
    case 'wire': {
      const b = corridor({ lamp: '#ffcf7a', lampI: 0.3, door: 'shut', doorGlow: '#ffb547', seed: 37 });
      b.sc.light([0.4, 0.8, 3.6], '#9fe8ff', 1.2, 1);
      const [x, y] = P([0.4, 1.3, 3.6]);
      return {
        built: b,
        look: look('#ffb547', { hazeO: 0.06 }),
        over: (
          <g>
            <path d={`M${x - 40} ${y - 120} Q${x - 10} ${y - 40} ${x} ${y} M${x + 50} ${y - 120} Q${x + 20} ${y - 50} ${x + 6} ${y + 4}`} stroke="#0a0b0d" strokeWidth={5} fill="none" />
            <g stroke="#dffcff" strokeWidth={1.6} fill="none" style={{ mixBlendMode: 'screen' }}>
              <path d={`M${x} ${y} l12 -8 l-4 14 l16 -6`} />
              <path d={`M${x + 4} ${y + 2} l-14 10 l8 2 l-12 14`} />
            </g>
            <circle cx={x + 3} cy={y + 2} r={26} fill="#9fe8ff" opacity={0.3} style={{ mixBlendMode: 'screen' }} />
          </g>
        ),
      };
    }
    case 'log': {
      const b = corridor({ lamp: '#b18cff', lampI: 0.3, door: 'shut', doorGlow: '#b18cff', seed: 39 });
      // A datapad on the floor, screen lit.
      b.sc.box([-0.25, b.floor, 3], [0.25, b.floor + 0.03, 3.35], mat('#1d2126'));
      b.sc.poly([[-0.21, b.floor + 0.031, 3.03], [0.21, b.floor + 0.031, 3.03], [0.21, b.floor + 0.031, 3.32], [-0.21, b.floor + 0.031, 3.32]], glowMat('#b18cff', 1.2), { n: [0, 1, 0] });
      b.sc.light([0, b.floor + 0.4, 3.1], '#b18cff', 0.9, 0.7);
      return { built: b, look: look('#b18cff', { hazeO: 0.06 }) };
    }
    case 'truth': {
      const b = shell({ lamp: null, door: 'none', back: 6, hw: 2.8, ceil: 1.6, seed: 43 });
      for (let i = 0; i < 9; i++) {
        const x = -1.8 + (i % 3) * 1.8;
        const y = -0.6 + Math.floor(i / 3) * 0.75;
        b.sc.box([x - 0.75, y - 0.3, b.back - 0.05], [x + 0.75, y + 0.3, b.back], mat('#1c2027'));
        b.sc.poly([[x - 0.7, y - 0.26, b.back - 0.06], [x + 0.7, y - 0.26, b.back - 0.06], [x + 0.7, y + 0.26, b.back - 0.06], [x - 0.7, y + 0.26, b.back - 0.06]], glowMat(i === 4 ? '#ffe4e6' : '#b18cff', i === 4 ? 0.8 : 0.35), { n: [0, 0, -1] });
      }
      b.sc.light([0, 0, 4.5], '#b18cff', 1.3, 2);
      const p = person(0, 3.3, 'stand', '#0c0d10', '#d9c4ff');
      b.sc.sprite(p.d, p.el);
      return { built: b, look: look('#b18cff', { hazeO: 0.1 }) };
    }
    case 'panic': {
      const c = creatureScene('changed');
      return { ...c, look: { ...c.look, grade: '#ff0030', gradeO: 0.3, vignette: 1 }, over: <PanicBlur /> };
    }
    case 'scan': {
      const b = shell({ lamp: '#9fe8ff', lampI: 0.5, door: 'shut', doorGlow: '#5ce1e6', back: 6.5, seed: 45 });
      const p = person(0, 4.2, 'stand', '#0f1216', '#5ce1e6');
      b.sc.sprite(p.d, p.el);
      b.sc.lathe(0, 4.2, [[b.floor, 0.7], [b.floor + 0.05, 0.7], [b.floor + 0.05, 0]], glowMat('#5ce1e6', 0.9), 20);
      b.sc.lathe(0, 4.2, [[1.3, 0], [1.3, 0.7], [1.35, 0.7]], glowMat('#5ce1e6', 0.9), 20);
      b.sc.light([0, 0, 3.4], '#5ce1e6', 1, 1.4);
      const [x0, y0] = P([-0.7, b.floor, 4.2]);
      const [x1, y1] = P([0.7, 1.3, 4.2]);
      return {
        built: b,
        look: look('#5ce1e6', { hazeO: 0.08 }),
        over: (
          <g style={{ mixBlendMode: 'screen' }}>
            <rect x={x0} y={y1} width={x1 - x0} height={y0 - y1} fill="#5ce1e6" opacity={0.08} />
            {Array.from({ length: 8 }, (_, i) => (
              <line key={i} x1={x0} x2={x1} y1={y1 + ((y0 - y1) * (i + 0.5)) / 8} y2={y1 + ((y0 - y1) * (i + 0.5)) / 8} stroke="#9ff6f8" strokeOpacity={i === 3 ? 0.8 : 0.2} strokeWidth={i === 3 ? 2 : 1} />
            ))}
          </g>
        ),
      };
    }
    case 'infection': {
      return { look: look('#b0ff8f', { bg: '#07050a', hazeO: 0.05, vignette: 0.95 }), under: <Veins /> };
    }
    case 'alarm': {
      const b = corridor({ lamp: RED, lampI: 0.8, door: 'shut', doorGlow: RED, seed: 47 });
      for (const z of [3, 6]) {
        b.sc.lathe(1.9, z, [[1.2, 0.12], [1.35, 0.12], [1.42, 0]], glowMat(RED, 1.6), 10);
        b.sc.light([1.6, 1.1, z], RED, 1.2, 1.2);
      }
      return { built: b, look: look(RED, { hazeO: 0.14, grade: '#ff0020', gradeO: 0.16, dust: '#ffc2c8' }) };
    }
    case 'end-pods':
      return space({ seed: 3, planet: true, ship: 'far', pod: true });
    case 'end-shuttle':
      return space({ seed: 5, planet: true, ship: 'far', shuttle: true });
    case 'end-beacon': {
      const b = shell({ lamp: '#ffe9c4', lampI: 1.3, door: 'open', doorGlow: '#fff1d8', seed: 51, back: 8 });
      const p = person(0, 6.2, 'stand', '#1a1d22', '#fff1d8');
      b.sc.sprite(p.d, p.el);
      b.sc.light([0, 0.4, 8.6], '#fff1d8', 2, 2.5);
      return { built: b, look: look('#ffe9c4', { hazeO: 0.16, dust: '#fff8e8', grade: '#ffcf8a', gradeO: 0.1 }) };
    }
    case 'end-jump':
      return space({ seed: 7, streaks: true, ship: 'near' });
    case 'end-burn':
      return space({ seed: 9, explosion: true });
    case 'end-lost': {
      const b = shell({ lamp: RED, lampI: 0.25, door: 'shut', doorGlow: RED, seed: 53 });
      for (const [i, z] of [2.6, 4.2, 5.8, 7.4].entries()) {
        const x = i % 2 ? 2.35 : -2.35;
        b.sc.box([x - 0.42, b.floor, z], [x + 0.42, b.floor + 0.22, z + 0.7], mat('#2d333c'));
        b.sc.prism(x, z + 0.4, b.floor + 0.22, b.floor + 2.05, 0.4, mat('#56606e', { spec: 0.5 }), 10, { rz: 0.32 });
      }
      b.sc.light([0, 0.2, 5], RED, 0.6, 2);
      return { built: b, look: look(RED, { hazeO: 0.08, grade: '#ff2436', gradeO: 0.12, vignette: 0.97 }) };
    }
  }
  return null;
}

function Cracks() {
  return (
    <g stroke="#9fd6ff" strokeOpacity={0.35} strokeWidth={1.2} fill="none">
      <path d="M140 120 l30 40 l-10 30 l40 50 M170 160 l40 -10 M420 110 l-20 50 l30 40 l-10 60 M400 160 l-40 20" />
    </g>
  );
}

function PanicBlur() {
  return (
    <g style={{ mixBlendMode: 'screen' }} opacity={0.35}>
      <rect x={-12} y={0} width={600} height={600} fill="#ff0030" opacity={0.1} />
      <circle cx={300} cy={300} r={260} fill="none" stroke="#ff0030" strokeWidth={60} opacity={0.25} />
    </g>
  );
}

function Veins() {
  // A wrist, close up, with the infection spreading under the skin.
  const rnd = seeded(12);
  const veins: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    let x = 300 + (rnd() - 0.5) * 60;
    let y = 330;
    let d = `M${x} ${y}`;
    for (let k = 0; k < 7; k++) {
      x += (rnd() - 0.5) * 70;
      y -= 20 + rnd() * 30;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    veins.push(<path key={i} d={d} stroke="#b0ff8f" strokeWidth={1.2 + rnd() * 1.6} fill="none" opacity={0.7} strokeLinejoin="round" />);
  }
  return (
    <g>
      <defs>
        <linearGradient id="skin" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#1a1412" />
          <stop offset="0.45" stopColor="#5a4038" />
          <stop offset="0.55" stopColor="#6a4c42" />
          <stop offset="1" stopColor="#1a1412" />
        </linearGradient>
        <radialGradient id="inf-glow" cx="0.5" cy="0.6" r="0.5">
          <stop offset="0" stopColor="#b0ff8f" stopOpacity={0.35} />
          <stop offset="1" stopColor="#b0ff8f" stopOpacity={0} />
        </radialGradient>
      </defs>
      <path d="M200 620 C220 460 230 300 250 60 L360 40 C370 280 380 460 420 620 Z" fill="url(#skin)" />
      <ellipse cx={305} cy={300} rx={140} ry={220} fill="url(#inf-glow)" style={{ mixBlendMode: 'screen' }} />
      <g style={{ mixBlendMode: 'screen' }}>{veins}</g>
      <path d="M250 330 C280 340 330 340 368 328" stroke="#0a0706" strokeWidth={3} opacity={0.5} fill="none" />
    </g>
  );
}

// ── space ──────────────────────────────────────────────────────────────

function space(o: { seed: number; planet?: boolean; ship?: 'far' | 'near'; pod?: boolean; shuttle?: boolean; streaks?: boolean; explosion?: boolean }): RoomArt {
  const rnd = seeded(o.seed);
  const under: ReactNode[] = [];
  under.push(
    <defs key="d">
      <radialGradient id={`neb${o.seed}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#6a3aa8" stopOpacity={0.35} />
        <stop offset="1" stopColor="#6a3aa8" stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`neb2${o.seed}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#1f7a8a" stopOpacity={0.3} />
        <stop offset="1" stopColor="#1f7a8a" stopOpacity={0} />
      </radialGradient>
      <radialGradient id={`pl${o.seed}`} cx="0.3" cy="0.25" r="0.8">
        <stop offset="0" stopColor="#9fd8ff" />
        <stop offset="0.35" stopColor="#3a7fc4" />
        <stop offset="0.75" stopColor="#0c2340" />
        <stop offset="1" stopColor="#02060d" />
      </radialGradient>
      <radialGradient id={`boom${o.seed}`} cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.15" stopColor="#fff1c4" />
        <stop offset="0.35" stopColor="#ffb547" stopOpacity={0.85} />
        <stop offset="0.65" stopColor="#ff4d1a" stopOpacity={0.35} />
        <stop offset="1" stopColor="#ff4d1a" stopOpacity={0} />
      </radialGradient>
    </defs>,
  );
  under.push(<rect key="bg" width={600} height={600} fill="#010208" />);
  under.push(<ellipse key="n1" cx={180 + rnd() * 100} cy={200 + rnd() * 100} rx={260} ry={160} fill={`url(#neb${o.seed})`} transform={`rotate(${-20 + rnd() * 40} 300 300)`} />);
  under.push(<ellipse key="n2" cx={380 + rnd() * 80} cy={320 + rnd() * 80} rx={220} ry={130} fill={`url(#neb2${o.seed})`} transform={`rotate(${-20 + rnd() * 40} 300 300)`} />);
  under.push(<g key="st">{stars(o.seed * 13, 260, [0, 0, 600, 600])}</g>);
  if (o.streaks) {
    const r2 = seeded(o.seed + 1);
    under.push(
      <g key="streaks" stroke="#cfe8ff" strokeLinecap="round">
        {Array.from({ length: 90 }, (_, i) => {
          const a = r2() * Math.PI * 2;
          const d0 = 20 + r2() * 120;
          const d1 = d0 + 40 + r2() * 260;
          return <line key={i} x1={300 + Math.cos(a) * d0} y1={280 + Math.sin(a) * d0} x2={300 + Math.cos(a) * d1} y2={280 + Math.sin(a) * d1} strokeWidth={0.6 + r2() * 1.4} opacity={0.2 + r2() * 0.6} />;
        })}
        <circle cx={300} cy={280} r={60} fill="#cfe8ff" opacity={0.2} />
        <circle cx={300} cy={280} r={16} fill="#ffffff" opacity={0.8} />
      </g>,
    );
  }
  if (o.planet) {
    under.push(<circle key="pl" cx={420} cy={560} r={300} fill={`url(#pl${o.seed})`} />);
    under.push(<path key="atm" d="M120 560 A300 300 0 0 1 700 420" stroke="#9fd8ff" strokeOpacity={0.45} strokeWidth={4} fill="none" />);
  }
  if (o.ship) {
    const near = o.ship === 'near';
    const cx = near ? 300 : 210;
    const cy = near ? 300 : 230;
    const k = near ? 1.6 : 0.55;
    under.push(
      <g key="ship" transform={`translate(${cx} ${cy}) scale(${k}) rotate(${near ? 0 : -14})`}>
        <path d="M-160 0 L-120 -18 L60 -22 L120 -12 L150 0 L120 12 L60 22 L-120 18 Z" fill="#1a2230" stroke="#6a7a90" strokeOpacity={0.5} />
        <path d="M-60 -22 L-40 -46 L30 -48 L44 -22 M-60 22 L-40 46 L30 48 L44 22" fill="#141b26" stroke="#6a7a90" strokeOpacity={0.4} />
        {[-80, -50, -20, 10, 40, 70].map((x, i) => (
          <rect key={x} x={x} y={-4} width={8} height={4} fill={i === 2 ? '#ff4d5e' : '#ffd27f'} opacity={0.7} />
        ))}
        <ellipse cx={-168} cy={0} rx={22} ry={12} fill="#5ce1e6" opacity={near ? 0.8 : 0.3} />
        <ellipse cx={-164} cy={0} rx={8} ry={6} fill="#ffffff" opacity={near ? 0.9 : 0.4} />
      </g>,
    );
  }
  if (o.pod) {
    under.push(
      <g key="pod" transform="translate(360 330) rotate(24)">
        <ellipse cx={0} cy={0} rx={40} ry={24} fill="#2a3440" stroke="#9fb0c4" strokeOpacity={0.6} strokeWidth={1.5} />
        <ellipse cx={-12} cy={-4} rx={12} ry={9} fill="#9fe8ff" opacity={0.8} />
        <path d="M34 -8 L60 -4 L60 4 L34 8" fill="#1a222c" />
        <ellipse cx={70} cy={0} rx={26} ry={9} fill="#5ce1e6" opacity={0.45} />
        <ellipse cx={64} cy={0} rx={10} ry={5} fill="#ffffff" opacity={0.85} />
      </g>,
    );
  }
  if (o.shuttle) {
    under.push(
      <g key="sh" transform="translate(380 330) rotate(-12) scale(1.2)">
        <path d="M-60 0 L-30 -14 L40 -12 L60 -4 L60 4 L40 12 L-30 14 Z" fill="#8a939f" />
        <path d="M-30 -14 L-10 -40 L20 -40 L30 -12 M-30 14 L-10 40 L20 40 L30 12" fill="#39414c" />
        <path d="M-58 0 L-40 -8 L-26 -8 L-26 0 Z" fill="#9fe8ff" opacity={0.8} />
        <ellipse cx={74} cy={0} rx={30} ry={8} fill="#5ce1e6" opacity={0.5} />
        <ellipse cx={66} cy={0} rx={12} ry={4} fill="#ffffff" />
      </g>,
    );
  }
  if (o.explosion) {
    const r3 = seeded(o.seed + 5);
    under.push(<circle key="b1" cx={300} cy={270} r={250} fill={`url(#boom${o.seed})`} />);
    under.push(
      <g key="rays" stroke="#fff1c4" strokeLinecap="round" style={{ mixBlendMode: 'screen' }}>
        {Array.from({ length: 36 }, (_, i) => {
          const a = r3() * Math.PI * 2;
          const d1 = 90 + r3() * 220;
          return <line key={i} x1={300} y1={270} x2={300 + Math.cos(a) * d1} y2={270 + Math.sin(a) * d1} strokeWidth={0.5 + r3() * 2} opacity={0.2 + r3() * 0.4} />;
        })}
      </g>,
    );
    under.push(
      <g key="debris" fill="#1a1410">
        {Array.from({ length: 22 }, (_, i) => {
          const a = r3() * Math.PI * 2;
          const d = 120 + r3() * 180;
          const x = 300 + Math.cos(a) * d;
          const y = 270 + Math.sin(a) * d;
          const s = 3 + r3() * 9;
          return <polygon key={i} points={`${x},${y} ${x + s},${y + s * 0.4} ${x + s * 0.3},${y + s}`} />;
        })}
      </g>,
    );
    under.push(<circle key="core" cx={300} cy={270} r={34} fill="#ffffff" />);
  }
  return {
    look: { bg: '#010208', haze: o.explosion ? '#ffb547' : '#5ca8ff', hazeO: 0.04, vignette: 0.9, grade: o.explosion ? '#ff8a2a' : '#5ca8ff', gradeO: 0.08 },
    under,
  };
}
