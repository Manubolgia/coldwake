import { useId, type ReactNode } from 'react';
import { F, P, Scene, VIEW, glowMat, hex, mat, scaleAt, seeded, type Mat, type V3 } from './kit3d';

// The pieces every illustration is built from: the room shell (floor, walls,
// ribs, ceiling lights), the light shafts and floor pools under each lamp, and
// the post-processing that makes it read as one picture — bloom, haze, dust,
// vignette.

export interface Cone {
  p: V3;
  /** Fixture width, metres. */
  w: number;
  color: string;
  /** 0..1 */
  o: number;
  /** How far the shaft spreads at the floor, metres. */
  spread?: number;
}

export interface Look {
  /** Background behind everything (seen only through gaps). */
  bg: string;
  /** Haze colour and strength. */
  haze: string;
  hazeO: number;
  /** Colour grade laid over the finished picture. */
  grade?: string;
  gradeO?: number;
  /** Dust in the air. */
  dust?: string;
  vignette?: number;
}

export interface Shell {
  /** Half-width, metres. */
  hw?: number;
  floor?: number;
  ceil?: number;
  back?: number;
  wall?: Mat;
  floorMat?: Mat;
  ceilMat?: Mat;
  backMat?: Mat;
  rib?: Mat;
  /** Distance between bulkhead ribs. */
  ribEvery?: number;
  /** Colour of the ceiling light strips; null for none. */
  lamp?: string | null;
  lampI?: number;
  /** A door in the back wall. */
  door?: 'open' | 'shut' | 'none';
  doorGlow?: string;
  /** Skip the side walls (big open bays). */
  noSides?: boolean;
  /** A window cut in the back wall: [x0, y0, x1, y1]. */
  window?: [number, number, number, number];
  grate?: Mat;
  /** Small fittings on the walls: vents, junction boxes, status lights. */
  fittings?: string | null;
  /** Emergency lights along the foot of the walls. */
  runners?: string | null;
  /** Cables sagging from the ceiling. */
  cables?: number;
  seed?: number;
}

export interface Built {
  sc: Scene;
  cones: Cone[];
  hw: number;
  floor: number;
  ceil: number;
  back: number;
}

/** Floor, ceiling, walls, bulkhead ribs, lamps: the box every room lives in. */
export function shell(o: Shell = {}): Built {
  const sc = new Scene();
  sc.layer = -50;
  const hw = o.hw ?? 3;
  const floor = o.floor ?? -1.6;
  const ceil = o.ceil ?? 1.7;
  const back = o.back ?? 9;
  const near = 1;
  const wall = o.wall ?? mat('#39424f', { jitter: 0.18, spec: 0.15 });
  const floorMat = o.floorMat ?? mat('#2b3038', { jitter: 0.25, spec: 0.5 });
  const ceilMat = o.ceilMat ?? mat('#23282f', { jitter: 0.2 });
  const backMat = o.backMat ?? wall;
  const rib = o.rib ?? mat('#4a5361', { spec: 0.35 });
  const depth = back - near;
  const H = ceil - floor;

  // Floor: plates either side of a grated walkway, then ceiling and back wall.
  const walk = Math.min(0.9, hw * 0.35);
  const grate = o.grate ?? mat('#1d2126', { jitter: 0.35, spec: 0.8, seam: 0.35 });
  sc.panel([-hw, floor, near], [hw - walk, 0, 0], [0, 0, depth], 3, Math.round(depth * 1.3), floorMat, [0, 1, 0]);
  sc.panel([walk, floor, near], [hw - walk, 0, 0], [0, 0, depth], 3, Math.round(depth * 1.3), floorMat, [0, 1, 0]);
  sc.panel([-walk, floor, near], [2 * walk, 0, 0], [0, 0, depth], 3, Math.round(depth * 4), grate, [0, 1, 0]);
  sc.panel([-hw, ceil, back], [2 * hw, 0, 0], [0, 0, -depth], 4, Math.round(depth), ceilMat, [0, -1, 0]);
  const door = o.door ?? 'none';
  if (o.window) {
    const [wx0, wy0, wx1, wy1] = o.window;
    sc.panel([-hw, floor, back], [wx0 + hw, 0, 0], [0, H, 0], 2, 4, backMat, [0, 0, -1]);
    sc.panel([wx1, floor, back], [hw - wx1, 0, 0], [0, H, 0], 2, 4, backMat, [0, 0, -1]);
    sc.panel([wx0, floor, back], [wx1 - wx0, 0, 0], [0, wy0 - floor, 0], 4, 1, backMat, [0, 0, -1]);
    sc.panel([wx0, wy1, back], [wx1 - wx0, 0, 0], [0, ceil - wy1, 0], 4, 1, backMat, [0, 0, -1]);
  } else if (door === 'none') {
    sc.panel([-hw, floor, back], [2 * hw, 0, 0], [0, H, 0], 6, 4, backMat, [0, 0, -1]);
  } else {
    const dw = 0.75;
    const dh = Math.min(2.4, H - 0.3);
    // Wall around the door.
    sc.panel([-hw, floor, back], [hw - dw, 0, 0], [0, H, 0], 3, 4, backMat, [0, 0, -1]);
    sc.panel([dw, floor, back], [hw - dw, 0, 0], [0, H, 0], 3, 4, backMat, [0, 0, -1]);
    sc.panel([-dw, floor + dh, back], [2 * dw, 0, 0], [0, H - dh, 0], 2, 1, backMat, [0, 0, -1]);
    // Frame.
    const fr = mat('#59616d', { spec: 0.4 });
    sc.box([-dw - 0.18, floor, back - 0.12], [-dw, floor + dh + 0.18, back], fr);
    sc.box([dw, floor, back - 0.12], [dw + 0.18, floor + dh + 0.18, back], fr);
    sc.box([-dw - 0.18, floor + dh, back - 0.12], [dw + 0.18, floor + dh + 0.18, back], fr);
    const hazard = mat('#b88a2a', { jitter: 0.2 });
    sc.box([-dw, floor, back - 0.06], [dw, floor + 0.08, back], hazard);
    if (door === 'shut') {
      const leaf = mat('#48505c', { spec: 0.3, jitter: 0.1 });
      sc.panel([-dw, floor, back - 0.02], [dw, 0, 0], [0, dh, 0], 1, 3, leaf, [0, 0, -1]);
      sc.panel([0, floor, back - 0.02], [dw, 0, 0], [0, dh, 0], 1, 3, leaf, [0, 0, -1]);
      sc.box([-0.02, floor, back - 0.05], [0.02, floor + dh, back - 0.02], glowMat(o.doorGlow ?? '#ff4d5e', 0.9));
    } else {
      // A corridor beyond, fading into the dark.
      const far = mat('#1c2027', { jitter: 0.2 });
      sc.panel([-dw, floor, back], [2 * dw, 0, 0], [0, 0, 3], 2, 3, far, [0, 1, 0]);
      sc.panel([-dw, floor, back + 3], [0, 0, -3], [0, dh, 0], 3, 2, far, [1, 0, 0]);
      sc.panel([dw, floor, back], [0, 0, 3], [0, dh, 0], 3, 2, far, [-1, 0, 0]);
      sc.panel([-dw, floor, back + 3], [2 * dw, 0, 0], [0, dh, 0], 1, 1, mat('#0b0d11'), [0, 0, -1]);
      sc.light([0, floor + dh - 0.2, back + 1.8], o.doorGlow ?? '#5ce1e6', 0.5, 1.2);
      sc.box([-0.25, floor + dh - 0.1, back + 1.6], [0.25, floor + dh - 0.05, back + 1.9], glowMat(o.doorGlow ?? '#5ce1e6', 1));
    }
  }

  // Side walls: a lower band, a main band, and a trim strip.
  if (!o.noSides) {
    for (const side of [-1, 1] as const) {
      const x = side * hw;
      const n: V3 = [-side, 0, 0];
      const z0 = side < 0 ? back : near;
      const dz = side < 0 ? -depth : depth;
      sc.panel([x, floor, z0], [0, 0, dz], [0, 0.9, 0], Math.round(depth * 1.2), 1, mat('#2c323b', { jitter: 0.25, spec: 0.2 }), n);
      sc.panel([x, floor + 0.9, z0], [0, 0, dz], [0, H - 0.9, 0], Math.round(depth * 0.9), 3, wall, n);
    }
  }

  // Bulkhead ribs.
  const every = o.ribEvery ?? 1.6;
  for (let z = near + 0.8; z < back - 0.3; z += every) {
    if (!o.noSides) {
      sc.box([-hw, floor, z], [-hw + 0.22, ceil, z + 0.28], rib, { skip: ['left', 'back'] });
      sc.box([hw - 0.22, floor, z], [hw, ceil, z + 0.28], rib, { skip: ['right', 'back'] });
    }
    sc.box([-hw, ceil - 0.2, z], [hw, ceil, z + 0.28], rib, { skip: ['top', 'back'] });
  }

  // Lamps between the ribs.
  const cones: Cone[] = [];
  if (o.lamp !== null) {
    const c = o.lamp ?? '#cfe8ff';
    for (let z = near + 2.4 + every / 2; z < back - 0.5; z += every * 2) {
      sc.box([-0.5, ceil - 0.06, z - 0.14], [0.5, ceil, z + 0.14], glowMat(c, 1.2), { skip: ['top'] });
      sc.light([0, ceil - 0.4, z], c, o.lampI ?? 1, 1.7);
      cones.push({ p: [0, ceil - 0.06, z], w: 1, color: c, o: 0.14 });
    }
  }

  const rnd = seeded(o.seed ?? Math.round(hw * 100 + back * 7 + H * 13));

  // Fittings on the walls between the ribs.
  if (o.fittings !== null && !o.noSides) {
    const lampC = o.fittings ?? '#6be38f';
    for (let z = near + 1.4; z < back - 0.6; z += every) {
      for (const side of [-1, 1] as const) {
        const r = rnd();
        const x = side * hw;
        if (r < 0.35) {
          // Vent grille.
          sc.box([x - side * 0.03, floor + 1.9, z + 0.3], [x, floor + 2.3, z + 0.9], mat('#15181d'), { skip: [side < 0 ? 'left' : 'right'] });
          for (let k = 0; k < 4; k++) sc.box([x - side * 0.05, floor + 1.95 + k * 0.09, z + 0.32], [x - side * 0.03, floor + 1.98 + k * 0.09, z + 0.88], mat('#4a525d', { spec: 0.4 }));
        } else if (r < 0.65) {
          // Junction box with a status light.
          sc.box([x - side * 0.12, floor + 1.1, z + 0.4], [x, floor + 1.55, z + 0.8], mat('#4d5663', { spec: 0.3 }), { skip: [side < 0 ? 'left' : 'right'] });
          sc.box([x - side * 0.13, floor + 1.45, z + 0.46], [x - side * 0.12, floor + 1.5, z + 0.52], glowMat(rnd() < 0.3 ? '#ff4d5e' : lampC, 1.6));
        } else if (r < 0.8) {
          // Conduit running along the wall.
          sc.pipeZ(x - side * 0.08, floor + 2.05, z, z + every, 0.05, mat('#6a6254', { spec: 0.5 }), 6);
        }
      }
    }
  }

  // Emergency runners at the foot of the walls.
  if (o.runners !== null && !o.noSides) {
    const rc = o.runners ?? '#ffb547';
    for (let z = near + 1.2; z < back - 0.3; z += every / 2) {
      for (const side of [-1, 1] as const) sc.box([side * (hw - 0.02) - 0.02, floor + 0.12, z], [side * (hw - 0.02) + 0.02, floor + 0.16, z + 0.12], glowMat(rc, 1.1));
    }
  }

  // Cables sagging from the ceiling.
  const cables = o.cables ?? 2;
  for (let i = 0; i < cables; i++) {
    const side = rnd() < 0.5 ? -1 : 1;
    const x0 = side * (hw - 0.5 - rnd() * 0.8);
    const za = near + 2 + rnd() * (depth - 4);
    const zb = za + 1 + rnd() * 1.6;
    const sag = 0.3 + rnd() * 0.6;
    const ptsC: [number, number][] = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const z = za + (zb - za) * t;
      const y = ceil - 0.22 - sag * 4 * t * (1 - t);
      ptsC.push(P([x0 + side * 0.1 * Math.sin(t * 3), y, z]));
    }
    const zm = (za + zb) / 2;
    const w = Math.max(1, 0.035 * scaleAt(zm));
    sc.sprite(
      zm,
      <g>
        <polyline points={ptsC.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke="#07080a" strokeWidth={w} strokeLinecap="round" />
        <polyline points={ptsC.map(([x, y]) => `${(x - w * 0.25).toFixed(1)},${(y - w * 0.25).toFixed(1)}`).join(' ')} fill="none" stroke="#8a95a3" strokeOpacity={0.18} strokeWidth={Math.max(0.6, w * 0.25)} strokeLinecap="round" />
      </g>,
    );
  }

  sc.layer = 0;
  sc.floorY = floor;
  return { sc, cones, hw, floor, ceil, back };
}

// ── light shafts ───────────────────────────────────────────────────────

function ConeShape({ c, floor, id, i }: { c: Cone; floor: number; id: string; i: number }) {
  const spread = c.spread ?? 0.9;
  const [x, y, z] = c.p;
  const a = P([x - c.w / 2, y, z]);
  const b = P([x + c.w / 2, y, z]);
  const cc = P([x + c.w / 2 + spread, floor, z]);
  const d = P([x - c.w / 2 - spread, floor, z]);
  const [px, py] = P([x, floor, z]);
  const rx = (c.w / 2 + spread) * scaleAt(z);
  const [, pyNear] = P([x, floor, z - 0.9]);
  const ry = Math.max(4, (pyNear - py) * 0.9);
  return (
    <g>
      <linearGradient id={`${id}-cone${i}`} x1="0" y1={a[1]} x2="0" y2={d[1]} gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor={c.color} stopOpacity={c.o} />
        <stop offset="1" stopColor={c.color} stopOpacity={0} />
      </linearGradient>
      <polygon points={`${a[0]},${a[1]} ${b[0]},${b[1]} ${cc[0]},${cc[1]} ${d[0]},${d[1]}`} fill={`url(#${id}-cone${i})`} />
      <ellipse cx={px} cy={py} rx={rx * 0.8} ry={ry * 0.8} fill={c.color} opacity={c.o * 0.6} />
    </g>
  );
}

// ── the frame ──────────────────────────────────────────────────────────

export function Frame({
  className,
  label,
  look,
  built,
  under,
  over,
  children,
}: {
  className?: string;
  label: string;
  look: Look;
  built?: Built;
  /** 2D art behind the 3D (space through a window). */
  under?: ReactNode;
  /** 2D art over the 3D, before post (fire, sparks). */
  over?: ReactNode;
  children?: ReactNode;
}) {
  const id = `a${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = built?.sc.render();
  const dust = look.dust ? dustMotes(look.dust, id) : null;
  return (
    <svg className={className} viewBox={`0 0 ${VIEW} ${VIEW}`} preserveAspectRatio="xMidYMid slice" role="img" aria-label={label}>
      <defs>
        <filter id={`${id}-bloom`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
        <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <filter id={`${id}-blur2`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <radialGradient id="cw-ao">
          <stop offset="0" stopColor="#000" stopOpacity={0.85} />
          <stop offset="0.6" stopColor="#000" stopOpacity={0.45} />
          <stop offset="1" stopColor="#000" stopOpacity={0} />
        </radialGradient>
        <radialGradient id={`${id}-vig`} cx="0.5" cy="0.47" r="0.72">
          <stop offset="0.5" stopColor="#000" stopOpacity={0} />
          <stop offset="1" stopColor="#000" stopOpacity={look.vignette ?? 0.85} />
        </radialGradient>
        <linearGradient id={`${id}-haze`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.haze} stopOpacity={look.hazeO * 0.5} />
          <stop offset="0.45" stopColor={look.haze} stopOpacity={look.hazeO} />
          <stop offset="0.62" stopColor={look.haze} stopOpacity={look.hazeO * 0.7} />
          <stop offset="1" stopColor={look.haze} stopOpacity={0} />
        </linearGradient>
      </defs>
      <rect width={VIEW} height={VIEW} fill={look.bg} />
      {under}
      {r && <g>{r.body}</g>}
      {children}
      {over}
      {built && built.cones.length > 0 && (
        <g style={{ mixBlendMode: 'screen' }} filter={`url(#${id}-soft)`}>
          {built.cones.map((c, i) => (
            <ConeShape key={i} c={c} floor={built.floor} id={id} i={i} />
          ))}
        </g>
      )}
      {r && (
        <g filter={`url(#${id}-bloom)`} style={{ mixBlendMode: 'screen' }} opacity={0.9}>
          {r.bloom}
        </g>
      )}
      <rect width={VIEW} height={VIEW} fill={`url(#${id}-haze)`} style={{ mixBlendMode: 'screen' }} />
      {dust}
      {look.grade && <rect width={VIEW} height={VIEW} fill={look.grade} opacity={look.gradeO ?? 0.12} style={{ mixBlendMode: 'overlay' }} />}
      <rect width={VIEW} height={VIEW} fill={`url(#${id}-vig)`} />
    </svg>
  );
}

function dustMotes(color: string, id: string) {
  const rnd = seeded(id.length * 7919 + id.charCodeAt(id.length - 1));
  return (
    <g fill={color}>
      {Array.from({ length: 26 }, (_, i) => (
        <circle key={i} cx={80 + rnd() * 440} cy={90 + rnd() * 400} r={0.6 + rnd() * 1.4} opacity={0.15 + rnd() * 0.45} />
      ))}
    </g>
  );
}

// ── shared 2D pieces ───────────────────────────────────────────────────

/** Where a point on the floor lands, and how many pixels a metre is there. */
export function onFloor(x: number, z: number, floor = -1.6): { x: number; y: number; s: number } {
  const [px, py] = P([x, floor, z]);
  return { x: px, y: py, s: F / z };
}

export function stars(seed: number, n: number, box: [number, number, number, number]) {
  const rnd = seeded(seed);
  const [x0, y0, x1, y1] = box;
  return (
    <g>
      {Array.from({ length: n }, (_, i) => {
        const big = rnd() > 0.93;
        return <circle key={i} cx={x0 + rnd() * (x1 - x0)} cy={y0 + rnd() * (y1 - y0)} r={big ? 1.4 + rnd() : 0.4 + rnd() * 0.7} fill={rnd() > 0.8 ? '#ffe9c7' : rnd() > 0.6 ? '#cfe3ff' : '#ffffff'} opacity={0.4 + rnd() * 0.6} />;
      })}
    </g>
  );
}

export { glowMat, hex, mat };
