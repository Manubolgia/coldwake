import type { ReactNode } from 'react';
import type { RoomType } from '../../game/types';
import { F, P, glowMat, mat, pts2, scaleAt, type V3 } from './kit3d';
import { onFloor, shell, stars, type Built, type Look, type Shell } from './scene';

// One function per compartment. Each builds the room shell with its own
// proportions and light, then furnishes it in 3D. The accent colour of each
// room (from its content definition) tints its lamps and screens.

export interface RoomArt {
  built?: Built;
  look: Look;
  under?: ReactNode;
  over?: ReactNode;
}

const COOL = '#cfe8ff';
const WARM = '#ffd9a8';

function look(accent: string, extra: Partial<Look> = {}): Look {
  return { bg: '#030407', haze: accent, dust: '#dfefff', grade: accent, gradeO: 0.08, ...extra, hazeO: (extra.hazeO ?? 0.07) * 0.6 };
}

/** A console: a desk with a sloped screen facing the viewer. */
function console3d(b: Built, x: number, z: number, w: number, color: string, facing: 'front' | 'left' | 'right' = 'front') {
  const { sc, floor } = b;
  const body = mat('#3b434f', { spec: 0.3, jitter: 0.1 });
  if (facing === 'front') {
    sc.box([x - w / 2, floor, z], [x + w / 2, floor + 0.85, z + 0.6], body);
    // Sloped screen.
    const y0 = floor + 0.85;
    sc.poly([[x - w / 2 + 0.05, y0, z + 0.05], [x + w / 2 - 0.05, y0, z + 0.05], [x + w / 2 - 0.05, y0 + 0.45, z + 0.5], [x - w / 2 + 0.05, y0 + 0.45, z + 0.5]], glowMat(color, 0.45), { n: [0, 0.7, -0.7] });
    for (let k = 1; k < 4; k++) {
      const t = k / 4;
      const a = P([x - w / 2 + 0.12, y0 + 0.45 * t, z + 0.05 + 0.45 * t]);
      const bb = P([x - w / 2 + 0.12 + (w - 0.24) * (0.4 + 0.5 * ((k * 7) % 5) / 5), y0 + 0.45 * t, z + 0.05 + 0.45 * t]);
      sc.sprite(z - 0.01, <line x1={a[0]} y1={a[1]} x2={bb[0]} y2={bb[1]} stroke="#e8ffff" strokeOpacity={0.55} strokeWidth={1} />);
    }
    sc.light([x, y0 + 0.5, z - 0.3], color, 0.5, 0.9);
  } else {
    const s = facing === 'left' ? 1 : -1;
    sc.box([x - 0.3, floor, z - w / 2], [x + 0.3, floor + 0.85, z + w / 2], body);
    const y0 = floor + 0.85;
    sc.poly([[x + s * 0.25, y0, z - w / 2 + 0.05], [x + s * 0.25, y0, z + w / 2 - 0.05], [x - s * 0.2, y0 + 0.45, z + w / 2 - 0.05], [x - s * 0.2, y0 + 0.45, z - w / 2 + 0.05]], glowMat(color, 0.45), { n: [s * 0.7, 0.7, 0] });
    sc.light([x + s * 0.6, y0 + 0.5, z], color, 0.5, 0.9);
  }
}

/** A wall screen on the back wall. */
function wallScreen(b: Built, x: number, y: number, w: number, h: number, color: string, strength = 1) {
  const z = b.back - 0.04;
  b.sc.box([x - w / 2 - 0.06, y - h / 2 - 0.06, z - 0.03], [x + w / 2 + 0.06, y + h / 2 + 0.06, z + 0.04], mat('#262b33'));
  b.sc.poly([[x - w / 2, y - h / 2, z - 0.035], [x + w / 2, y - h / 2, z - 0.035], [x + w / 2, y + h / 2, z - 0.035], [x - w / 2, y + h / 2, z - 0.035]], glowMat(color, strength), { n: [0, 0, -1] });
  b.sc.light([x, y, z - 0.6], color, 0.35 * strength, 1);
}

/** A wall screen on a side wall, facing into the room. */
function sideScreen(b: Built, side: -1 | 1, z: number, y: number, w: number, h: number, color: string, strength = 1) {
  const x = side * (b.hw - 0.03);
  b.sc.poly(
    [
      [x, y - h / 2, z - w / 2],
      [x, y - h / 2, z + w / 2],
      [x, y + h / 2, z + w / 2],
      [x, y + h / 2, z - w / 2],
    ],
    glowMat(color, strength),
    { n: [-side, 0, 0] },
  );
  b.sc.light([x - side * 0.5, y, z], color, 0.3 * strength, 0.9);
}

/** 2D lines of text/graph on a projected screen quad, for detail. */
function screenLines(corners: V3[], color: string, rows = 5, key = 'sl'): ReactNode {
  const [a, b, , d] = corners.map((c) => P(c));
  const out: ReactNode[] = [];
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    const x0 = a![0] + (d![0] - a![0]) * t;
    const y0 = a![1] + (d![1] - a![1]) * t;
    const x1 = b![0] + (d![0] - a![0]) * t;
    const y1 = b![1] + (d![1] - a![1]) * t;
    const f = 0.35 + ((i * 37) % 50) / 100;
    out.push(<line key={`${key}${i}`} x1={x0 + (x1 - x0) * 0.08} y1={y0 + (y1 - y0) * 0.08} x2={x0 + (x1 - x0) * f} y2={y0 + (y1 - y0) * f} stroke={color} strokeWidth={1.1} opacity={0.75} />);
  }
  return out;
}

/** A crate. */
function crate(b: Built, x: number, z: number, w: number, h: number, d: number, color = '#5a5140', y0?: number) {
  const m = mat(color, { jitter: 0.25, spec: 0.1 });
  const y = y0 ?? b.floor;
  b.sc.box([x - w / 2, y, z], [x + w / 2, y + h, z + d], m, { split: 2 });
}

/** A cryo pod standing against a wall, glass toward the viewer. */
function pod(b: Built, x: number, z: number, lit: boolean, color: string, open = false) {
  const { sc, floor } = b;
  const shellM = mat('#56606e', { spec: 0.5 });
  sc.box([x - 0.42, floor, z], [x + 0.42, floor + 0.22, z + 0.7], mat('#2d333c'));
  sc.prism(x, z + 0.4, floor + 0.22, floor + 2.05, 0.4, shellM, 10, { rz: 0.32 });
  if (!open) {
    sc.poly(
      [
        [x - 0.26, floor + 0.45, z + 0.06],
        [x + 0.26, floor + 0.45, z + 0.06],
        [x + 0.26, floor + 1.85, z + 0.06],
        [x - 0.26, floor + 1.85, z + 0.06],
      ],
      lit ? glowMat(color, 0.75) : mat('#16303a', { spec: 0.9 }),
      { n: [0, 0, -1], bias: 0.5 },
    );
  } else {
    sc.poly(
      [
        [x - 0.26, floor + 0.45, z + 0.06],
        [x + 0.26, floor + 0.45, z + 0.06],
        [x + 0.26, floor + 1.85, z + 0.06],
        [x - 0.26, floor + 1.85, z + 0.06],
      ],
      mat('#0b0f14'),
      { n: [0, 0, -1], bias: 0.5 },
    );
    // The lid, swung out.
    sc.poly(
      [
        [x + 0.28, floor + 0.45, z + 0.02],
        [x + 0.78, floor + 0.45, z - 0.35],
        [x + 0.78, floor + 1.85, z - 0.35],
        [x + 0.28, floor + 1.85, z + 0.02],
      ],
      mat('#2a6a78', { spec: 0.9 }),
      { n: [-0.6, 0, -0.8], bias: 0.6 },
    );
  }
  sc.box([x - 0.3, floor + 2.02, z + 0.1], [x + 0.3, floor + 2.12, z + 0.6], glowMat(lit ? color : '#ff4d5e', lit ? 0.9 : 0.5));
  if (lit) sc.light([x, floor + 1.2, z - 0.4], color, 0.45, 0.8);
}

function shelfRack(b: Built, side: -1 | 1, z0: number, z1: number, color: string, items = true) {
  const { sc, floor } = b;
  const x = side * (b.hw - 0.45);
  const frame = mat('#4c5563', { spec: 0.3 });
  sc.box([x - 0.35, floor, z0], [x + 0.35, floor + 0.05, z1], frame);
  for (const y of [0.5, 1.1, 1.7]) sc.box([x - 0.35, floor + y, z0], [x + 0.35, floor + y + 0.05, z1], frame);
  sc.box([x - 0.35, floor, z0], [x + 0.35, floor + 2.2, z0 + 0.05], frame);
  sc.box([x - 0.35, floor, z1 - 0.05], [x + 0.35, floor + 2.2, z1], frame);
  if (items) {
    for (let z = z0 + 0.15; z < z1 - 0.3; z += 0.42) {
      for (const [i, y] of [0.05, 0.55, 1.15].entries()) {
        if ((Math.round(z * 10) + i) % 3 === 0) continue;
        const h = 0.25 + ((Math.round(z * 13) + i) % 3) * 0.08;
        sc.box([x - 0.25, floor + y, z], [x + 0.25, floor + y + h, z + 0.3], mat(i === 1 ? color : '#5b5446', { jitter: 0.3 }));
      }
    }
  }
}

function tableTop(b: Built, x: number, z: number, w: number, d: number, h = 0.78, color = '#474f5b') {
  const { sc, floor } = b;
  const m = mat(color, { spec: 0.35 });
  sc.box([x - w / 2, floor + h - 0.06, z], [x + w / 2, floor + h, z + d], m, { split: 2 });
  for (const [lx, lz] of [
    [x - w / 2 + 0.08, z + 0.08],
    [x + w / 2 - 0.08, z + 0.08],
    [x - w / 2 + 0.08, z + d - 0.08],
    [x + w / 2 - 0.08, z + d - 0.08],
  ] as const)
    sc.box([lx - 0.04, floor, lz - 0.04], [lx + 0.04, floor + h - 0.06, lz + 0.04], m);
}

// ── rooms ──────────────────────────────────────────────────────────────

export function roomArt(type: RoomType, accent: string): RoomArt {
  switch (type) {
    case 'cryo': {
      const b = shell({ lamp: '#9fe8ff', lampI: 0.7, door: 'shut', doorGlow: accent });
      for (const [i, z] of [2.6, 4.2, 5.8, 7.4].entries()) {
        pod(b, -2.35, z, i !== 1, accent, i === 1);
        pod(b, 2.35, z, i % 2 === 0, accent);
      }
      b.sc.pipeZ(-2.7, 1.45, 1, 9, 0.08, mat('#6b7482', { spec: 0.6 }));
      b.sc.pipeZ(2.7, 1.45, 1, 9, 0.08, mat('#6b7482', { spec: 0.6 }));
      // Frost on the floor.
      const f = onFloor(0, 5);
      return {
        built: b,
        look: look(accent, { haze: '#7fdfff', hazeO: 0.13 }),
        over: <ellipse cx={f.x} cy={f.y} rx={f.s * 1.6} ry={f.s * 0.5} fill="#bff4ff" opacity={0.07} />,
      };
    }
    case 'medbay': {
      const b = shell({ lamp: '#e8fbff', lampI: 0.9, door: 'shut', doorGlow: accent, wall: mat('#566270', { jitter: 0.12, spec: 0.3 }), floorMat: mat('#3a434d', { jitter: 0.15, spec: 0.6 }) });
      for (const z of [3.2, 6]) {
        const bed = mat('#8a97a6', { spec: 0.5 });
        b.sc.box([-2.5, b.floor + 0.55, z], [-1.4, b.floor + 0.7, z + 1.9], mat('#cfd8e2', { spec: 0.4 }), { split: 2 });
        b.sc.box([-2.45, b.floor, z + 0.1], [-2.35, b.floor + 0.55, z + 0.2], bed);
        b.sc.box([-1.55, b.floor, z + 0.1], [-1.45, b.floor + 0.55, z + 0.2], bed);
        b.sc.box([-2.45, b.floor, z + 1.7], [-2.35, b.floor + 0.55, z + 1.8], bed);
        b.sc.box([-1.55, b.floor, z + 1.7], [-1.45, b.floor + 0.55, z + 1.8], bed);
        b.sc.box([-2.5, b.floor + 0.7, z + 1.6], [-1.4, b.floor + 0.85, z + 1.9], mat('#e6edf3'));
      }
      // Surgical lamp.
      b.sc.pipeY(0.6, 5.5, 0.7, 1.7, 0.04, mat('#88919c'));
      b.sc.prism(0.6, 5.5, 0.5, 0.7, 0.45, mat('#9aa4b0', { spec: 0.6 }), 12, { top: mat('#9aa4b0') });
      b.sc.poly(Array.from({ length: 12 }, (_, i) => [0.6 + Math.cos((i / 12) * Math.PI * 2) * 0.4, 0.49, 5.5 + Math.sin((i / 12) * Math.PI * 2) * 0.4] as V3), glowMat('#ffffff', 1.8), { n: [0, -1, 0] });
      b.sc.light([0.6, 0.2, 5.5], '#ffffff', 1.6, 1.6);
      b.cones.push({ p: [0.6, 0.49, 5.5], w: 0.8, color: '#e8fbff', o: 0.3, spread: 0.5 });
      // Operating table under it.
      b.sc.box([0.1, b.floor + 0.75, 4.6], [1.1, b.floor + 0.85, 6.4], mat('#b8c4d0', { spec: 0.6 }), { split: 2 });
      b.sc.box([0.5, b.floor, 5.3], [0.7, b.floor + 0.75, 5.7], mat('#6c7581'));
      wallScreen(b, 1.9, 0.5, 1.3, 0.8, accent);
      sideScreen(b, 1, 3, 0.4, 1.2, 0.7, '#6be38f', 0.8);
      // A red cross on the wall.
      b.sc.box([-2.98, 0.55, 7.7], [-2.95, 0.65, 8.3], glowMat('#ff4d5e', 1.2));
      b.sc.box([-2.98, 0.3, 7.95], [-2.95, 0.9, 8.05], glowMat('#ff4d5e', 1.2));
      const tz = b.back - 0.035;
      return {
        built: b,
        look: look(accent, { hazeO: 0.06 }),
        over: <g opacity={0.9}>{screenLines([[1.3, 0.85, tz], [2.5, 0.85, tz], [2.5, 0.15, tz], [1.3, 0.15, tz]], '#062a2c', 6, 'm')}</g>,
      };
    }
    case 'armory': {
      const b = shell({ lamp: '#ffd08a', lampI: 0.9, door: 'shut', doorGlow: '#ffb547', wall: mat('#3d3a36', { jitter: 0.2, spec: 0.2 }) });
      for (const side of [-1, 1] as const) {
        for (let z = 2.5; z < 8.4; z += 0.55) {
          const x = side * 2.78;
          b.sc.box([x - 0.1, -0.6, z], [x + 0.1, 0.9, z + 0.08], mat('#1d2126', { spec: 0.6 }));
          b.sc.box([x - 0.12, 0.2, z - 0.06], [x + 0.12, 0.35, z + 0.14], mat('#2c3036'));
        }
        b.sc.box([side * 2.95 - 0.15, -0.75, 2.3], [side * 2.95 + 0.15, -0.7, 8.5], mat('#5c554a'));
      }
      // Locker cage in the middle and ammo crates.
      crate(b, -0.8, 5.5, 1, 0.7, 0.7, '#4f5a3a');
      crate(b, -0.75, 5.55, 0.9, 0.5, 0.6, '#586542', b.floor + 0.7);
      crate(b, 0.7, 6.4, 0.9, 0.9, 0.8, '#4f5a3a');
      b.sc.box([-0.4, b.floor, 3.8], [0.5, b.floor + 0.75, 4.4], mat('#6a5d45', { jitter: 0.2 }), { top: mat('#2b2f36') });
      // Red warning strip.
      b.sc.box([-2.8, 1.2, b.back - 0.05], [2.8, 1.28, b.back], glowMat('#ff4d5e', 0.8));
      return { built: b, look: look('#ffb547', { hazeO: 0.06, dust: '#ffe7c4' }) };
    }
    case 'galley': {
      const b = shell({ lamp: WARM, lampI: 1.2, door: 'open', doorGlow: '#ffd08a', wall: mat('#4a4239', { jitter: 0.15, spec: 0.2 }), floorMat: mat('#3a332c', { jitter: 0.2, spec: 0.4 }) });
      for (const z of [3, 5.2]) {
        tableTop(b, 0, z, 1.4, 1.6, 0.78, '#6f6252');
        for (const sx of [-1.05, 1.05]) b.sc.box([sx - 0.25, b.floor, z + 0.2], [sx + 0.25, b.floor + 0.45, z + 1.4], mat('#4d5560', { spec: 0.2 }), { top: mat('#6a7482') });
      }
      // Counter along the back.
      b.sc.box([-2.9, b.floor, 7.9], [2.9, b.floor + 0.95, 8.9], mat('#5d6874', { spec: 0.5 }), { top: mat('#9aa6b2', { spec: 0.7 }), split: 3 });
      b.sc.box([-2.9, 0.3, 8.5], [2.9, 1.1, 8.95], mat('#4a535e', { spec: 0.3 }), { split: 3 });
      // Tray, cups.
      b.sc.prism(-0.3, 3.8, b.floor + 0.78, b.floor + 0.9, 0.06, mat('#dfe6ec'), 8);
      b.sc.prism(0.35, 5.8, b.floor + 0.78, b.floor + 0.88, 0.05, mat('#c96f4a'), 8);
      b.sc.box([-0.1, b.floor + 0.78, 3.2], [0.35, b.floor + 0.8, 3.55], mat('#8b929b', { spec: 0.6 }));
      wallScreen(b, -1.6, 0.9, 0.9, 0.35, '#ffb547', 0.8);
      return { built: b, look: look('#ffb547', { hazeO: 0.08, dust: '#ffe7c4', grade: '#ff9d4d', gradeO: 0.1 }) };
    }
    case 'quarters': {
      const b = shell({ lamp: '#ffe2bd', lampI: 0.55, door: 'open', doorGlow: '#ffc27a', ceil: 1.4 });
      for (const side of [-1, 1] as const) {
        for (const z of [2.4, 5]) {
          const x0 = side < 0 ? -3 : 1.9;
          const x1 = side < 0 ? -1.9 : 3;
          for (const y of [b.floor + 0.35, b.floor + 1.45]) {
            b.sc.box([x0, y, z], [x1, y + 0.12, z + 2.1], mat('#4f5864', { spec: 0.2 }));
            b.sc.box([x0 + 0.05, y + 0.12, z + 0.05], [x1 - 0.05, y + 0.3, z + 2.05], mat(y > b.floor + 1 ? '#3a4f6a' : '#5a4a6a', { jitter: 0.25 }), { split: 2 });
            b.sc.box([x0 + 0.1, y + 0.3, z + 1.65], [x1 - 0.1, y + 0.42, z + 2], mat('#d8dde4'));
          }
          b.sc.box([side < 0 ? x1 - 0.06 : x0, b.floor, z], [side < 0 ? x1 : x0 + 0.06, b.floor + 2.1, z + 0.06], mat('#5b6573'));
        }
      }
      // Reading lamps, one on.
      b.sc.box([-2.05, b.floor + 1.1, 3.1], [-1.95, b.floor + 1.2, 3.3], glowMat('#ffd28a', 1.6));
      b.sc.light([-2.3, b.floor + 0.9, 3.2], '#ffd28a', 0.8, 0.7);
      // Personal things on the floor.
      crate(b, 0.4, 4, 0.5, 0.3, 0.4, '#6b4f3a');
      b.sc.box([-0.4, b.floor, 6], [0.2, b.floor + 0.04, 6.6], mat('#7a3e3e', { jitter: 0.3 }));
      return { built: b, look: look('#ffc27a', { hazeO: 0.05, dust: '#ffe7c4', grade: '#ff9d4d', gradeO: 0.08 }) };
    }
    case 'engineering': {
      const b = shell({ lamp: '#ffcf8a', lampI: 0.8, door: 'shut', doorGlow: '#ffb547', hw: 3.4, ceil: 2.2 });
      // Turbines / generators on both sides.
      for (const side of [-1, 1] as const) {
        for (const z of [3, 6]) {
          const x = side * 2.3;
          b.sc.prism(x, z + 0.8, b.floor, b.floor + 1.9, 0.75, mat('#5d6572', { spec: 0.5, jitter: 0.08 }), 14);
          b.sc.prism(x, z + 0.8, b.floor + 0.8, b.floor + 1, 0.78, glowMat('#ffb547', 0.8), 14);
          b.sc.light([x - side * 0.9, b.floor + 0.9, z + 0.8], '#ffb547', 0.6, 1);
        }
      }
      // Pipe runs.
      const pipe = mat('#7a6a55', { spec: 0.5 });
      b.sc.pipeZ(-1.2, 1.9, 1, 9, 0.12, pipe);
      b.sc.pipeZ(-0.8, 1.95, 1, 9, 0.08, mat('#5b7a8a', { spec: 0.5 }));
      b.sc.pipeZ(1.1, 1.9, 1, 9, 0.14, pipe);
      b.sc.pipeX(-3.4, 3.4, 1.4, 7.8, 0.1, pipe);
      b.sc.pipeY(-0.9, 8.7, b.floor, 2.2, 0.1, pipe);
      b.sc.pipeY(0.9, 8.7, b.floor, 2.2, 0.1, pipe);
      console3d(b, 0, 7.4, 1.4, accent);
      wallScreen(b, 0, 0.8, 1.2, 0.6, '#ffb547', 0.9);
      // Blinking fault lamp.
      b.sc.box([2.2, 1.5, b.back - 0.06], [2.4, 1.7, b.back], glowMat('#ff4d5e', 1.4));
      return { built: b, look: look('#ffb547', { hazeO: 0.09, dust: '#ffd9a8', grade: '#ff8a3d', gradeO: 0.1 }) };
    }
    case 'reactor': {
      const b = shell({ lamp: null, hw: 3.6, ceil: 3.2, back: 10, rib: mat('#3a414c', { spec: 0.4 }) });
      const core = accent;
      // Core column.
      b.sc.prism(0, 6.5, b.floor, 3.2, 1.05, mat('#4a525e', { spec: 0.6 }), 16);
      b.sc.prism(0, 6.5, b.floor + 0.6, 2.6, 0.78, glowMat(core, 0.9), 16);
      for (const y of [-0.6, 0.3, 1.2, 2.1]) b.sc.prism(0, 6.5, y, y + 0.16, 1.12, mat('#6a7482', { spec: 0.7 }), 16);
      b.sc.light([0, 0.6, 5.2], core, 1.6, 2);
      b.sc.light([0, 2, 5.5], core, 1.2, 2);
      // Catwalk rails.
      b.sc.box([-3.6, b.floor + 0.9, 2], [-2.4, b.floor + 0.95, 9.5], mat('#b88a2a'));
      b.sc.box([2.4, b.floor + 0.9, 2], [3.6, b.floor + 0.95, 9.5], mat('#b88a2a'));
      for (const side of [-1, 1] as const) for (let z = 2; z < 9.5; z += 1) b.sc.box([side * 2.45 - 0.03, b.floor, z], [side * 2.45 + 0.03, b.floor + 0.95, z + 0.06], mat('#7a6a4a'));
      // Coolant pipes into the core.
      const pipe = mat('#5b6a78', { spec: 0.5 });
      b.sc.pipeX(-3.6, -1, 2.4, 6.5, 0.16, pipe);
      b.sc.pipeX(1, 3.6, 2.4, 6.5, 0.16, pipe);
      b.sc.pipeX(-3.6, -1, -1, 6.9, 0.12, pipe);
      b.sc.pipeX(1, 3.6, -1, 6.9, 0.12, pipe);
      const c = P([0, 0.6, 6.5]);
      return {
        built: b,
        look: look(core, { hazeO: 0.12, dust: '#e6ffcf', grade: core, gradeO: 0.12 }),
        over: <ellipse cx={c[0]} cy={c[1]} rx={70} ry={160} fill={core} opacity={0.08} />,
      };
    }
    case 'bridge': {
      const b = shell({ lamp: '#9fd6ff', lampI: 0.5, back: 8, hw: 3.4, door: 'none', backMat: mat('#1c2129'), window: [-2.8, -0.6, 2.8, 1.5] });
      // A wide window across the back.
      const wz = b.back - 0.02;
      const win: V3[] = [[-2.8, -0.6, wz], [2.8, -0.6, wz], [2.8, 1.5, wz], [-2.8, 1.5, wz]];
      const w2 = win.map((v) => P(v));
      b.sc.box([-3.4, -0.75, wz - 0.1], [3.4, -0.6, wz], mat('#39424e'));
      b.sc.box([-3.4, 1.5, wz - 0.1], [3.4, 1.7, wz], mat('#39424e'));
      for (const x of [-1.4, 0, 1.4]) b.sc.box([x - 0.06, -0.6, wz - 0.1], [x + 0.06, 1.5, wz], mat('#39424e'));
      // Consoles in an arc.
      console3d(b, -1.6, 6.2, 1.2, accent);
      console3d(b, 0, 6.6, 1.3, accent);
      console3d(b, 1.6, 6.2, 1.2, '#ffb547');
      // Captain's chair.
      b.sc.box([-0.35, b.floor, 4.2], [0.35, b.floor + 0.5, 4.8], mat('#3d4450'));
      b.sc.box([-0.4, b.floor + 0.5, 4.2], [0.4, b.floor + 0.62, 4.9], mat('#5a3a3a', { spec: 0.3 }));
      b.sc.box([-0.4, b.floor + 0.62, 4.75], [0.4, b.floor + 1.5, 4.9], mat('#5a3a3a', { spec: 0.3 }));
      b.sc.light([0, 0.3, 7.2], '#7fb2ff', 0.7, 2);
      return {
        built: b,
        look: look(accent, { hazeO: 0.06 }),
        under: (
          <g>
            <polygon points={pts2(w2 as [number, number][])} fill="#02040a" />
            {stars(11, 90, [w2[0]![0], w2[2]![1], w2[1]![0], w2[0]![1]])}
            <circle cx={w2[1]![0] - 40} cy={w2[0]![1] + 40} r={120} fill="#1f4f86" opacity={0.55} />
            <circle cx={w2[1]![0] - 60} cy={w2[0]![1] + 30} r={115} fill="#2f6fb4" opacity={0.35} />
          </g>
        ),
      };
    }
    case 'comms': {
      const b = shell({ lamp: '#9fd6ff', lampI: 0.6, door: 'shut', doorGlow: accent });
      // Racks of equipment down both sides, blinking.
      for (const side of [-1, 1] as const) {
        for (let z = 2.2; z < 8.4; z += 1.3) {
          const x = side * 2.55;
          b.sc.box([x - 0.4, b.floor, z], [x + 0.4, b.floor + 2.4, z + 1.1], mat('#2d333c', { spec: 0.3 }), { split: 2 });
          for (let y = 0.2; y < 2.2; y += 0.28) b.sc.poly([[x - side * 0.41, b.floor + y, z + 0.15], [x - side * 0.41, b.floor + y, z + 0.95], [x - side * 0.41, b.floor + y + 0.05, z + 0.95], [x - side * 0.41, b.floor + y + 0.05, z + 0.15]], glowMat(((y * 10) | 0) % 3 === 0 ? '#6be38f' : accent, 0.7), { n: [-side, 0, 0] });
        }
      }
      console3d(b, 0, 7.2, 1.6, accent);
      wallScreen(b, 0, 0.9, 2.4, 0.9, accent, 0.9);
      const tz = b.back - 0.035;
      const scr = [P([-1.2, 0.45, tz]), P([1.2, 1.35, tz])];
      const wave: [number, number][] = Array.from({ length: 40 }, (_, i) => [scr[0]![0] + ((scr[1]![0] - scr[0]![0]) * i) / 39, (scr[0]![1] + scr[1]![1]) / 2 + Math.sin(i * 0.9) * (6 + (i % 7))]);
      return { built: b, look: look(accent, { hazeO: 0.07 }), over: <polyline points={pts2(wave)} fill="none" stroke="#dffcff" strokeWidth={1.4} opacity={0.8} /> };
    }
    case 'lab': {
      const b = shell({ lamp: '#e6f5ff', lampI: 1.1, door: 'shut', doorGlow: accent, wall: mat('#4d5866', { jitter: 0.12, spec: 0.3 }), floorMat: mat('#39424c', { spec: 0.6, jitter: 0.12 }) });
      // Specimen tanks along the back.
      for (const x of [-1.6, 0, 1.6]) {
        b.sc.prism(x, 8.1, b.floor, b.floor + 0.3, 0.45, mat('#56606c', { spec: 0.4 }), 12);
        b.sc.prism(x, 8.1, b.floor + 0.3, b.floor + 2.2, 0.38, glowMat(x === 0 ? '#9fff7a' : accent, x === 0 ? 0.9 : 0.55), 12);
        b.sc.prism(x, 8.1, b.floor + 2.2, b.floor + 2.4, 0.45, mat('#56606c', { spec: 0.4 }), 12);
        b.sc.light([x, 0, 7.3], x === 0 ? '#9fff7a' : accent, 0.6, 1);
      }
      // Benches with glassware.
      for (const side of [-1, 1] as const) {
        const x0 = side < 0 ? -2.9 : 1.9;
        b.sc.box([x0, b.floor, 2.4], [x0 + 1, b.floor + 0.9, 6.8], mat('#5d6875', { spec: 0.3 }), { top: mat('#cfd8e0', { spec: 0.6 }), split: 3 });
        for (let z = 2.8; z < 6.6; z += 0.55) b.sc.prism(x0 + 0.5, z, b.floor + 0.9, b.floor + 1.05 + ((z * 10) % 3) * 0.05, 0.07, glowMat(((z * 10) | 0) % 2 ? accent : '#9fff7a', 0.5), 8);
      }
      // A broken tank: shards.
      const t = P([1.6, b.floor + 1.2, 8.1]);
      return {
        built: b,
        look: look(accent, { hazeO: 0.07 }),
        over: <path d={`M${t[0] - 14} ${t[1] - 30} l10 22 l-6 18 l14 12 M${t[0] + 10} ${t[1] - 40} l-8 30 l12 20`} stroke="#ff4d5e" strokeWidth={1.6} fill="none" opacity={0.85} />,
      };
    }
    case 'hydroponics': {
      const b = shell({ lamp: '#e9b3ff', lampI: 0.9, door: 'open', doorGlow: '#b2ff9c', floorMat: mat('#2f3a2f', { jitter: 0.3, spec: 0.3 }) });
      for (const side of [-1, 1] as const) {
        for (const y of [-0.9, 0, 0.9]) {
          const x0 = side < 0 ? -3 : 1.8;
          b.sc.box([x0, y - 0.1, 1.8], [x0 + 1.2, y, 8.8], mat('#4b5563', { spec: 0.2 }), { split: 3 });
          // Plants: little cones of green.
          for (let z = 2; z < 8.6; z += 0.45) {
            const px = x0 + 0.6 + Math.sin(z * 3.1) * 0.25;
            b.sc.prism(px, z, y, y + 0.28 + (Math.sin(z * 5 + y) + 1) * 0.1, 0.14, mat('#3f8a45', { jitter: 0.4 }), 5, { top: mat('#6ccf5f') });
          }
          b.sc.box([x0, y + 0.72, 1.8], [x0 + 1.2, y + 0.76, 8.8], glowMat('#d58cff', 0.9));
          b.sc.light([x0 + 0.6, y + 0.5, 5.3], '#d58cff', 0.5, 1.2);
        }
      }
      return { built: b, look: look('#b2ff9c', { hazeO: 0.1, dust: '#f3ffd6', grade: '#9d5cff', gradeO: 0.1 }) };
    }
    case 'cargo': {
      const b = shell({ lamp: '#ffe2b0', lampI: 0.9, hw: 3.8, ceil: 2.8, back: 11, door: 'shut', doorGlow: '#ffb547', ribEvery: 2 });
      const stack: [number, number, number, number, number, string][] = [
        [-2.7, 3, 1.4, 1.2, 1.4, '#5b4f3c'],
        [-2.7, 3, 1.1, 0.9, 1.1, '#43546a'],
        [-2.3, 6, 1.6, 1.6, 1.8, '#6a5a3e'],
        [2.6, 3.6, 1.4, 1.4, 1.4, '#5b4f3c'],
        [2.5, 6.8, 1.6, 1.2, 1.6, '#43546a'],
        [2.6, 6.8, 1.2, 1, 1.2, '#6a5a3e'],
        [0.4, 8.8, 1.6, 1.8, 1.4, '#5b4f3c'],
        [-0.9, 5, 0.9, 0.7, 0.9, '#6b3a3a'],
      ];
      const heights: Record<string, number> = {};
      for (const [x, z, w, h, d, c] of stack) {
        const k = `${x}${z}`;
        const y0 = b.floor + (heights[k] ?? 0);
        crate(b, x, z, w, h, d, c, y0);
        heights[k] = (heights[k] ?? 0) + h;
      }
      // Overhead crane rail.
      b.sc.box([-0.2, 2.35, 1.5], [0.2, 2.5, 11], mat('#b88a2a', { spec: 0.3 }));
      b.sc.box([-0.4, 1.9, 5.8], [0.4, 2.35, 6.4], mat('#4a525e'));
      b.sc.pipeY(0, 6.1, 0.6, 1.9, 0.02, mat('#9aa3ad'));
      return { built: b, look: look('#ffb547', { hazeO: 0.07, dust: '#ffe7c4' }) };
    }
    case 'security': {
      const b = shell({ lamp: '#9fb8ff', lampI: 0.35, door: 'shut', doorGlow: '#ff4d5e', back: 7.5 });
      // A wall of monitors.
      for (let i = 0; i < 12; i++) {
        const x = -2.1 + (i % 4) * 1.4;
        const y = -0.1 + Math.floor(i / 4) * 0.62;
        wallScreen(b, x, y, 1.2, 0.5, i === 6 ? '#ff4d5e' : accent, i === 6 ? 0.8 : 0.3);
      }
      console3d(b, 0, 5.6, 2.8, accent);
      b.sc.box([-0.3, b.floor, 4.2], [0.3, b.floor + 0.5, 4.7], mat('#3d4450'));
      b.sc.box([-0.35, b.floor + 0.5, 4.2], [0.35, b.floor + 1.2, 4.35], mat('#2f3540'));
      return { built: b, look: look(accent, { hazeO: 0.05, vignette: 0.9 }) };
    }
    case 'observation': {
      const b = shell({ lamp: null, back: 7.5, hw: 3.4, door: 'none', backMat: mat('#171b22'), ceil: 2, window: [-3, -1, 3, 1.8] });
      const wz = b.back - 0.02;
      const win = [P([-3, -1, wz]), P([3, -1, wz]), P([3, 1.8, wz]), P([-3, 1.8, wz])];
      b.sc.box([-3.4, -1.15, wz - 0.12], [3.4, -1, wz], mat('#3a424e'));
      for (const x of [-1.5, 0, 1.5]) b.sc.box([x - 0.05, -1, wz - 0.12], [x + 0.05, 1.8, wz], mat('#2c323b'));
      // Benches facing the glass.
      b.sc.box([-2.2, b.floor, 5], [2.2, b.floor + 0.45, 5.5], mat('#4a5360'), { top: mat('#6a5646'), split: 3 });
      b.sc.light([0, 0.6, 7], '#7fb2ff', 1.2, 3);
      b.sc.light([2.5, 1, 7], '#ffd9a8', 0.5, 2);
      const planetX = win[1]![0] - 90;
      const planetY = win[0]![1] + 20;
      return {
        built: b,
        look: look('#7fb2ff', { hazeO: 0.06, dust: '#cfe3ff' }),
        under: (
          <g>
            <polygon points={pts2(win as [number, number][])} fill="#01030a" />
            {stars(5, 140, [win[0]![0], win[2]![1], win[1]![0], win[0]![1]])}
            <defs>
              <radialGradient id="obs-planet" cx="0.35" cy="0.3" r="0.75">
                <stop offset="0" stopColor="#8fd0ff" />
                <stop offset="0.45" stopColor="#2f6fb4" />
                <stop offset="1" stopColor="#040b18" />
              </radialGradient>
            </defs>
            <circle cx={planetX} cy={planetY} r={170} fill="url(#obs-planet)" />
            <path d={`M${planetX - 170} ${planetY} a170 170 0 0 1 300 -90`} stroke="#bfe8ff" strokeOpacity={0.35} strokeWidth={3} fill="none" />
            <ellipse cx={planetX - 40} cy={planetY - 60} rx={80} ry={14} fill="#dff3ff" opacity={0.12} transform={`rotate(-18 ${planetX} ${planetY})`} />
          </g>
        ),
      };
    }
    case 'airlock': {
      const b = shell({ lamp: '#ffcf7a', lampI: 0.6, back: 7, door: 'none', backMat: mat('#3a3f47', { jitter: 0.15 }), rib: mat('#b88a2a', { spec: 0.3 }) });
      // The big round hatch.
      const hz = b.back - 0.05;
      const ring = (r: number, z: number) => Array.from({ length: 24 }, (_, i) => [Math.cos((i / 24) * Math.PI * 2) * r, 0.1 + Math.sin((i / 24) * Math.PI * 2) * r, z] as V3);
      b.sc.poly(ring(1.35, hz), mat('#5a616b', { spec: 0.5 }), { n: [0, 0, -1] });
      b.sc.poly(ring(1.05, hz - 0.08), mat('#2c3037', { spec: 0.5 }), { n: [0, 0, -1] });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        b.sc.poly([[Math.cos(a) * 0.15, 0.1 + Math.sin(a) * 0.15, hz - 0.1], [Math.cos(a) * 1, 0.1 + Math.sin(a) * 1, hz - 0.1], [Math.cos(a + 0.35) * 1, 0.1 + Math.sin(a + 0.35) * 1, hz - 0.1]], mat('#474d56', { spec: 0.4 }), { n: [0, 0, -1] });
      }
      b.sc.poly(ring(0.12, hz - 0.12), glowMat('#ff4d5e', 1.2), { n: [0, 0, -1] });
      // Hazard stripes on the floor.
      for (let i = -5; i < 5; i++) b.sc.poly([[i * 0.6, b.floor + 0.005, 5.6], [i * 0.6 + 0.3, b.floor + 0.005, 5.6], [i * 0.6 + 0.6, b.floor + 0.005, 6.2], [i * 0.6 + 0.3, b.floor + 0.005, 6.2]], mat('#c79a2a', { jitter: 0.2 }), { n: [0, 1, 0] });
      // Suits on the wall.
      for (const side of [-1, 1] as const) {
        for (const z of [3, 4.5]) {
          const x = side * 2.7;
          b.sc.box([x - 0.2, -0.8, z], [x + 0.2, 0.5, z + 0.5], mat('#b8b2a0', { jitter: 0.1 }));
          b.sc.prism(x, z + 0.25, 0.5, 0.95, 0.24, mat('#c8c2b0', { spec: 0.5 }), 10, { top: mat('#c8c2b0') });
          b.sc.box([x - (side > 0 ? 0.25 : -0.21), 0.6, z + 0.12], [x - (side > 0 ? 0.21 : -0.25), 0.85, z + 0.38], glowMat('#ffb547', 0.6));
        }
      }
      b.sc.light([0, 1.3, 6.4], '#ff4d5e', 0.8, 1.5);
      return { built: b, look: look('#ffb547', { hazeO: 0.07 }) };
    }
    case 'podbay': {
      const b = shell({ lamp: '#9fe8ff', lampI: 0.6, back: 8.5, door: 'none', backMat: mat('#2f353e') });
      // Three launch tubes in the back wall.
      for (const [i, x] of [-1.9, 0, 1.9].entries()) {
        const z = b.back - 0.05;
        const ring = (r: number, zz: number) => Array.from({ length: 20 }, (_, k) => [x + Math.cos((k / 20) * Math.PI * 2) * r * 0.8, 0 + Math.sin((k / 20) * Math.PI * 2) * r, zz] as V3);
        b.sc.poly(ring(1.05, z), mat('#59616d', { spec: 0.5 }), { n: [0, 0, -1] });
        b.sc.poly(ring(0.85, z - 0.04), i === 1 ? glowMat(accent, 0.55) : mat('#0d1117'), { n: [0, 0, -1] });
        b.sc.poly(ring(0.3, z - 0.08), mat(i === 1 ? '#dffcff' : '#1d232b', { spec: 0.8 }), { n: [0, 0, -1] });
        b.sc.box([x - 0.35, 1.25, z - 0.1], [x + 0.35, 1.35, z], glowMat(i === 2 ? '#ff4d5e' : '#6be38f', 0.9));
      }
      b.sc.light([0, 0, 7.4], accent, 0.9, 1.4);
      // Launch rail and handle.
      b.sc.box([-0.1, b.floor, 3], [0.1, b.floor + 0.05, 8.4], mat('#b88a2a'));
      b.sc.box([2.4, -0.4, 4], [2.9, 0.6, 4.4], mat('#39414b'));
      b.sc.box([2.35, 0.1, 4.12], [2.42, 0.4, 4.28], glowMat('#ff4d5e', 1));
      return { built: b, look: look(accent, { hazeO: 0.08 }) };
    }
    case 'hangar': {
      const b = shell({ lamp: '#cfe8ff', lampI: 0.9, hw: 5, ceil: 4, back: 14, noSides: false, ribEvery: 2.4, door: 'none', backMat: mat('#23282f', { jitter: 0.2 }) });
      // The shuttle: a fuselage lathed on its side, a canopy, swept wings.
      const hull = mat('#8a939f', { spec: 0.7, jitter: 0.06 });
      const dark = mat('#343b45', { spec: 0.4 });
      const zc = 8.6;
      const len = 5;
      const sections: [number, number, number][] = [
        [-len / 2, 0.15, 0.1],
        [-len / 2 + 0.5, 0.75, 0.55],
        [-len / 2 + 1.4, 1.15, 0.8],
        [len / 2 - 1.2, 1.2, 0.85],
        [len / 2, 0.9, 0.7],
      ];
      // Fuselage as rings along z, with an elliptical cross-section.
      const sides = 12;
      for (let j = 0; j < sections.length - 1; j++) {
        const [za, wa, ha] = sections[j]!;
        const [zb, wb, hb] = sections[j + 1]!;
        for (let i = 0; i < sides; i++) {
          const a0 = (i / sides) * Math.PI * 2;
          const a1 = ((i + 1) / sides) * Math.PI * 2;
          const am = (a0 + a1) / 2;
          const q = (z: number, w: number, h: number, a: number): V3 => [Math.cos(a) * w, -0.35 + Math.sin(a) * h, zc + z];
          const n: V3 = [Math.cos(am), Math.sin(am), -(wb - wa) / Math.max(0.2, zb - za)];
          b.sc.poly([q(za, wa, ha, a0), q(zb, wb, hb, a0), q(zb, wb, hb, a1), q(za, wa, ha, a1)], i >= 7 && i <= 10 && j === 1 ? glowMat(accent, 0.45) : hull, { n });
        }
      }
      b.sc.poly(Array.from({ length: sides }, (_, i) => [Math.cos((i / sides) * Math.PI * 2) * 0.15, -0.35 + Math.sin((i / sides) * Math.PI * 2) * 0.1, zc - len / 2] as V3), hull, { n: [0, 0, -1] });
      b.sc.poly([[-1.1, -0.45, zc - 0.6], [-3.8, -0.75, zc + 1.4], [-3.8, -0.65, zc + 2], [-1.1, -0.35, zc + 2.2]], dark, { n: [0, 1, 0] });
      b.sc.poly([[1.1, -0.35, zc + 2.2], [3.8, -0.65, zc + 2], [3.8, -0.75, zc + 1.4], [1.1, -0.45, zc - 0.6]], dark, { n: [0, 1, 0] });
      b.sc.box([-3.85, -0.8, zc + 1.4], [-3.7, -0.6, zc + 2], glowMat('#ff4d5e', 0.8));
      b.sc.box([3.7, -0.8, zc + 1.4], [3.85, -0.6, zc + 2], glowMat('#6be38f', 0.8));
      b.sc.box([-0.06, 0.4, zc + 1], [0.06, 1.3, zc + 2.4], dark);
      for (const [lx, lz] of [[-0.8, zc - 0.8], [0.8, zc - 0.8], [0, zc + 1.8]] as const) b.sc.box([lx - 0.06, b.floor, lz], [lx + 0.06, -1.05, lz + 0.12], dark);
      b.sc.light([0, 1.5, zc - 2.5], '#cfe8ff', 1, 2);
      // Landing lights and floor markings.
      for (let z = 3; z < 13; z += 1.5) {
        b.sc.box([-3.2, b.floor, z], [-3, b.floor + 0.04, z + 0.3], glowMat('#ffb547', 0.9));
        b.sc.box([3, b.floor, z], [3.2, b.floor + 0.04, z + 0.3], glowMat('#ffb547', 0.9));
      }
      b.sc.light([0, 3, 8.5], '#cfe8ff', 1.6, 4);
      // Bay doors, closed.
      for (let x = -5; x < 5; x += 1) b.sc.box([x, b.floor + 0.2, b.back - 0.1], [x + 0.05, b.floor + 5, b.back], mat('#b88a2a', { jitter: 0.1 }));
      return { built: b, look: look(accent, { hazeO: 0.1, dust: '#dfefff' }) };
    }
    case 'captain': {
      const b = shell({ lamp: WARM, lampI: 0.55, door: 'none', back: 7, backMat: mat('#3a2f28', { jitter: 0.12 }), wall: mat('#43372e', { jitter: 0.12, spec: 0.2 }), floorMat: mat('#3b2d24', { jitter: 0.25, spec: 0.3 }) });
      // Desk.
      b.sc.box([-1.3, b.floor, 4.6], [1.3, b.floor + 0.8, 5.5], mat('#6b4a31', { spec: 0.4, jitter: 0.1 }), { split: 2 });
      b.sc.box([0.5, b.floor + 0.8, 5], [0.9, b.floor + 1.1, 5.3], mat('#2d333c'));
      b.sc.poly([[0.52, b.floor + 0.84, 4.99], [0.88, b.floor + 0.84, 4.99], [0.88, b.floor + 1.08, 4.99], [0.52, b.floor + 1.08, 4.99]], glowMat(accent, 0.8), { n: [0, 0, -1] });
      // Desk lamp.
      b.sc.box([-0.9, b.floor + 0.8, 5.1], [-0.8, b.floor + 1.2, 5.2], mat('#b89a5a'));
      b.sc.box([-1.05, b.floor + 1.18, 4.95], [-0.7, b.floor + 1.24, 5.25], glowMat('#ffd28a', 1.5));
      b.sc.light([-0.9, b.floor + 1, 4.8], '#ffd28a', 1.1, 1.1);
      // Chair behind.
      b.sc.box([-0.35, b.floor, 5.9], [0.35, b.floor + 0.5, 6.4], mat('#3b2b22'));
      b.sc.box([-0.4, b.floor + 0.5, 6.3], [0.4, b.floor + 1.5, 6.45], mat('#5a3a2a', { spec: 0.3 }));
      // Bookshelves and a painting.
      shelfRack(b, -1, 2.5, 6.5, '#7a4a3a');
      const pz = b.back - 0.04;
      b.sc.box([0.9, 0.1, pz - 0.03], [2.3, 1.1, pz], mat('#b8964f'));
      b.sc.poly([[1, 0.2, pz - 0.035], [2.2, 0.2, pz - 0.035], [2.2, 1, pz - 0.035], [1, 1, pz - 0.035]], mat('#2e5a3a', { jitter: 0.3 }), { n: [0, 0, -1] });
      return { built: b, look: look('#ffd28a', { hazeO: 0.06, dust: '#ffe7c4', grade: '#ff9d4d', gradeO: 0.12 }) };
    }
    case 'maintenance': {
      const b = shell({ lamp: '#ffcf8a', lampI: 0.45, hw: 1.8, ceil: 1.3, door: 'open', doorGlow: '#ffb547', ribEvery: 1.1 });
      const pipe = mat('#6d5f4c', { spec: 0.5 });
      b.sc.pipeZ(-1.5, 1.05, 1, 9, 0.12, pipe);
      b.sc.pipeZ(-1.2, 1.1, 1, 9, 0.07, mat('#5b7a8a', { spec: 0.4 }));
      b.sc.pipeZ(1.45, 0.9, 1, 9, 0.16, pipe);
      b.sc.pipeZ(1.5, -1.2, 1, 9, 0.1, mat('#4f5864', { spec: 0.4 }));
      b.sc.pipeZ(-1.55, -1.3, 1, 9, 0.08, pipe);
      // Fuse box, open.
      b.sc.box([-1.8, -0.2, 4.5], [-1.6, 0.6, 5.3], mat('#4a525e'));
      b.sc.poly([[-1.59, -0.1, 4.6], [-1.59, -0.1, 5.2], [-1.59, 0.5, 5.2], [-1.59, 0.5, 4.6]], glowMat('#ffb547', 0.45), { n: [1, 0, 0] });
      // Toolbox, drum.
      crate(b, 0.6, 3.6, 0.6, 0.35, 0.35, '#8a3a2a');
      b.sc.prism(-1, 6.5, b.floor, b.floor + 0.9, 0.3, mat('#3f6a4a', { spec: 0.4, jitter: 0.2 }), 10);
      b.sc.box([1.3, -0.4, 7], [1.8, -0.2, 7.2], glowMat('#ff4d5e', 0.8));
      return { built: b, look: look('#ffb547', { hazeO: 0.08, dust: '#ffe7c4', vignette: 0.95 }) };
    }
    case 'nest': {
      const b = shell({
        lamp: null,
        door: 'none',
        fittings: null,
        runners: null,
        cables: 5,
        wall: mat('#2a1d1f', { jitter: 0.6, spec: 0.7 }),
        floorMat: mat('#221619', { jitter: 0.6, spec: 0.9 }),
        grate: mat('#1a1113', { jitter: 0.6, spec: 0.9, seam: 0.5 }),
        ceilMat: mat('#1a1214', { jitter: 0.5 }),
        backMat: mat('#261719', { jitter: 0.6, spec: 0.6 }),
        rib: mat('#3a2528', { spec: 0.8, jitter: 0.4 }),
      });
      // Eggs: leathery, split at the top, lit from inside.
      const egg = mat('#6a4a3a', { spec: 0.9, jitter: 0.3 });
      const spots: [number, number, number][] = [
        [-1.6, 4, 1],
        [-0.9, 5.3, 0.9],
        [0.35, 4.5, 1.1],
        [1.3, 5.7, 0.85],
        [2, 4.1, 1],
        [-0.2, 6.9, 0.8],
        [-1.9, 7.3, 0.9],
        [1.7, 7.7, 0.8],
        [0.9, 3.2, 0.95],
        [-2.3, 5.6, 0.75],
      ];
      for (const [x, z, k] of spots) {
        const f = b.floor;
        b.sc.lathe(x, z, [[f, 0.12 * k], [f + 0.15 * k, 0.3 * k], [f + 0.4 * k, 0.36 * k], [f + 0.65 * k, 0.3 * k], [f + 0.78 * k, 0.18 * k]], egg, 10);
        b.sc.lathe(x, z, [[f + 0.76 * k, 0.17 * k], [f + 0.8 * k, 0.1 * k], [f + 0.8 * k, 0]], glowMat(accent, 0.7), 10);
        b.sc.light([x, f + 1, z - 0.3], accent, 0.3, 0.6);
      }
      // Resin columns fused to the walls.
      for (let i = 0; i < 12; i++) {
        const x = -2.8 + i * 0.52;
        const z = 8.7 - ((i * 7) % 5) * 0.25;
        b.sc.lathe(x, z, [[b.floor, 0.28], [b.floor + 0.8, 0.12], [0.4, 0.16], [1.2, 0.1], [b.ceil, 0.26]], mat('#3a2427', { spec: 0.9, jitter: 0.5 }), 7);
      }
      for (const side of [-1, 1] as const) {
        for (let z = 2.2; z < 8.5; z += 0.9) b.sc.lathe(side * 2.75, z, [[b.floor, 0.3], [-0.6, 0.15], [0.6, 0.22], [b.ceil, 0.35]], mat('#33201f', { spec: 0.9, jitter: 0.5 }), 6);
      }
      b.sc.light([0, 0.4, 6], accent, 0.8, 2.6);
      b.sc.ambient = [0.01, 0.004, 0.005];
      b.sc.fog = { c: [0.02, 0.004, 0.006], d: 0.14 };
      return {
        built: b,
        look: look(accent, { bg: '#060203', haze: accent, hazeO: 0.12, dust: '#ffc2a8', grade: '#ff2436', gradeO: 0.1, vignette: 0.95 }),
        over: <Strands />,
      };
    }
  }
}

function Strands() {
  const out: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 90 + i * 55;
    out.push(<path key={i} d={`M${x} 0 q${i % 2 ? 30 : -30} ${120 + (i % 3) * 30} ${(i % 2 ? 10 : -10)} ${260 + (i % 4) * 40}`} stroke="#3a1a1f" strokeWidth={4 + (i % 3) * 2} fill="none" opacity={0.85} />);
    out.push(<path key={`h${i}`} d={`M${x - 1} 0 q${i % 2 ? 30 : -30} ${120 + (i % 3) * 30} ${(i % 2 ? 10 : -10)} ${260 + (i % 4) * 40}`} stroke="#ff8a7a" strokeWidth={0.8} fill="none" opacity={0.25} />);
  }
  return <g>{out}</g>;
}

export function shellFor(o: Shell) {
  return shell(o);
}

export { COOL, F, scaleAt };
