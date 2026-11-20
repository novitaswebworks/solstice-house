import * as THREE from 'three';
import { plain, floorMaterial, fabricMaterial } from './materials';
import { placeModel, pbrMaterial, type ModelFit } from './assets';

const mats = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, rough = 0.8) {
  const key = `${color}:${rough}`;
  let m = mats.get(key);
  if (!m) {
    m = plain(color, rough);
    mats.set(key, m);
  }
  return m;
}

const C = {
  linen: '#f1ece2', terracotta: '#c4572f', green: '#2f4a3c', sage: '#8fa38a',
  black: '#2a2623', stone: '#d9d2c4', walnut: '#6e4c33',
};

/**
 * Furniture is photographic Poly Haven models where one exists (sofa, chairs,
 * cabinets, plants) and simple built-in pieces (counters, rugs, bed, pool
 * loungers) drawn in code. Models face south (+z) at rotation 0.
 */
export function buildFurniture(g: THREE.Group): Promise<void> {
  const shadow = (m: THREE.Mesh) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const box = (cx: number, baseY: number, cz: number, w: number, h: number, d: number, material: THREE.Material | string, rough = 0.8) => {
    const m = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'string' ? mat(material, rough) : material));
    m.position.set(cx, baseY + h / 2, cz);
    g.add(m);
    return m;
  };
  const cyl = (cx: number, baseY: number, cz: number, r: number, h: number, color: string, rough = 0.8) => {
    const m = shadow(new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), mat(color, rough)));
    m.position.set(cx, baseY + h / 2, cz);
    g.add(m);
    return m;
  };

  // ── Built-ins and soft furnishings (drawn in code) ──
  // Gate court: stepping stones, a bench and an olive tree
  for (let i = 0; i < 5; i++) box(11, 0, 16.2 + i * 0.95, 1.2, 0.05, 0.6, C.stone, 0.9);
  box(13.4, 0, 17.6, 0.5, 0.45, 2.2, C.stone, 0.9);
  const olive = new THREE.Group();
  olive.position.set(9.2, 0, 17.2);
  olive.scale.setScalar(0.72);
  const trunk = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.22, 1.9, 10), mat('#6b5846', 0.95)));
  trunk.position.set(0, 0.95, 0);
  olive.add(trunk);
  for (const [dx, dy, dz, r] of [[0, 2.5, 0, 1.15], [0.7, 2.1, 0.4, 0.8], [-0.6, 2.2, -0.4, 0.85], [0.1, 3.0, -0.2, 0.7]] as const) {
    const b = shadow(new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), mat('#5d7049', 0.95)));
    b.position.set(dx, dy, dz);
    olive.add(b);
  }
  g.add(olive);

  // The gate: two timber leaves swung open into the court, and a stone path out to the street
  for (const gx of [9.8, 12.2]) box(gx, 0, 20.35, 0.08, 2.0, 1.2, '#5a4432', 0.6);
  box(9.78, 0, 21, 0.2, 2.2, 0.3, C.stone, 0.9);
  box(12.22, 0, 21, 0.2, 2.2, 0.3, C.stone, 0.9);
  for (let i = 0; i < 5; i++) box(11, 0, 22.2 + i * 1.1, 1.4, 0.05, 0.7, C.stone, 0.9);

  // Hall runner
  box(11, 0.005, 13, 1.4, 0.02, 3.2, fabricMaterial(1.4, 3.2, C.terracotta));

  // Living room: rug and floor lamp
  box(9, 0.005, 5.9, 4, 0.02, 3, fabricMaterial(4, 3, '#f2dcb8'));
  cyl(4.6, 0, 8.6, 0.03, 1.6, C.black, 0.4);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.3, 24), new THREE.MeshStandardMaterial({ color: '#f3e3c3', emissive: '#ffcf8a', emissiveIntensity: 0.35, roughness: 0.9 }));
  shade.position.set(4.6, 1.7, 8.6);
  g.add(shade);

  // Kitchen: cabinetry and island, with a timber table
  box(18.8, 0, 10.6, 7.6, 0.9, 0.6, C.green, 0.5);
  box(18.8, 0.9, 10.6, 7.8, 0.05, 0.64, '#e7e2d8', 0.25);
  box(19, 0, 8.4, 3, 0.9, 1, C.green, 0.5);
  box(19, 0.9, 8.4, 3.3, 0.06, 1.25, '#e7e2d8', 0.25);
  // Tiled splashback, wall cabinets and a hob
  const splash = pbrMaterial('long_white_tiles', 7.6, 0.6, 1.2);
  box(18.8, 0.95, 10.84, 7.6, 0.55, 0.02, splash);
  box(17.2, 1.55, 10.7, 3.2, 0.8, 0.34, C.green, 0.5);
  box(20.9, 1.55, 10.7, 2.6, 0.8, 0.34, C.green, 0.5);
  box(19.05, 1.7, 10.68, 1.0, 0.7, 0.3, '#b8b2a6', 0.3);
  box(19, 0.96, 8.4, 0.7, 0.02, 0.5, C.black, 0.3);
  box(20.8, 0.7, 5, 2.4, 0.06, 1.2, floorMaterial('oak', 2.4, 1.2), 0.6);
  for (const [lx, lz] of [[19.8, 4.5], [21.8, 4.5], [19.8, 5.5], [21.8, 5.5]] as const) cyl(lx, 0, lz, 0.04, 0.7, C.black, 0.4);

  // Terrace: loungers and a parasol
  for (const lx of [19.4, 21.2]) {
    box(lx, 0, 1.4, 0.75, 0.3, 1.9, fabricMaterial(0.75, 1.9, C.linen));
    box(lx, 0.3, 0.7, 0.75, 0.35, 0.3, fabricMaterial(0.75, 0.3, C.linen));
  }
  cyl(22.2, 0, 0.3, 0.04, 2.4, C.black, 0.5);
  const parasol = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.45, 32), mat(C.terracotta, 0.9)));
  parasol.position.set(22.2, 2.55, 0.3);
  g.add(parasol);

  // Bedroom: bed, rug
  box(6.2, 0.005, -1, 3.4, 0.02, 2.8, fabricMaterial(3.4, 2.8, '#dcb98f'));
  box(4.5, 0.1, -1, 2.2, 0.35, 1.9, fabricMaterial(2.2, 1.9, '#f4efe6'));
  box(3.25, 0.1, -1, 0.15, 1.1, 2.1, C.walnut, 0.5);
  for (const pz of [-1.55, -0.45]) box(3.9, 0.45, pz, 0.5, 0.12, 0.7, fabricMaterial(0.5, 0.7, '#ffffff'));
  box(5.2, 0.45, -1, 1.1, 0.06, 1.95, fabricMaterial(1.1, 1.95, C.terracotta));

  // ── Photographic models (Poly Haven, CC0) ──
  const jobs: Array<[string, ModelFit]> = [
    // Living room
    ['sofa_02', { x: 9, z: 3.7, ry: 0, width: 2.7 }],
    ['modern_coffee_table_01', { x: 9, z: 5.5, ry: Math.PI / 2, width: 1.2 }],
    ['mid_century_lounge_chair', { x: 6.7, z: 6.4, ry: Math.PI / 2 + 0.25, height: 0.85 }],
    ['mid_century_lounge_chair', { x: 10.6, z: 6.9, ry: -Math.PI / 2 - 0.25, height: 0.85 }],
    ['modern_wooden_cabinet', { x: 6.2, z: 10.5, ry: Math.PI, width: 2.4 }],
    ['wooden_display_shelves_01', { x: 3.4, z: 9.2, ry: -Math.PI / 2, height: 1.6 }],
    ['side_table_tall_01', { x: 7.4, z: 3.75, ry: 0, height: 0.6 }],
    ['potted_plant_02', { x: 13.3, z: 9.8, height: 1.1 }],
    ['fern_02', { x: 3.9, z: 3.9, height: 0.7 }],
    // Hall
    ['drawer_cabinet', { x: 13.6, z: 13.3, ry: -Math.PI / 2, height: 1.1 }],
    ['ornate_mirror_01', { x: 13.82, z: 13.3, y: 1.35, ry: -Math.PI / 2, height: 0.9 }],
    ['potted_plant_02', { x: 8.8, z: 14.2, height: 0.9 }],
    // Kitchen and dining
    ['dining_chair_02', { x: 20.2, z: 3.95, ry: 0, height: 0.9, lazy: true }],
    ['dining_chair_02', { x: 21.4, z: 3.95, ry: 0, height: 0.9, lazy: true }],
    ['dining_chair_02', { x: 20.2, z: 6.05, ry: Math.PI, height: 0.9, lazy: true }],
    ['dining_chair_02', { x: 21.4, z: 6.05, ry: Math.PI, height: 0.9, lazy: true }],
    ['bar_chair_round_01', { x: 18, z: 7.25, ry: Math.PI, height: 0.75, lazy: true }],
    ['bar_chair_round_01', { x: 19, z: 7.25, ry: Math.PI, height: 0.75, lazy: true }],
    ['bar_chair_round_01', { x: 20, z: 7.25, ry: Math.PI, height: 0.75, lazy: true }],
    ['calathea_orbifolia_01', { x: 15.2, z: 10.6, y: 0.95, height: 0.55, lazy: true }],
    // Terrace
    ['planter_box_01', { x: 12.6, z: -4.7, width: 0.9, lazy: true }],
    ['planter_box_01', { x: 16, z: -4.7, width: 0.9, lazy: true }],
    ['planter_box_01', { x: 19.4, z: -4.7, width: 0.9, lazy: true }],
    ['fern_02', { x: 12.6, z: -4.7, y: 0.4, height: 0.5, lazy: true }],
    ['fern_02', { x: 16, z: -4.7, y: 0.4, height: 0.5, lazy: true }],
    ['fern_02', { x: 19.4, z: -4.7, y: 0.4, height: 0.5, lazy: true }],
    // Bedroom
    ['painted_wooden_nightstand', { x: 3.55, z: -2.5, ry: Math.PI / 2, height: 0.55, lazy: true }],
    ['painted_wooden_nightstand', { x: 3.55, z: 0.5, ry: Math.PI / 2, height: 0.55, lazy: true }],
    ['drawer_cabinet', { x: 9.3, z: -4.55, ry: 0, height: 2.1, lazy: true }],
    ['modern_arm_chair_01', { x: 9.6, z: 1.4, ry: Math.PI + 0.6, height: 0.9, lazy: true }],
    ['Ottoman_01', { x: 6.2, z: -1, ry: Math.PI / 2, width: 0.9, lazy: true }],
    // Olive-like trees: very detailed, so desktop only
    ...(matchMedia('(max-width: 760px), (pointer: coarse)').matches ? [] : ([
      ['searsia_lucida', { x: 0.5, z: 14, ry: 0.4, height: 4.2 }],
      ['searsia_lucida', { x: 27.5, z: 2, ry: 2.4, height: 4.6 }],
    ] as Array<[string, ModelFit]>)),
    // Garden shrubs
    ['shrub_02', { x: 5.2, z: 13.6, ry: 0.6, height: 1.5 }],
    ['shrub_02', { x: 16.6, z: 15.2, ry: 2.1, height: 1.7 }],
    ['shrub_02', { x: 16.8, z: 19.4, ry: 4, height: 1.4 }],
    ['shrub_02', { x: 25.5, z: 9, ry: 1.3, height: 1.6 }],
    ['shrub_02', { x: 25.6, z: -2, ry: 3.3, height: 1.5 }],
  ];
  const load = ([id, fit]: [string, ModelFit]) => placeModel(g, id, fit).catch((e) => console.warn(`Model ${id} failed`, e));
  // Only the first screens block the loader; the rest arrive while you scroll.
  const first = Promise.all(jobs.filter(([, f]) => !f.lazy).map(load)).then(() => undefined);
  void Promise.all(jobs.filter(([, f]) => f.lazy).map(load));
  return first;
}
