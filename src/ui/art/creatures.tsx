import type { ReactNode } from 'react';
import type { CreatureKind } from '../../game/types';
import { P, scaleAt } from './kit3d';

// The creatures are painted, not modelled: silhouettes built from a skeleton
// of tapered limbs, backlit so a rim of light runs round every edge, with a
// wet sheen, glowing eyes and a shadow under their feet. They are drawn in a
// local space where 100 units is a metre and y = 0 is the floor, then placed
// into a scene at a depth.

type Pt = [number, number, number];

/** A smooth tapered limb through points [x, y, width]. */
export function limb(pts: Pt[]): string {
  const n = pts.length;
  const L: [number, number][] = [];
  const R: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const [x, y, w] = pts[i]!;
    const a = pts[Math.max(0, i - 1)]!;
    const b = pts[Math.min(n - 1, i + 1)]!;
    let dx = b[0] - a[0];
    let dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1;
    dx /= l;
    dy /= l;
    L.push([x - dy * (w / 2), y + dx * (w / 2)]);
    R.push([x + dy * (w / 2), y - dx * (w / 2)]);
  }
  const side = (ps: [number, number][]) => {
    let d = '';
    for (let i = 0; i < ps.length - 1; i++) {
      const p0 = ps[Math.max(0, i - 1)]!;
      const p1 = ps[i]!;
      const p2 = ps[i + 1]!;
      const p3 = ps[Math.min(ps.length - 1, i + 2)]!;
      const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
    }
    return d;
  };
  const Rr = R.slice().reverse();
  const end = pts[n - 1]!;
  const start = pts[0]!;
  return `M${f(L[0]![0])} ${f(L[0]![1])}${side(L)} Q${f(end[0] + (L[n - 1]![0] - end[0]) * 0 + (end[0] - pts[n - 2]![0]) * 0.35)} ${f(end[1] + (end[1] - pts[n - 2]![1]) * 0.35)} ${f(Rr[0]![0])} ${f(Rr[0]![1])}${side(Rr)} Q${f(start[0] - (pts[1]![0] - start[0]) * 0.35)} ${f(start[1] - (pts[1]![1] - start[1]) * 0.35)} ${f(L[0]![0])} ${f(L[0]![1])}Z`;
}

function f(n: number): string {
  return n.toFixed(1);
}

/** A closed smooth blob through points. */
export function blob(ps: [number, number][]): string {
  const n = ps.length;
  let d = `M${f(ps[0]![0])} ${f(ps[0]![1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = ps[(i - 1 + n) % n]!;
    const p1 = ps[i]!;
    const p2 = ps[(i + 1) % n]!;
    const p3 = ps[(i + 2) % n]!;
    d += ` C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return `${d}Z`;
}

interface Part {
  d: string;
  /** Slightly lighter, for limbs nearer the light. */
  tone?: number;
}

interface Design {
  /** Back to front. */
  parts: Part[];
  eyes: [number, number, number][];
  eyeColor: string;
  /** Wet highlights, as strokes. */
  sheen: string[];
  /** Glowing lines under the skin (veins, seams). */
  veins?: string[];
  veinColor?: string;
  /** Width of the shadow at its feet, units. */
  foot: number;
  height: number;
  /** Colour of the light behind it. */
  rim: string;
  body: [string, string];
  extra?: ReactNode;
}

function claws(x: number, y: number, dir: number, len = 22): Part[] {
  return [-0.5, 0, 0.5].map((a) => ({
    d: limb([
      [x, y, 4],
      [x + Math.sin(a + dir * 0.2) * len * 0.5, y + Math.cos(a) * len * 0.5, 2.6],
      [x + Math.sin(a + dir * 0.35) * len, y + Math.cos(a) * len * 0.95, 0.6],
    ]),
  }));
}

const DESIGNS: Record<CreatureKind, () => Design> = {
  stalker: () => ({
    height: 250,
    foot: 90,
    rim: '#ff5a6a',
    body: ['#191b21', '#07080a'],
    eyeColor: '#ffe0a0',
    eyes: [],
    parts: [
      { d: limb([[10, -96, 15], [42, -74, 11], [72, -66, 8], [96, -82, 6], [106, -112, 4], [96, -134, 2.5], [80, -140, 1]]) },
      { d: limb([[8, -98, 22], [26, -60, 15], [10, -26, 9], [20, -4, 6], [36, 0, 3]]) },
      { d: limb([[16, -172, 13], [36, -134, 9], [44, -98, 7], [46, -74, 4]]) },
      ...claws(46, -74, 1),
      {
        d: blob([
          [-24, -182],
          [-6, -192],
          [18, -186],
          [30, -166],
          [26, -134],
          [16, -104],
          [-14, -100],
          [-26, -126],
          [-32, -156],
        ]),
      },
      // Spines along the back.
      ...[0, 1, 2, 3, 4].map((i) => ({ d: limb([[20 + i * 2, -180 + i * 16, 8], [34 + i * 3, -188 + i * 16, 4], [44 + i * 2, -190 + i * 15, 0.5]]) })),
      { d: limb([[-8, -98, 23], [-32, -58, 16], [-14, -24, 9], [-24, -4, 6], [-44, 0, 3]]), tone: 1 },
      { d: limb([[-20, -176, 14], [-42, -142, 10], [-54, -104, 7], [-52, -76, 4]]), tone: 1 },
      ...claws(-52, -76, -1),
      { d: limb([[-6, -180, 15], [-10, -196, 11], [-8, -206, 9]]) },
      // The long skull, swept back.
      {
        d: blob([
          [-22, -198],
          [-26, -212],
          [-16, -228],
          [4, -238],
          [34, -252],
          [66, -266],
          [84, -270],
          [70, -254],
          [42, -232],
          [18, -212],
          [4, -198],
          [-8, -192],
        ]),
      },
      // Jaw, hanging open.
      { d: limb([[-4, -196, 9], [-18, -190, 7], [-28, -184, 3]]) },
    ],
    sheen: ['M-18 -226 C0 -240 30 -254 70 -266', 'M-24 -172 C-30 -150 -28 -128 -18 -110', 'M-36 -60 C-26 -44 -20 -34 -16 -26'],
    veins: ['M-26 -205 l3 5 M-22 -203 l3 6 M-18 -201 l2 6 M-14 -199 l2 5'],
    veinColor: '#f2e6d0',
  }),
  crawler: () => ({
    height: 60,
    foot: 150,
    rim: '#ff6a5a',
    body: ['#1e1a1c', '#08070a'],
    eyeColor: '#ff3b4e',
    eyes: [
      [-30, -34, 2.4],
      [-24, -38, 2],
      [-36, -30, 1.8],
      [-22, -31, 1.6],
    ],
    parts: [
      // Far legs.
      ...[0, 1, 2, 3].map((i) => ({ d: limb([[4 + i * 8, -26, 6], [30 + i * 14, -60 + i * 4, 4.5], [60 + i * 16, -8 + i * 2, 2.5], [66 + i * 16, 0, 1]]) })),
      // Swollen abdomen.
      { d: blob([[6, -30], [30, -46], [60, -44], [74, -28], [62, -12], [30, -10], [8, -16]]) },
      // Body and head.
      { d: blob([[-44, -30], [-36, -44], [-14, -46], [8, -38], [12, -22], [-6, -14], [-30, -16]]), tone: 1 },
      // Mandibles.
      { d: limb([[-40, -24, 5], [-54, -18, 3], [-58, -8, 1]]), tone: 1 },
      { d: limb([[-36, -20, 5], [-44, -10, 3], [-40, -2, 1]]), tone: 1 },
      // Near legs.
      ...[0, 1, 2, 3].map((i) => ({ d: limb([[-18 + i * 8, -22, 7], [-40 - i * 4, -64 + i * 6, 5], [-66 - i * 10, -10 + i * 2, 3], [-70 - i * 10, 0, 1]]), tone: 1 })),
    ],
    sheen: ['M-38 -40 C-26 -46 -10 -46 4 -40', 'M20 -42 C36 -48 54 -46 66 -36'],
    veins: ['M24 -38 C36 -30 48 -30 60 -36', 'M18 -26 C34 -20 50 -20 64 -24'],
    veinColor: '#ff8a5a',
  }),
  changed: () => ({
    height: 190,
    foot: 70,
    rim: '#ffb060',
    body: ['#221c1a', '#09080a'],
    eyeColor: '#ffcf6a',
    eyes: [
      [-22, -166, 2.2],
      [-8, -170, 2],
    ],
    parts: [
      { d: limb([[10, -92, 17], [14, -48, 13], [18, -8, 10], [26, 0, 6]]) },
      // The long arm, dragging.
      { d: limb([[22, -150, 13], [34, -118, 10], [40, -80, 8], [44, -40, 6], [52, -14, 4], [58, -4, 2]]) },
      ...claws(56, -6, 1, 16),
      { d: limb([[-8, -92, 18], [-12, -50, 13], [-10, -8, 10], [-20, 0, 6]]), tone: 1 },
      // Torso, twisted, with a growth on the shoulder.
      { d: blob([[-24, -150], [-4, -158], [20, -156], [26, -130], [20, -96], [-16, -92], [-28, -118]]) },
      { d: blob([[10, -160], [24, -178], [44, -176], [48, -156], [34, -146], [18, -148]]) },
      { d: blob([[22, -172], [30, -190], [42, -186], [40, -172]]) },
      // Near arm, reaching.
      { d: limb([[-22, -148, 12], [-40, -124, 9], [-58, -110, 7], [-76, -106, 4]]), tone: 1 },
      ...[-0.4, 0, 0.4].map((a) => ({ d: limb([[-76, -106, 3.5], [-88, -106 + a * 14, 2], [-96, -104 + a * 22, 0.6]]), tone: 1 })),
      { d: limb([[-2, -156, 11], [-8, -164, 10]]) },
      // Head, lolling to one side.
      { d: blob([[-30, -160], [-32, -176], [-22, -186], [-6, -184], [0, -172], [-4, -160], [-16, -154]]) },
    ],
    sheen: ['M-28 -176 C-22 -184 -12 -186 -4 -182', 'M28 -176 C36 -182 42 -180 46 -170'],
    veins: ['M-6 -150 C-4 -130 4 -118 0 -96', 'M8 -152 C14 -134 10 -118 16 -100', 'M-14 -140 C-24 -124 -40 -118 -56 -112', 'M30 -150 C38 -120 42 -90 44 -50', 'M-2 -90 C-6 -60 -10 -30 -12 -10'],
    veinColor: '#ffb547',
  }),
  drone: () => ({
    height: 200,
    foot: 110,
    rim: '#ff4d5e',
    body: ['#262b33', '#0a0c10'],
    eyeColor: '#ff2436',
    eyes: [[0, -150, 7]],
    parts: [
      // Rear legs.
      { d: limb([[16, -120, 9], [58, -150, 6], [80, -70, 5], [86, 0, 3]]) },
      { d: limb([[-16, -120, 9], [-58, -150, 6], [-80, -70, 5], [-86, 0, 3]]) },
      // Cable tail.
      { d: limb([[8, -110, 6], [30, -90, 5], [40, -50, 4], [30, -14, 3], [12, 0, 2]]) },
      // Chassis.
      { d: `M-34 -178 L34 -178 L42 -160 L38 -118 L20 -104 L-20 -104 L-38 -118 L-42 -160 Z` },
      // Head housing.
      { d: `M-22 -192 L22 -192 L28 -178 L-28 -178 Z`, tone: 1 },
      // Front legs.
      { d: limb([[24, -126, 10], [52, -118, 7], [46, -60, 5], [52, 0, 3]]), tone: 1 },
      { d: limb([[-24, -126, 10], [-52, -118, 7], [-46, -60, 5], [-52, 0, 3]]), tone: 1 },
      // Antenna.
      { d: limb([[16, -190, 3], [22, -214, 2], [24, -226, 1]]) },
    ],
    sheen: ['M-30 -174 L30 -174', 'M-36 -150 L-34 -122', 'M36 -150 L34 -122'],
    veins: ['M-30 -140 L30 -140', 'M-26 -126 L26 -126', 'M-20 -186 L20 -186'],
    veinColor: '#5ce1e6',
    extra: (
      <g>
        <circle cx={0} cy={-150} r={17} fill="#16070a" stroke="#3a4450" strokeWidth={3} />
        <circle cx={0} cy={-150} r={11} fill="#3a060c" />
      </g>
    ),
  }),
  mimic: () => ({
    height: 185,
    foot: 60,
    rim: '#ff6a7a',
    body: ['#1e1c20', '#08070a'],
    eyeColor: '#ffe4e6',
    eyes: [
      [-10, -168, 1.8],
      [12, -170, 1.6],
    ],
    parts: [
      // Extra arms unfolding from the back.
      { d: limb([[10, -150, 8], [44, -176, 6], [66, -200, 4], [74, -226, 2], [70, -238, 0.8]]) },
      { d: limb([[-8, -150, 8], [-40, -178, 6], [-60, -204, 4], [-64, -230, 2], [-58, -240, 0.8]]) },
      { d: limb([[8, -94, 16], [10, -50, 12], [12, -8, 9], [20, 0, 5]]) },
      { d: limb([[-8, -94, 16], [-10, -50, 12], [-12, -8, 9], [-20, 0, 5]]), tone: 1 },
      { d: blob([[-22, -150], [0, -156], [22, -150], [24, -124], [16, -94], [-16, -94], [-24, -124]]) },
      // Arms hanging too long, fingers to the knee.
      { d: limb([[22, -148, 11], [30, -116, 8], [32, -84, 7], [34, -62, 5]]) },
      ...[-1, 0, 1, 2].map((i) => ({ d: limb([[34, -62, 3], [36 + i * 3, -40, 2], [36 + i * 5, -22, 0.6]]) })),
      { d: limb([[-22, -148, 11], [-30, -116, 8], [-32, -84, 7], [-34, -62, 5]]), tone: 1 },
      ...[-1, 0, 1, 2].map((i) => ({ d: limb([[-34, -62, 3], [-36 - i * 3, -40, 2], [-36 - i * 5, -22, 0.6]]), tone: 1 })),
      { d: limb([[0, -154, 10], [0, -162, 9]]) },
      // Head, split down the middle.
      { d: blob([[-18, -164], [-16, -180], [-2, -188], [-1, -170], [-2, -158], [-12, -156]]), tone: 1 },
      { d: blob([[4, -158], [3, -172], [6, -190], [20, -182], [20, -166], [14, -156]]), tone: 1 },
    ],
    sheen: ['M-14 -180 C-10 -186 -6 -188 -2 -186', 'M8 -186 C12 -188 16 -186 18 -180'],
    veins: ['M1 -190 C0 -178 2 -166 1 -154 C0 -140 2 -120 0 -100'],
    veinColor: '#ff9aa6',
  }),
};

let uid = 0;

/**
 * A creature standing on the floor at (x, z). `light` tints its rim; `lean`
 * mirrors it. Returns the node and the depth to sort it at.
 */
export function creatureAt(kind: CreatureKind, x: number, z: number, opts: { floor?: number; flip?: boolean; scale?: number; glow?: number } = {}): { d: number; el: ReactNode } {
  const floor = opts.floor ?? -1.6;
  const [px, py] = P([x, floor, z]);
  const s = (scaleAt(z) / 100) * (opts.scale ?? 1);
  const k = ++uid;
  return { d: Math.hypot(x, floor + 1, z) - 0.2, el: <Creature kind={kind} tx={px} ty={py} s={s} flip={!!opts.flip} k={k} glow={opts.glow ?? 1} /> };
}

function Creature({ kind, tx, ty, s, flip, k, glow }: { kind: CreatureKind; tx: number; ty: number; s: number; flip: boolean; k: number; glow: number }) {
  const d = DESIGNS[kind]();
  const id = `cr${kind}${k}`;
  const erode = Math.max(0.8, 1.6 / s);
  const sheenW = Math.max(0.8, 1.3 / s);
  return (
    <g transform={`translate(${f(tx)} ${f(ty)}) scale(${(flip ? -s : s).toFixed(4)} ${s.toFixed(4)})`}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1={-d.height} x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={d.body[0]} />
          <stop offset="1" stopColor={d.body[1]} />
        </linearGradient>
        <linearGradient id={`${id}-rim`} x1="0" y1={-d.height} x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={d.rim} />
          <stop offset="0.6" stopColor={d.rim} stopOpacity={0.75} />
          <stop offset="1" stopColor={d.rim} stopOpacity={0.25} />
        </linearGradient>
        <radialGradient id={`${id}-back`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={d.rim} stopOpacity={0.5 * glow} />
          <stop offset="1" stopColor={d.rim} stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-eye`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.25" stopColor={d.eyeColor} />
          <stop offset="1" stopColor={d.eyeColor} stopOpacity={0} />
        </radialGradient>
        <filter id={`${id}-in`} x="-10%" y="-10%" width="120%" height="120%">
          <feMorphology operator="erode" radius={erode.toFixed(2)} />
        </filter>
        <clipPath id={`${id}-clip`}>
          {d.parts.map((p, i) => (
            <path key={i} d={p.d} />
          ))}
        </clipPath>
      </defs>
      <ellipse cx={0} cy={-d.height * 0.55} rx={d.foot * 1.3 + 40} ry={d.height * 0.75} fill={`url(#${id}-back)`} />
      <ellipse cx={0} cy={0} rx={d.foot * 0.75} ry={Math.max(6, d.foot * 0.14)} fill="url(#cw-ao)" opacity={0.9} />
      <g clipPath={`url(#${id}-clip)`}>
        <rect x={-d.foot * 2} y={-d.height - 40} width={d.foot * 4} height={d.height + 60} fill={`url(#${id}-rim)`} />
        {d.parts.map((p, i) => (
          <path key={i} d={p.d} fill={p.tone ? d.body[0] : `url(#${id}-body)`} filter={`url(#${id}-in)`} />
        ))}
        {d.veins && (
          <g stroke={d.veinColor} strokeWidth={sheenW * 1.1} fill="none" strokeLinecap="round" opacity={0.75}>
            {d.veins.map((v, i) => (
              <path key={i} d={v} />
            ))}
          </g>
        )}
        <g stroke="#ffffff" strokeOpacity={0.28} strokeWidth={sheenW} fill="none" strokeLinecap="round">
          {d.sheen.map((v, i) => (
            <path key={i} d={v} />
          ))}
        </g>
      </g>
      {d.extra}
      {d.eyes.map(([x, y, r], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r * 5} fill={`url(#${id}-eye)`} opacity={0.8} />
          <circle cx={x} cy={y} r={r * 0.7} fill="#fff" />
        </g>
      ))}
    </g>
  );
}
