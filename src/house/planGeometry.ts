// Plan-drawing geometry in metres, with no three.js: the opening plan (annotations.ts)
// and the downloadable drawing sheet (planSheet.ts) both draw from these, so they agree.
import { walls, dimensions, sunArc, sunMarks, WALL_T, type Wall } from './layout';

/** A line segment on the plan: [x1, z1, x2, z2]. */
export type Seg = [number, number, number, number];
export interface Rect { x0: number; z0: number; x1: number; z1: number }

const sorted = (w: Wall) => [...(w.openings ?? [])].sort((a, b) => a.at - b.at);
const axis = (w: Wall) => {
  const alongX = w.z1 === w.z2;
  return {
    alongX,
    a0: Math.min(alongX ? w.x1 : w.z1, alongX ? w.x2 : w.z2),
    a1: Math.max(alongX ? w.x1 : w.z1, alongX ? w.x2 : w.z2),
    fixed: alongX ? w.z1 : w.x1,
  };
};
/** Plan point at distance `a` along a wall and `across` from its centre line. */
const at = (alongX: boolean, fixed: number, a: number, across: number): [number, number] => (alongX ? [a, fixed + across] : [fixed + across, a]);

/** Solid wall in plan: each wall cut at its openings, the same pieces build.ts raises. */
export function wallSolids(): Rect[] {
  const out: Rect[] = [];
  for (const w of walls) {
    const { alongX, a0, a1, fixed } = axis(w);
    const push = (from: number, to: number) => {
      if (to - from < 0.001) return;
      out.push(alongX
        ? { x0: from, x1: to, z0: fixed - WALL_T / 2, z1: fixed + WALL_T / 2 }
        : { x0: fixed - WALL_T / 2, x1: fixed + WALL_T / 2, z0: from, z1: to });
    };
    let cursor = a0 - WALL_T / 2;
    for (const o of sorted(w)) {
      push(cursor, o.at - o.w / 2);
      cursor = o.at + o.w / 2;
    }
    push(cursor, a1 + WALL_T / 2);
  }
  return out;
}

/** Window symbol in every glazed opening: both wall faces, the glass line, and the jambs. */
export function windowSegs(): Seg[] {
  const segs: Seg[] = [];
  for (const w of walls) {
    const { alongX, fixed } = axis(w);
    for (const o of sorted(w)) {
      if (!o.glass) continue;
      const lo = o.at - o.w / 2;
      const hi = o.at + o.w / 2;
      for (const across of [-WALL_T / 2, 0, WALL_T / 2]) segs.push([...at(alongX, fixed, lo, across), ...at(alongX, fixed, hi, across)]);
      for (const a of [lo, hi]) segs.push([...at(alongX, fixed, a, -WALL_T / 2), ...at(alongX, fixed, a, WALL_T / 2)]);
    }
  }
  return segs;
}

/** Door swings: a leaf opened 90 degrees towards north / west and the arc it sweeps. */
export function doorSegs(): Seg[] {
  const segs: Seg[] = [];
  for (const w of walls) {
    const { alongX, fixed } = axis(w);
    for (const o of sorted(w)) {
      if (o.glass || o.w > 2.2 || o.h >= 3) continue;
      const hinge = o.at - o.w / 2;
      const r = o.w;
      const point = (a: number, across: number) => at(alongX, fixed, a, -across);
      segs.push([...point(hinge, WALL_T / 2), ...point(hinge, WALL_T / 2 + r)]);
      let prev = point(hinge + r, WALL_T / 2);
      for (let i = 1; i <= 12; i++) {
        const t = (i / 12) * (Math.PI / 2);
        const cur = point(hinge + Math.cos(t) * r, WALL_T / 2 + Math.sin(t) * r);
        segs.push([...prev, ...cur]);
        prev = cur;
      }
    }
  }
  return segs;
}

/** Overall dimension lines with end ticks and extension lines. */
export function dimensionSegs(): Seg[] {
  const segs: Seg[] = [];
  for (const d of dimensions) {
    const [ax, az] = d.a;
    const [bx, bz] = d.b;
    segs.push([ax, az, bx, bz]);
    const horizontal = az === bz;
    for (const [x, z] of [[ax, az], [bx, bz]] as const) {
      if (horizontal) segs.push([x, z - 0.35, x, z + 0.35], [x, z + 0.35, x, z + 1.1]);
      else segs.push([x - 0.35, z, x + 0.35, z], [x + 0.35, z, x + 1.1, z]);
    }
  }
  return segs;
}

/** The sun's path round the house, dashed, with a small cross at each hour mark. */
export function sunPathSegs(): Seg[] {
  const segs: Seg[] = [];
  for (let i = 0; i < sunArc.length - 1; i += 2) segs.push([sunArc[i][0], sunArc[i][1], sunArc[i + 1][0], sunArc[i + 1][1]]);
  for (const m of sunMarks) segs.push([m.x - 0.45, m.z, m.x + 0.45, m.z], [m.x, m.z - 0.45, m.x, m.z + 0.45]);
  return segs;
}

/** Bounds of the building drawing (walls, doors, dimensions), for fitting it to a sheet. The sun path is
 * left out: at 27 m across it is wider than the house and would not fit A3 at 1:100. */
export function planBounds(): Rect {
  const b: Rect = { x0: Infinity, z0: Infinity, x1: -Infinity, z1: -Infinity };
  const add = (x: number, z: number) => { b.x0 = Math.min(b.x0, x); b.x1 = Math.max(b.x1, x); b.z0 = Math.min(b.z0, z); b.z1 = Math.max(b.z1, z); };
  wallSolids().forEach((r) => { add(r.x0, r.z0); add(r.x1, r.z1); });
  [...dimensionSegs(), ...doorSegs()].forEach(([x1, z1, x2, z2]) => { add(x1, z1); add(x2, z2); });
  return b;
}
