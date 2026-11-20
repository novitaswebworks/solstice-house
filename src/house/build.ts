import * as THREE from 'three';
import { rooms, walls, pool, skylights, plotTrees, WALL_H, WALL_T, type Wall } from './layout';
import { floorMaterial, plain, plasterMaterial, poolTileMaterial, grassMaterial, waterNormalMap } from './materials';
import { tileBoxUVs } from './assets';
import { buildFurniture } from './furniture';
import { createTrees } from './trees';

export interface HouseParts {
  root: THREE.Group;
  /** Walls and fixtures. Scaled up from the plan. */
  rising: THREE.Group;
  furniture: THREE.Group;
  wallMaterial: THREE.MeshStandardMaterial;
  ground: THREE.Mesh;
  lawn: THREE.Mesh;
  water: THREE.MeshPhysicalMaterial | null;
  /** Ceilings over the indoor rooms. They lower into place as the visitor enters. */
  roof: THREE.Group;
  /** Black wall tops, shown only while the sheet is on screen. */
  caps: THREE.Group;
  /** Resolves when every furniture model has loaded. */
  furnished: Promise<void>;
  dispose(): void;
}

const frameMaterial = plain('#1d1a17', 0.45, 0.3);
const trimMaterial = plain('#f4efe6', 0.6);

const capMaterial = new THREE.MeshBasicMaterial({ color: '#1a1714', toneMapped: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });

function shadowed<T extends THREE.Mesh>(mesh: T, cast = true) {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

function addWall(group: THREE.Group, caps: THREE.Group, wall: Wall, material: THREE.Material, glass: THREE.Material) {
  const alongX = wall.z1 === wall.z2;
  const a0 = Math.min(alongX ? wall.x1 : wall.z1, alongX ? wall.x2 : wall.z2);
  const a1 = Math.max(alongX ? wall.x1 : wall.z1, alongX ? wall.x2 : wall.z2);
  const fixed = alongX ? wall.z1 : wall.x1;

  const piece = (from: number, to: number, y0: number, y1: number, cap = true) => {
    if (to - from < 0.001 || y1 - y0 < 0.001) return;
    const len = to - from;
    const geo = new THREE.BoxGeometry(alongX ? len : WALL_T, y1 - y0, alongX ? WALL_T : len);
    tileBoxUVs(geo, alongX ? len : WALL_T, y1 - y0, alongX ? WALL_T : len, 2);
    const mesh = shadowed(new THREE.Mesh(geo, material));
    const mid = (from + to) / 2;
    mesh.position.set(alongX ? mid : fixed, (y0 + y1) / 2, alongX ? fixed : mid);
    group.add(mesh);
    // Skirting board along the foot of every full-height wall, on both faces.
    if (y0 === 0 && y1 === wall.h && wall.h > 1.5) {
      const skirt = shadowed(new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : WALL_T + 0.05, 0.11, alongX ? WALL_T + 0.05 : len), trimMaterial), false);
      skirt.position.set(mesh.position.x, 0.055, mesh.position.z);
      group.add(skirt);
    }
    // A black cap on every wall top: the poche of the plan sheet. Not over openings,
    // so doors and windows read as gaps there (annotations.ts draws their symbols).
    if (cap && y1 === wall.h) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len : WALL_T, 0.03, alongX ? WALL_T : len), capMaterial);
      cap.position.set(mesh.position.x, y1 + 0.015, mesh.position.z);
      caps.add(cap);
    }
  };

  /** A trim box spanning [from, to] along the wall and [y0, y1] in height. */
  const trim = (from: number, to: number, y0: number, y1: number, depth: number, material: THREE.Material) => {
    const geo = new THREE.BoxGeometry(alongX ? to - from : depth, y1 - y0, alongX ? depth : to - from);
    const m = shadowed(new THREE.Mesh(geo, material), false);
    const mid = (from + to) / 2;
    m.position.set(alongX ? mid : fixed, (y0 + y1) / 2, alongX ? fixed : mid);
    group.add(m);
  };

  let cursor = a0 - WALL_T / 2;
  const openings = [...(wall.openings ?? [])].sort((a, b) => a.at - b.at);
  for (const o of openings) {
    const lo = o.at - o.w / 2;
    const hi = o.at + o.w / 2;
    piece(cursor, lo, 0, wall.h);
    if (o.sill) piece(lo, hi, 0, o.sill);
    piece(lo, hi, o.h, wall.h, false);
    if (o.glass) {
      const sill = o.sill ?? 0;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h - sill), glass);
      pane.position.set(alongX ? o.at : fixed, (sill + o.h) / 2, alongX ? fixed : o.at);
      if (!alongX) pane.rotation.y = Math.PI / 2;
      pane.userData.noAO = true;
      group.add(pane);
      // Slim steel window frame: posts, head and sill, plus a mullion on wide openings.
      const f = 0.06;
      trim(lo, lo + f, sill, o.h, 0.12, frameMaterial);
      trim(hi - f, hi, sill, o.h, 0.12, frameMaterial);
      trim(lo, hi, o.h - f, o.h, 0.12, frameMaterial);
      trim(lo, hi, sill, sill + f, 0.12, frameMaterial);
      if (o.w > 2.5) trim(o.at - 0.03, o.at + 0.03, sill, o.h, 0.1, frameMaterial);
      // A deep stone-coloured sill inside every window with a sill height.
      if (sill > 0.1) trim(lo - 0.04, hi + 0.04, sill - 0.04, sill, WALL_T + 0.14, trimMaterial);
    } else {
      // Painted architrave around each doorway, on both faces of the wall.
      const a = 0.07;
      trim(lo - a, lo, 0, o.h + a, WALL_T + 0.04, trimMaterial);
      trim(hi, hi + a, 0, o.h + a, WALL_T + 0.04, trimMaterial);
      trim(lo - a, hi + a, o.h, o.h + a, WALL_T + 0.04, trimMaterial);
    }
    cursor = hi;
  }
  piece(cursor, a1 + WALL_T / 2, 0, wall.h);
}

function addFloor(group: THREE.Group, kind: Parameters<typeof floorMaterial>[0], x0: number, z0: number, x1: number, z1: number, depth = 0.3) {
  const w = x1 - x0;
  const d = z1 - z0;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, depth, d), floorMaterial(kind, w, d));
  mesh.position.set(x0 + w / 2, -depth / 2, z0 + d / 2);
  mesh.receiveShadow = true;
  group.add(mesh);
}

export function buildHouse(): HouseParts {
  const root = new THREE.Group();
  const rising = new THREE.Group();
  const furniture = new THREE.Group();
  const furnished = buildFurniture(furniture);

  const wallMaterial = plasterMaterial();
  const glass = new THREE.MeshPhysicalMaterial({
    color: '#cfe3ea', transparent: true, opacity: 0.16, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false,
  });

  // Paper-coloured ground for the plan, with a lawn that fades in over it.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), new THREE.MeshStandardMaterial({ color: '#ebe3d5', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(13, -0.32, 8);
  ground.receiveShadow = true;
  root.add(ground);
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(1200, 1200), grassMaterial());
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(13, -0.31, 8);
  lawn.receiveShadow = true;
  root.add(lawn);

  for (const room of rooms) {
    if (room.id === 'terrace') continue;
    addFloor(root, room.floor, room.x0, room.z0, room.x1, room.z1);
  }

  let waterMaterial: THREE.MeshPhysicalMaterial | null = null;
  // Terrace deck around the pool
  const t = rooms.find((r) => r.id === 'terrace');
  if (t) {
    const d = pool.depth;
    addFloor(root, 'deck', t.x0, t.z0, t.x1, pool.z0, d);
    addFloor(root, 'deck', t.x0, pool.z1, t.x1, t.z1, d);
    addFloor(root, 'deck', t.x0, pool.z0, pool.x0, pool.z1, d);
    addFloor(root, 'deck', pool.x1, pool.z0, t.x1, pool.z1, d);
    const basin = new THREE.Mesh(new THREE.PlaneGeometry(pool.x1 - pool.x0, pool.z1 - pool.z0), poolTileMaterial(pool.x1 - pool.x0, pool.z1 - pool.z0));
    basin.rotation.x = -Math.PI / 2;
    basin.position.set((pool.x0 + pool.x1) / 2, -pool.depth + 0.02, (pool.z0 + pool.z1) / 2);
    basin.receiveShadow = true;
    root.add(basin);
    waterMaterial = new THREE.MeshPhysicalMaterial({
      color: '#3f9fb0', roughness: 0.03, metalness: 0, transparent: true, opacity: 0.72, clearcoat: 1, envMapIntensity: 1.4,
      normalMap: waterNormalMap(), normalScale: new THREE.Vector2(0.35, 0.35),
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(pool.x1 - pool.x0, pool.z1 - pool.z0), waterMaterial);
    water.userData.noAO = true;
    water.rotation.x = -Math.PI / 2;
    water.position.set((pool.x0 + pool.x1) / 2, -0.14, (pool.z0 + pool.z1) / 2);
    root.add(water);
  }

  // Ceilings: one slab per indoor room, cut around any skylight in it.
  const roof = new THREE.Group();
  // Ceilings only see bounce light, so a brighter, more neutral white keeps them from reading tan beside the walls.
  const roofMaterial = new THREE.MeshStandardMaterial({ color: '#f7f5f1', roughness: 0.9, emissive: '#7a7670' });
  const slab = (x0: number, z0: number, x1: number, z1: number) => {
    const w = x1 - x0;
    const d = z1 - z0;
    if (w < 0.01 || d < 0.01) return;
    const geo = new THREE.BoxGeometry(w, 0.3, d);
    tileBoxUVs(geo, w, 0.3, d, 2);
    const m = shadowed(new THREE.Mesh(geo, roofMaterial));
    m.position.set(x0 + w / 2, WALL_H + 0.15, z0 + d / 2);
    roof.add(m);
  };
  for (const r of rooms.filter((r) => !r.outdoor)) {
    const sky = skylights.find((s) => s.room === r.id);
    if (sky) {
      slab(r.x0 - 0.12, r.z0 - 0.12, r.x1 + 0.12, sky.z0);
      slab(r.x0 - 0.12, sky.z1, r.x1 + 0.12, r.z1 + 0.12);
      slab(r.x0 - 0.12, sky.z0, sky.x0, sky.z1);
      slab(sky.x1, sky.z0, r.x1 + 0.12, sky.z1);
    } else {
      slab(r.x0 - 0.12, r.z0 - 0.12, r.x1 + 0.12, r.z1 + 0.12);
    }
  }
  root.add(roof);

  const caps = new THREE.Group();
  for (const wall of walls) addWall(rising, caps, wall, wallMaterial, glass);
  rising.add(caps);

  const detailed = !matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  // Trees 0 and 4 are replaced by scanned trees on desktop.
  rising.add(createTrees(plotTrees.filter((_, i) => !(detailed && (i === 0 || i === 4))).map(([x, z, s]) => ({ x, z, scale: s * 0.95 }))));

  root.add(rising);
  root.add(furniture);

  return {
    root,
    rising,
    furniture,
    wallMaterial,
    ground,
    lawn,
    roof,
    water: waterMaterial,
    caps,
    furnished,
    dispose() {
      root.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (!mesh.isMesh) return;
        mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          (m as THREE.MeshStandardMaterial).map?.dispose();
          m.dispose();
        }
      });
    },
  };
}
