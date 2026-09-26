import type { ReactNode } from 'react';

// A tiny flat-shaded 3D renderer that outputs SVG polygons. Scenes are built
// from boxes, prisms and quads in metres, lit by coloured point lights with
// distance falloff, fogged by depth, and painted back to front. Walls and
// floors are split into panels, so light falls off across them panel by
// panel and the seams read as plating.

export type V3 = [number, number, number];
export type RGB = [number, number, number];

export const VIEW = 600;
export const CX = 300;
export const CY = 270;
export const F = 520;
const EXPOSURE = 2.2;

export function P(v: V3): [number, number] {
  const z = Math.max(0.05, v[2]);
  return [CX + (F * v[0]) / z, CY - (F * v[1]) / z];
}

/** Pixels per metre at depth z. */
export function scaleAt(z: number): number {
  return F / z;
}

/** A CSS colour as linear light, which is what the lighting maths works in. */
export function hex(c: string): RGB {
  const n = parseInt(c.replace('#', ''), 16);
  const lin = (v: number) => Math.pow(v / 255, 2.2);
  return [lin((n >> 16) & 255), lin((n >> 8) & 255), lin(n & 255)];
}

function toHex(c: RGB): string {
  const f = (x: number) => {
    // Exposure with a soft shoulder, then back to display gamma, so bright
    // lights roll off instead of clipping flat.
    const t = 1 - Math.exp(-Math.max(0, x) * EXPOSURE);
    const g = Math.pow(t, 1 / 2.2);
    return Math.round(Math.min(1, g) * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(c[0])}${f(c[1])}${f(c[2])}`;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3) => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export interface Mat {
  /** Albedo. */
  c: RGB;
  /** Glow, added after lighting. */
  e?: RGB;
  /** Shininess 0..1. */
  spec?: number;
  /** Per-panel brightness jitter, for worn plating. */
  jitter?: number;
  /** Seam colour multiplier; 1 hides seams. */
  seam?: number;
}

export interface Light {
  p: V3;
  c: RGB;
  /** Intensity. */
  i: number;
  /** Distance at which it has fallen to half. */
  r: number;
}

export interface Fog {
  c: RGB;
  /** Density per metre. */
  d: number;
}

interface Face {
  pts: V3[];
  n: V3;
  mat: Mat;
  /** Emissive faces also go on the bloom layer. */
  glow?: boolean;
  seed: number;
  bias: number;
}

export function mat(c: string, extra: Partial<Omit<Mat, 'c'>> = {}): Mat {
  return { c: hex(c), ...extra };
}

export function glowMat(c: string, strength = 1.6): Mat {
  const e = hex(c);
  return { c: [0, 0, 0], e: [e[0] * strength, e[1] * strength, e[2] * strength], seam: 1 };
}

let seedCounter = 1;

export class Scene {
  faces: Face[] = [];
  sprites: { d: number; el: ReactNode; glow?: ReactNode }[] = [];
  /** Floor height: things standing on it get a contact shadow. */
  floorY: number | null = null;
  /** Bias added to everything drawn while set (the shell draws first). */
  layer = 0;
  lights: Light[] = [];
  ambient: RGB = [0.006, 0.008, 0.012];
  fog: Fog = { c: [0.002, 0.003, 0.005], d: 0.13 };

  light(p: V3, c: string, i = 1, r = 3): this {
    this.lights.push({ p, c: hex(c), i, r });
    return this;
  }

  /** Flat 2D art painted in among the faces at a given distance (creatures, bodies, decals). */
  sprite(dist: number, el: ReactNode, glow?: ReactNode): this {
    this.sprites.push({ d: dist, el, glow });
    return this;
  }

  /** A flat polygon. Normal from the winding (counter-clockwise from the lit side) unless given. */
  poly(pts: V3[], m: Mat, opts: { n?: V3; glow?: boolean; bias?: number } = {}): this {
    const n = opts.n ?? norm(cross(sub(pts[1]!, pts[0]!), sub(pts[pts.length - 1]!, pts[0]!)));
    this.faces.push({ pts, n, mat: m, glow: opts.glow ?? !!m.e, seed: seedCounter++, bias: (opts.bias ?? 0) + this.layer });
    return this;
  }

  /** A rectangle split into nx × ny panels. `o` is a corner, `u` and `v` its edges. */
  /** A soft dark patch on the floor under something standing on it. */
  shadow(x0: number, z0: number, x1: number, z1: number, strength = 0.7): this {
    if (this.floorY === null) return this;
    const pad = 0.25;
    const [, ay] = P([(x0 + x1) / 2, this.floorY, z0 - pad]);
    const [, by] = P([(x0 + x1) / 2, this.floorY, z1 + pad]);
    const [lx] = P([x0 - pad, this.floorY, (z0 + z1) / 2]);
    const [rx] = P([x1 + pad, this.floorY, (z0 + z1) / 2]);
    const cz = (z0 + z1) / 2;
    this.sprites.push({
      d: Math.hypot((x0 + x1) / 2, this.floorY, cz) + 30,
      el: <ellipse cx={(lx + rx) / 2} cy={(ay + by) / 2} rx={Math.abs(rx - lx) / 2} ry={Math.max(3, Math.abs(ay - by) / 2)} fill="url(#cw-ao)" opacity={strength} />,
    });
    return this;
  }

  panel(o: V3, u: V3, v: V3, nx: number, ny: number, m: Mat, n: V3, bias = 0): this {
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) {
        const a: V3 = [o[0] + (u[0] * i) / nx + (v[0] * j) / ny, o[1] + (u[1] * i) / nx + (v[1] * j) / ny, o[2] + (u[2] * i) / nx + (v[2] * j) / ny];
        const du: V3 = [u[0] / nx, u[1] / nx, u[2] / nx];
        const dv: V3 = [v[0] / ny, v[1] / ny, v[2] / ny];
        const b: V3 = [a[0] + du[0], a[1] + du[1], a[2] + du[2]];
        const c: V3 = [b[0] + dv[0], b[1] + dv[1], b[2] + dv[2]];
        const d: V3 = [a[0] + dv[0], a[1] + dv[1], a[2] + dv[2]];
        this.poly([a, b, c, d], m, { n, bias });
      }
    }
    return this;
  }

  /** An axis-aligned box from its minimum corner to its maximum corner. */
  box(min: V3, max: V3, m: Mat, opts: { top?: Mat; front?: Mat; skip?: ('top' | 'bottom' | 'left' | 'right' | 'front' | 'back')[]; split?: number } = {}): this {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const skip = new Set(opts.skip ?? []);
    const s = opts.split ?? 1;
    if (this.floorY !== null && Math.abs(y0 - this.floorY) < 0.02 && !this.layer) this.shadow(x0, z0, x1, z1, 0.75);
    if (!skip.has('front')) this.panel([x0, y0, z0], [x1 - x0, 0, 0], [0, y1 - y0, 0], s, s, opts.front ?? m, [0, 0, -1]);
    if (!skip.has('back')) this.poly([[x1, y0, z1], [x0, y0, z1], [x0, y1, z1], [x1, y1, z1]], m, { n: [0, 0, 1] });
    if (!skip.has('top')) this.panel([x0, y1, z0], [x1 - x0, 0, 0], [0, 0, z1 - z0], s, s, opts.top ?? m, [0, 1, 0]);
    if (!skip.has('bottom')) this.poly([[x0, y0, z0], [x0, y0, z1], [x1, y0, z1], [x1, y0, z0]], m, { n: [0, -1, 0] });
    if (!skip.has('left')) this.panel([x0, y0, z1], [0, 0, z0 - z1], [0, y1 - y0, 0], s, s, m, [-1, 0, 0]);
    if (!skip.has('right')) this.panel([x1, y0, z0], [0, 0, z1 - z0], [0, y1 - y0, 0], s, s, m, [1, 0, 0]);
    return this;
  }

  /** A vertical prism (cylinder when `sides` is large) standing on y0. */
  prism(cx: number, cz: number, y0: number, y1: number, r: number, m: Mat, sides = 12, opts: { top?: Mat; rz?: number; rot?: number } = {}): this {
    const rz = opts.rz ?? r;
    const rot = opts.rot ?? 0;
    if (this.floorY !== null && Math.abs(y0 - this.floorY) < 0.02 && !this.layer) this.shadow(cx - r, cz - rz, cx + r, cz + rz, 0.75);
    const ring = (y: number): V3[] => Array.from({ length: sides }, (_, i) => {
      const a = rot + (i / sides) * Math.PI * 2;
      return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * rz] as V3;
    });
    const lo = ring(y0);
    const hi = ring(y1);
    for (let i = 0; i < sides; i++) {
      const j = (i + 1) % sides;
      const a = rot + ((i + 0.5) / sides) * Math.PI * 2;
      this.poly([lo[i]!, lo[j]!, hi[j]!, hi[i]!], m, { n: [Math.cos(a), 0, Math.sin(a)] });
    }
    this.poly(hi.slice().reverse(), opts.top ?? m, { n: [0, 1, 0] });
    this.poly(lo, m, { n: [0, -1, 0] });
    return this;
  }

  /** A surface of revolution around a vertical axis: `profile` is [y, radius] pairs from bottom to top. */
  lathe(cx: number, cz: number, profile: [number, number][], m: Mat, sides = 12, opts: { rz?: number; tilt?: number } = {}): this {
    const k = (opts.rz ?? 1);
    const bottom = profile[0]!;
    if (this.floorY !== null && Math.abs(bottom[0] - this.floorY) < 0.05 && !this.layer) {
      const rmax = Math.max(...profile.map((p) => p[1]));
      this.shadow(cx - rmax, cz - rmax * k, cx + rmax, cz + rmax * k, 0.8);
    }
    const tilt = opts.tilt ?? 0;
    for (let j = 0; j < profile.length - 1; j++) {
      const [y0, r0] = profile[j]!;
      const [y1, r1] = profile[j + 1]!;
      if (r0 < 1e-4 && r1 < 1e-4) continue;
      const dy = y1 - y0;
      const dr = r1 - r0;
      for (let i = 0; i < sides; i++) {
        const a0 = (i / sides) * Math.PI * 2;
        const a1 = ((i + 1) / sides) * Math.PI * 2;
        const am = (a0 + a1) / 2;
        const p = (y: number, r: number, a: number): V3 => [cx + Math.cos(a) * r + tilt * (y - bottom[0]), y, cz + Math.sin(a) * r * k];
        const n = norm([Math.cos(am) * dy, -dr, Math.sin(am) * dy * k]);
        const pts: V3[] = r0 < 1e-4 ? [p(y0, 0, am), p(y1, r1, a1), p(y1, r1, a0)] : r1 < 1e-4 ? [p(y0, r0, a0), p(y0, r0, a1), p(y1, 0, am)] : [p(y0, r0, a0), p(y0, r0, a1), p(y1, r1, a1), p(y1, r1, a0)];
        this.poly(pts, m, { n });
      }
    }
    return this;
  }

  /** A horizontal cylinder running along x (a pipe across the room). */
  pipeX(x0: number, x1: number, y: number, z: number, r: number, m: Mat, sides = 8): this {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (x: number, a: number): V3 => [x, y + Math.sin(a) * r, z - Math.cos(a) * r];
      this.poly([p(x0, a0), p(x1, a0), p(x1, a1), p(x0, a1)], m, { n: [0, Math.sin(am), -Math.cos(am)] });
    }
    return this;
  }

  /** A horizontal cylinder running along z (a pipe down the room). */
  pipeZ(x: number, y: number, z0: number, z1: number, r: number, m: Mat, sides = 8): this {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const am = (a0 + a1) / 2;
      const p = (z: number, a: number): V3 => [x + Math.cos(a) * r, y + Math.sin(a) * r, z];
      this.poly([p(z0, a0), p(z1, a0), p(z1, a1), p(z0, a1)], m, { n: [Math.cos(am), Math.sin(am), 0] });
    }
    return this;
  }

  /** A vertical pipe. */
  pipeY(x: number, z: number, y0: number, y1: number, r: number, m: Mat, sides = 8): this {
    return this.prism(x, z, y0, y1, r, m, sides);
  }

  private shade(f: Face, p: V3): RGB {
    const m = f.mat;
    const out: RGB = [m.c[0] * this.ambient[0] * 10, m.c[1] * this.ambient[1] * 10, m.c[2] * this.ambient[2] * 10];
    const view = norm([-p[0], -p[1], -p[2]]);
    for (const L of this.lights) {
      const d = sub(L.p, p);
      const dist = len(d);
      const l: V3 = [d[0] / dist, d[1] / dist, d[2] / dist];
      const ndl = Math.max(0, dot(f.n, l));
      const att = L.i / (1 + (dist / L.r) * (dist / L.r));
      out[0] += m.c[0] * L.c[0] * ndl * att;
      out[1] += m.c[1] * L.c[1] * ndl * att;
      out[2] += m.c[2] * L.c[2] * ndl * att;
      if (m.spec) {
        const h = norm([l[0] + view[0], l[1] + view[1], l[2] + view[2]]);
        const sp = Math.pow(Math.max(0, dot(f.n, h)), 24) * m.spec * att;
        out[0] += L.c[0] * sp;
        out[1] += L.c[1] * sp;
        out[2] += L.c[2] * sp;
      }
    }
    if (m.jitter) {
      const j = 1 + (hash(f.seed) - 0.5) * m.jitter;
      out[0] *= j;
      out[1] *= j;
      out[2] *= j;
    }
    if (m.e) {
      out[0] += m.e[0];
      out[1] += m.e[1];
      out[2] += m.e[2];
    }
    const t = 1 - Math.exp(-this.fog.d * Math.max(0, len(p) - 1.5));
    const k = m.e ? t * 0.5 : t;
    return [out[0] * (1 - k) + this.fog.c[0] * k, out[1] * (1 - k) + this.fog.c[1] * k, out[2] * (1 - k) + this.fog.c[2] * k];
  }

  /** Paint it: every visible face, far to near. */
  render(): { body: ReactNode; bloom: ReactNode } {
    const drawn: { d: number; el: ReactNode; glow: ReactNode | null }[] = [];
    let k = 0;
    for (const f of this.faces) {
      const c: V3 = [0, 0, 0];
      for (const p of f.pts) {
        c[0] += p[0];
        c[1] += p[1];
        c[2] += p[2];
      }
      c[0] /= f.pts.length;
      c[1] /= f.pts.length;
      c[2] /= f.pts.length;
      if (dot(f.n, [-c[0], -c[1], -c[2]]) <= 0) continue;
      if (f.pts.every((p) => p[2] < 0.3)) continue;
      const col = this.shade(f, c);
      const fill = toHex(col);
      const seam = f.mat.seam ?? 0.62;
      const stroke = seam >= 1 ? fill : toHex([col[0] * seam, col[1] * seam, col[2] * seam]);
      const pts = f.pts
        .map((p) => P(p))
        .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
        .join(' ');
      const key = k++;
      drawn.push({
        d: len(c) - f.bias,
        el: <polygon key={key} points={pts} fill={fill} stroke={stroke} strokeWidth={seam >= 1 ? 0.6 : 0.9} strokeLinejoin="round" />,
        glow: f.glow ? <polygon key={key} points={pts} fill={fill} /> : null,
      });
    }
    for (const sp of this.sprites) drawn.push({ d: sp.d, el: <g key={`s${k++}`}>{sp.el}</g>, glow: sp.glow ? <g key={`g${k++}`}>{sp.glow}</g> : null });
    drawn.sort((a, b) => b.d - a.d);
    return { body: drawn.map((d) => d.el), bloom: drawn.filter((d) => d.glow).map((d) => d.glow) };
  }
}

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** A seeded stream of numbers in 0..1, for stars, debris, dust. */
export function seeded(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pts2(list: [number, number][]): string {
  return list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}
