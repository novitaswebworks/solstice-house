import * as THREE from 'three';
import { walls, dimensions, sunArc, sunMarks, WALL_T } from './layout';

/** Thin ink lines for the plan sheet: dimension lines and door swings. */
export function buildAnnotations() {
  const pts: number[] = [];
  const Y = 0.12;
  const seg = (x1: number, z1: number, x2: number, z2: number) => pts.push(x1, Y, z1, x2, Y, z2);

  // Dimension lines with end ticks and extension lines.
  for (const d of dimensions) {
    const [ax, az] = d.a;
    const [bx, bz] = d.b;
    seg(ax, az, bx, bz);
    const horizontal = az === bz;
    for (const [x, z] of [[ax, az], [bx, bz]] as const) {
      if (horizontal) {
        seg(x, z - 0.35, x, z + 0.35);
        seg(x, z + 0.35, x, z + 1.1);
      } else {
        seg(x - 0.35, z, x + 0.35, z);
        seg(x + 0.35, z, x + 1.1, z);
      }
    }
  }

  // The sun's path round the house, with a small cross at each hour mark.
  for (let i = 0; i < sunArc.length - 1; i++) {
    if (i % 2 === 0) seg(sunArc[i][0], sunArc[i][1], sunArc[i + 1][0], sunArc[i + 1][1]);
  }
  for (const m of sunMarks) {
    seg(m.x - 0.45, m.z, m.x + 0.45, m.z);
    seg(m.x, m.z - 0.45, m.x, m.z + 0.45);
  }

  // Door swings: a leaf opened 90 degrees and the arc it sweeps.
  for (const w of walls) {
    const alongX = w.z1 === w.z2;
    for (const o of w.openings ?? []) {
      if (o.glass || o.w > 2.2 || o.h >= 3) continue;
      const hinge = o.at - o.w / 2;
      const r = o.w;
      const n = -1; // swing towards north / west
      const point = (a: number, across: number) => (alongX ? [a, w.z1 + across * n] : [w.x1 + across * n, a]) as [number, number];
      const [hx, hz] = point(hinge, WALL_T / 2);
      const [tx, tz] = point(hinge, WALL_T / 2 + r);
      seg(hx, hz, tx, tz);
      let prev = point(hinge + r, WALL_T / 2);
      for (let i = 1; i <= 12; i++) {
        const a = (i / 12) * (Math.PI / 2);
        const cur = point(hinge + Math.cos(a) * r, WALL_T / 2 + Math.sin(a) * r);
        seg(prev[0], prev[1], cur[0], cur[1]);
        prev = cur;
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const material = new THREE.LineBasicMaterial({ color: '#1a1714', transparent: true, opacity: 1, toneMapped: false });
  const lines = new THREE.LineSegments(geo, material);
  lines.frustumCulled = false;
  return lines;
}
