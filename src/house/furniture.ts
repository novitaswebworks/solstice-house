import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { createTrees } from './trees';
import { hangPrint } from './prints';
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
    // Softly rounded edges (up to 1.8 cm) catch a highlight the way real joinery does; paper-thin pieces stay square.
    const r = Math.min(0.018, Math.min(w, h, d) * 0.35);
    const geo = r < 0.004 ? new THREE.BoxGeometry(w, h, d) : new RoundedBoxGeometry(w, h, d, 2, r);
    const m = shadow(new THREE.Mesh(geo, typeof material === 'string' ? mat(material, rough) : material));
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

  /** Upholstery and bedding: corners up to `r` round, optionally tipped about z (negative lifts the west end). */
  const soft = (cx: number, baseY: number, cz: number, w: number, h: number, d: number, material: THREE.Material, r = 0.06, tilt = 0) => {
    const m = shadow(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, Math.min(w, h, d) / 2 - 0.001)), material));
    m.position.set(cx, baseY + h / 2, cz);
    m.rotation.z = tilt;
    g.add(m);
    return m;
  };
  /** A woven rug: a darker bound border with the field set a millimetre proud of it. */
  const rug = (cx: number, cz: number, w: number, d: number, field: string, border: string) => {
    box(cx, 0.004, cz, w, 0.012, d, fabricMaterial(w, d, border));
    box(cx, 0.0045, cz, w - 0.18, 0.013, d - 0.18, fabricMaterial(w - 0.18, d - 0.18, field));
  };

  // ── Built-ins and soft furnishings (drawn in code) ──
  // Gate court: stepping stones, a bench and an olive tree
  // Stone pieces share the kitchen's photographic stone tile, so nothing new loads.
  const stone = (w: number, d: number) => floorMaterial('stone', w, d);
  for (let i = 0; i < 5; i++) box(11, 0, 16.2 + i * 0.95, 1.2, 0.05, 0.6, stone(1.2, 0.6));
  box(13.4, 0, 17.6, 0.5, 0.45, 2.2, stone(0.5, 2.2));
  g.add(createTrees([{ x: 9.2, z: 17.2, scale: 0.8, olive: true }], 2));

  // The gate: two timber leaves swung open into the court, and a stone path out to the street
  const gateWood = floorMaterial('oakDark', 1.2, 2.0);
  for (const gx of [9.8, 12.2]) box(gx, 0, 20.35, 0.08, 2.0, 1.2, gateWood);
  box(9.78, 0, 21, 0.2, 2.2, 0.3, stone(0.3, 2.2));
  box(12.22, 0, 21, 0.2, 2.2, 0.3, stone(0.3, 2.2));
  for (let i = 0; i < 5; i++) box(11, 0, 22.2 + i * 1.1, 1.4, 0.05, 0.7, stone(1.4, 0.7));

  // Hall: runner, and an oak coat rail with four brass hooks on the west wall above the bench.
  rug(11, 13, 1.4, 3.2, '#9e5a3f', '#5f3626'); // muted clay: true terracotta read as bright orange on the floor
  box(8.135, 1.6, 12.9, 0.03, 0.1, 1.1, floorMaterial('oak', 1.1, 0.1));
  for (const hz of [12.5, 12.77, 13.03, 13.3]) {
    const hook = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.012, 0.09, 10), plain('#b08d57', 0.35, 0.9)));
    hook.rotation.z = Math.PI / 2 - 0.35; // angled up so a coat would stay on
    hook.position.set(8.19, 1.66, hz);
    g.add(hook);
  }

  // Living room: rug and a floor lamp (weighted disc, slim brass stem, open linen drum that glows from inside)
  rug(9, 5.9, 4, 3, '#efe3cf', '#b9a58a');
  const brass = plain('#b08d57', 0.35, 0.9);
  cyl(4.6, 0, 8.6, 0.16, 0.025, C.black, 0.4);
  const stem = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1.5, 12), brass));
  stem.position.set(4.6, 0.775, 8.6);
  g.add(stem);
  const shadeMat = fabricMaterial(1.4, 0.32, '#f3e8d4');
  shadeMat.side = THREE.DoubleSide;
  shadeMat.emissive.set('#ffcf8a');
  shadeMat.emissiveIntensity = 0.3;
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.32, 40, 1, true), shadeMat);
  shade.position.set(4.6, 1.66, 8.6);
  g.add(shade);

  // Kitchen: a dark carcass behind separate door fronts, so 4 mm shadow gaps read as joinery.
  const carcass = '#22362b';
  const steel = plain('#c4c6c6', 0.55, 0.45);
  const handle = plain('#1f1c1a', 0.35, 0.6);
  /** `n` door fronts across [x0, x1] and [y0, y1] on the face at z = `face`, facing `dir` (-1 north, +1 south). */
  const fronts = (x0: number, x1: number, y0: number, y1: number, face: number, dir: number, n: number, pull: 'top' | 'bottom', skip = -1) => {
    const w = (x1 - x0) / n;
    for (let i = 0; i < n; i++) {
      if (i === skip) continue;
      const cx = x0 + w * (i + 0.5);
      box(cx, y0, face + dir * 0.011, w - 0.004, y1 - y0, 0.02, C.green, 0.45);
      box(cx, pull === 'top' ? y1 - 0.07 : y0 + 0.04, face + dir * 0.032, Math.min(0.26, w * 0.45), 0.014, 0.016, handle);
    }
    return w;
  };
  // Base run along the south wall: plinth, carcass, twelve fronts with an oven in the seventh slot.
  box(18.8, 0, 10.66, 7.56, 0.1, 0.48, '#1b231e', 0.7);
  box(18.8, 0.1, 10.62, 7.6, 0.8, 0.56, carcass, 0.6);
  const slot = fronts(15, 22.6, 0.12, 0.86, 10.34, -1, 12, 'top', 6);
  const ovenX = 15 + slot * 6.5;
  box(ovenX, 0.12, 10.33, slot - 0.004, 0.74, 0.02, plain('#121212', 0.12, 0.2));
  box(ovenX, 0.2, 10.318, slot - 0.12, 0.42, 0.004, plain('#050505', 0.05, 0.1));
  box(ovenX, 0.74, 10.29, slot - 0.12, 0.018, 0.018, steel);
  box(18.8, 0.9, 10.6, 7.8, 0.05, 0.64, '#e7e2d8', 0.25);
  // Sink with a pillar tap, set into the worktop by the window end.
  box(16.3, 0.951, 10.56, 0.74, 0.006, 0.46, steel);
  box(16.3, 0.952, 10.56, 0.64, 0.006, 0.36, plain('#4f5457', 0.25, 0.85));
  cyl(16.3, 0.95, 10.8, 0.016, 0.32, '#b9bdbf', 0.3);
  const spout = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 12), steel));
  spout.rotation.x = Math.PI / 2;
  spout.position.set(16.3, 1.26, 10.7);
  g.add(spout);
  // Island: plinth, carcass, fronts on the working (south) side, overhang for the stools to the north.
  box(19, 0, 8.4, 2.9, 0.1, 0.9, '#1b231e', 0.7);
  box(19, 0.1, 8.4, 3, 0.8, 1, carcass, 0.6);
  fronts(17.5, 20.5, 0.12, 0.86, 8.9, 1, 5, 'top');
  box(19, 0.9, 8.4, 3.3, 0.06, 1.25, '#e7e2d8', 0.25);
  // Tiled splashback, wall cabinets with fronts, a steel hood between them, and a hob on the island.
  const splash = pbrMaterial('long_white_tiles', 7.6, 0.6, 1.2);
  box(18.8, 0.95, 10.84, 7.6, 0.55, 0.02, splash);
  box(17.2, 1.55, 10.72, 3.2, 0.8, 0.32, carcass, 0.6);
  fronts(15.6, 18.8, 1.55, 2.35, 10.56, -1, 6, 'bottom');
  box(20.9, 1.55, 10.72, 2.6, 0.8, 0.32, carcass, 0.6);
  fronts(19.6, 22.2, 1.55, 2.35, 10.56, -1, 5, 'bottom');
  box(19.2, 1.7, 10.68, 0.76, 0.66, 0.3, steel);
  box(19, 0.96, 8.4, 0.7, 0.02, 0.5, plain('#0e0e0e', 0.15, 0.2));
  box(20.8, 0.7, 5, 2.4, 0.06, 1.2, floorMaterial('oak', 2.4, 1.2), 0.6);
  for (const [lx, lz] of [[19.8, 4.5], [21.8, 4.5], [19.8, 5.5], [21.8, 5.5]] as const) cyl(lx, 0, lz, 0.04, 0.7, C.black, 0.4);

  // Terrace: two timber loungers (legs, frame, flat cushion, raised back) and a ribbed parasol
  const teak = floorMaterial('oak', 0.72, 1.95);
  const cushion = fabricMaterial(0.66, 1.4, C.linen);
  for (const lx of [19.4, 21.2]) {
    for (const [dx, dz] of [[-0.31, 0.55], [0.31, 0.55], [-0.31, 2.25], [0.31, 2.25]] as const) box(lx + dx, 0, 1.4 + dz - 1.0, 0.05, 0.24, 0.05, teak);
    box(lx, 0.22, 1.725, 0.72, 0.06, 1.3, teak);
    soft(lx, 0.28, 1.72, 0.66, 0.08, 1.26, cushion, 0.035);
    // The back rises towards the pool (north): a timber board and cushion tipped about x.
    for (const [y, h, mat2] of [[0.42, 0.05, teak], [0.47, 0.08, cushion]] as const) {
      const back = soft(lx, y, 0.78, 0.66, h, 0.72, mat2, 0.03);
      back.rotation.x = 0.7;
    }
  }
  box(22.2, 0, 0.3, 0.5, 0.08, 0.5, floorMaterial('stone', 0.5, 0.5));
  const pole = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.75, 12), teak));
  pole.position.set(22.2, 1.42, 0.3);
  g.add(pole);
  const canvas = fabricMaterial(3, 3, C.terracotta);
  canvas.side = THREE.DoubleSide;
  const canopy = shadow(new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.42, 8, 1, true), canvas));
  canopy.position.set(22.2, 2.55, 0.3);
  g.add(canopy);
  // Eight ribs from the crown out to the canopy's corners, just under the fabric.
  const crown = new THREE.Vector3(22.2, 2.68, 0.3);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const tip = new THREE.Vector3(22.2 + Math.sin(a) * 1.46, 2.33, 0.3 + Math.cos(a) * 1.46);
    const rib = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, crown.distanceTo(tip), 6), teak));
    rib.position.copy(crown).add(tip).multiplyScalar(0.5);
    rib.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(crown).normalize());
    g.add(rib);
  }
  const finial = shadow(new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), teak));
  finial.position.set(22.2, 2.79, 0.3);
  g.add(finial);

  // Bedroom: rug, then a bed of soft, well-rounded pieces on a walnut frame. Head against the west wall.
  rug(6.2, -1, 3.4, 2.8, '#dcb98f', '#8a6a48');
  const duvet = fabricMaterial(1.4, 2.0, '#ece5d9');
  box(4.6, 0.02, -1, 2.1, 0.06, 1.8, '#1b1714', 0.8); // recessed plinth, so the bed seems to float
  box(4.6, 0.08, -1, 2.3, 0.22, 2.0, floorMaterial('oakDark', 2.3, 2.0));
  soft(4.62, 0.3, -1, 2.1, 0.22, 1.86, fabricMaterial(2.1, 1.86, '#f4efe6'), 0.07);
  soft(5.0, 0.49, -1, 1.42, 0.08, 2.0, duvet, 0.04); // drapes past the mattress sides
  soft(4.27, 0.52, -1, 0.26, 0.08, 2.0, duvet, 0.04); // cuff folded back
  soft(5.35, 0.575, -1, 0.5, 0.025, 2.03, fabricMaterial(0.5, 2.0, C.terracotta), 0.012);
  soft(3.24, 0.3, -1, 0.14, 0.95, 2.1, fabricMaterial(0.14, 2.1, '#cdbfa8'), 0.05); // upholstered headboard
  for (const pz of [-1.48, -0.52]) soft(3.62, 0.56, pz, 0.5, 0.15, 0.74, fabricMaterial(0.5, 0.74, '#ffffff'), 0.07, -0.45);
  soft(3.92, 0.53, -1, 0.15, 0.4, 0.4, fabricMaterial(0.4, 0.4, C.terracotta), 0.07, -0.22);

  // ── Photographic models (Poly Haven, CC0) ──
  const jobs: Array<[string, ModelFit]> = [
    // Living room
    ['sofa_02', { x: 9, z: 3.7, ry: 0, width: 2.7 }],
    ['modern_coffee_table_01', { x: 9, z: 5.5, ry: Math.PI / 2, width: 1.2 }],
    ['mid_century_lounge_chair', { x: 6.7, z: 6.4, ry: Math.PI / 2 + 0.25, height: 0.85 }],
    ['mid_century_lounge_chair', { x: 10.6, z: 6.9, ry: -Math.PI / 2 - 0.25, height: 0.85 }],
    ['modern_wooden_cabinet', { x: 6.2, z: 10.5, ry: Math.PI, width: 2.4 }],
    // This scan's long side runs along z, so ry 0 stands it flat against the west wall (it is open-backed and symmetric).
    ['wooden_display_shelves_01', { x: 3.4, z: 9.2, ry: 0, height: 1.6 }],
    ['side_table_tall_01', { x: 7.4, z: 3.75, ry: 0, height: 0.6 }],
    ['potted_plant_02', { x: 13.3, z: 9.8, height: 1.1 }],
    ['fern_02', { x: 3.9, z: 3.9, height: 0.7 }],
    // Hall
    ['drawer_cabinet', { x: 13.6, z: 13.3, ry: -Math.PI / 2, height: 1.1 }],
    ['ornate_mirror_01', { x: 13.82, z: 13.3, y: 1.35, ry: -Math.PI / 2, height: 0.9 }],
    ['potted_plant_02', { x: 8.8, z: 14.2, height: 0.9 }],
    // Hall: a pair of framed pictures either side of the living-room door, a pendant over the walk,
    // a bench under the coat rail, and a bowl for keys on the cabinet.
    ['hanging_picture_frame_01', { x: 9.0, z: 11.135, y: 1.13, ry: 0, height: 0.84 }],
    ['hanging_picture_frame_01', { x: 13.0, z: 11.135, y: 1.13, ry: 0, height: 0.84 }],
    ['modern_ceiling_lamp_01', { x: 11, z: 13, y: 2.25, height: 0.95 }],
    ['painted_wooden_bench', { x: 8.4, z: 12.9, ry: Math.PI / 2, width: 1.165 }],
    ['wooden_bowl_01', { x: 13.6, z: 13.3, y: 1.1, width: 0.3 }],
    // Scanned cushions on the sofa
    ['throw_pillows_01', { x: 8.2, z: 3.85, y: 0.42, ry: 0, width: 0.95, lazy: true }],
    // Kitchen and dining
    ['ceramic_vase_01', { x: 20.8, z: 5, y: 0.76, height: 0.32, lazy: true }],
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
  const load = ([id, fit]: [string, ModelFit]) => placeModel(g, id, fit)
    .then((obj) => { if (id === 'hanging_picture_frame_01') hangPrint(obj); })
    .catch((e) => console.warn(`Model ${id} failed`, e));
  // Only the first screens block the loader; the rest arrive while you scroll.
  const first = Promise.all(jobs.filter(([, f]) => !f.lazy).map(load)).then(() => undefined);
  void Promise.all(jobs.filter(([, f]) => f.lazy).map(load));
  return first;
}
