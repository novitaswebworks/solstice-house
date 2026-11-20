import * as THREE from 'three';
import { coarse } from './assets';

// Trees without downloads. A canopy is a cloud of leaf cards (one alpha-cut leaf-cluster texture,
// drawn on a canvas), merged into a single mesh for all trees. Card normals are bent outwards from
// each crown so the canopy shades as a soft mass rather than as flat cards. A seeded random keeps
// every visit (and the baked sun study) identical.

export interface TreeSpec { x: number; z: number; scale: number; olive?: boolean }

/** Crown lobes relative to the trunk base, in metres at scale 1: [x, y, z, radius]. */
const LOBES: Array<[number, number, number, number]> = [[0, 2.15, 0, 1.0], [0.6, 1.8, 0.3, 0.72], [-0.5, 1.9, -0.3, 0.76], [0.1, 2.7, 0.2, 0.7], [-0.3, 1.55, 0.5, 0.56]];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function leafTexture(narrow: boolean) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  const r = rng(narrow ? 7 : 3);
  for (let i = 0; i < 70; i++) {
    // Keep leaves inside a rounded cluster so card corners stay empty.
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r()) * size * 0.38;
    const x = size / 2 + Math.cos(a) * d;
    const y = size / 2 + Math.sin(a) * d;
    const len = (narrow ? 22 : 18) + r() * 12;
    const wid = narrow ? 4 + r() * 2 : 8 + r() * 5;
    const tone = 150 + Math.floor(r() * 90);
    g.save();
    g.translate(x, y);
    g.rotate(r() * Math.PI * 2);
    g.fillStyle = `rgb(${tone},${tone},${tone})`;
    g.beginPath();
    g.ellipse(0, 0, wid, len, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = `rgba(0,0,0,0.25)`;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, -len * 0.9);
    g.lineTo(0, len * 0.9);
    g.stroke();
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function barkTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  if (!g) throw new Error('2D canvas unavailable');
  g.fillStyle = '#6b5846';
  g.fillRect(0, 0, 128, 256);
  const r = rng(11);
  for (let i = 0; i < 90; i++) {
    const shade = r() < 0.5 ? 'rgba(40,30,22,' : 'rgba(150,130,110,';
    g.fillStyle = `${shade}${0.15 + r() * 0.35})`;
    g.fillRect(r() * 128, r() * 256, 1 + r() * 3, 20 + r() * 90);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let bark: THREE.MeshStandardMaterial | null = null;
const leaves = new Map<boolean, THREE.MeshStandardMaterial>();
function leafMaterial(olive: boolean) {
  let m = leaves.get(olive);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: leafTexture(olive), vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: olive ? 0.7 : 0.85 });
    leaves.set(olive, m);
  }
  return m;
}

/** Trunks, branches and one merged canopy mesh per leaf type. */
export function createTrees(specs: TreeSpec[], seed = 1) {
  const group = new THREE.Group();
  bark ??= new THREE.MeshStandardMaterial({ map: barkTexture(), color: '#8a7b6c', roughness: 0.95 });
  const r = rng(seed);
  const cardsPerUnit = coarse ? 70 : 170;
  const buffers = new Map<boolean, { pos: number[]; nor: number[]; uv: number[]; col: number[]; idx: number[] }>();
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const radial = new THREE.Vector3();
  const base = new THREE.Color();
  const tint = new THREE.Color();

  for (const t of specs) {
    const s = t.scale;
    const lean = (r() - 0.5) * 0.12;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.17 * s, 1.75 * s, 10), bark);
    trunk.position.set(t.x, 0.875 * s, t.z);
    trunk.rotation.z = lean;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);
    // Branches from the top of the trunk up into each lobe.
    const top = new THREE.Vector3(t.x, 1.65 * s, t.z);
    for (const [bx, by, bz] of LOBES.slice(0, 4)) {
      const tip = new THREE.Vector3(t.x + bx * s * 0.8, by * s * 0.95, t.z + bz * s * 0.8);
      const len = tip.distanceTo(top);
      const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.025 * s, 0.06 * s, len, 6), bark);
      branch.position.copy(top).add(tip).multiplyScalar(0.5);
      branch.quaternion.setFromUnitVectors(up, v.copy(tip).sub(top).normalize());
      branch.castShadow = true;
      group.add(branch);
    }

    const olive = !!t.olive;
    let buf = buffers.get(olive);
    if (!buf) { buf = { pos: [], nor: [], uv: [], col: [], idx: [] }; buffers.set(olive, buf); }
    base.set(olive ? '#7d8f6a' : '#55733f');
    for (const [lx, ly, lz, lr] of LOBES) {
      const centre = new THREE.Vector3(t.x + lx * s, ly * s, t.z + lz * s);
      const count = Math.round(cardsPerUnit * lr * lr);
      for (let i = 0; i < count; i++) {
        // Bias cards towards the crown's surface, where leaves catch the light.
        v.set(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1);
        if (v.lengthSq() > 1) { i--; continue; }
        const depth = 0.55 + 0.45 * Math.cbrt(r());
        v.normalize().multiplyScalar(lr * s * depth);
        const p = centre.clone().add(v);
        radial.copy(v).normalize();
        q.setFromEuler(new THREE.Euler(r() * Math.PI, r() * Math.PI, r() * Math.PI));
        const half = (0.32 + r() * 0.18) * s;
        // Inner cards darker (self-shadowing), plus a little per-card hue jitter.
        tint.copy(base).offsetHSL((r() - 0.5) * 0.04, (r() - 0.5) * 0.1, (r() - 0.5) * 0.08);
        tint.multiplyScalar(0.55 + 0.45 * depth);
        const start = buf.pos.length / 3;
        for (const [cx, cy, u, w] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]] as const) {
          v.set(cx * half, cy * half, 0).applyQuaternion(q).add(p);
          buf.pos.push(v.x, v.y, v.z);
          n.set(0, 0, 1).applyQuaternion(q);
          if (n.dot(radial) < 0) n.negate();
          n.lerp(radial, 0.75).normalize();
          buf.nor.push(n.x, n.y, n.z);
          buf.uv.push(u, w);
          buf.col.push(tint.r, tint.g, tint.b);
        }
        buf.idx.push(start, start + 1, start + 2, start, start + 2, start + 3);
      }
    }
  }

  for (const [olive, b] of buffers) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(b.nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(b.col, 3));
    geo.setIndex(b.idx);
    geo.computeBoundingSphere();
    const canopy = new THREE.Mesh(geo, leafMaterial(olive));
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    // The AO pass ignores alpha cut-outs and would shade whole cards; the sun study should still count them.
    canopy.userData.noAO = true;
    canopy.userData.sunBlocker = true;
    group.add(canopy);
  }
  return group;
}
