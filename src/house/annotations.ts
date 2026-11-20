import * as THREE from 'three';
import { dimensionSegs, doorSegs, sunPathSegs, windowSegs } from './planGeometry';

/** Thin ink lines for the plan sheet: dimensions, sun path, door swings and window symbols. */
export function buildAnnotations() {
  const Y = 0.12;
  const pts: number[] = [];
  for (const [x1, z1, x2, z2] of [...dimensionSegs(), ...sunPathSegs(), ...doorSegs(), ...windowSegs()]) pts.push(x1, Y, z1, x2, Y, z2);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const material = new THREE.LineBasicMaterial({ color: '#1a1714', transparent: true, opacity: 1, toneMapped: false });
  const lines = new THREE.LineSegments(geo, material);
  lines.frustumCulled = false;
  return lines;
}
