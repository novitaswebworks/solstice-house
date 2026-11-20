import * as THREE from 'three';
import type { FloorKind } from './layout';
import { pbrMaterial } from './assets';

// Photographic PBR surfaces from Poly Haven (CC0), tiled by real-world size.

const FLOORS: Record<FloorKind, { set: string; tile: number; extra?: THREE.MeshStandardMaterialParameters }> = {
  gravel: { set: 'gravel_floor_02', tile: 2 },
  terrazzo: { set: 'terrazzo_tiles', tile: 2.4 },
  oak: { set: 'wood_floor', tile: 2.2 },
  oakDark: { set: 'dark_wooden_planks', tile: 2.2 },
  stone: { set: 'large_floor_tiles_02', tile: 2.4 },
  deck: { set: 'wood_planks_grey', tile: 2.2 },
};

export function floorMaterial(kind: FloorKind, widthM: number, depthM: number) {
  const f = FLOORS[kind];
  return pbrMaterial(f.set, widthM, depthM, f.tile, f.extra);
}

export function plasterMaterial() {
  const m = pbrMaterial('white_plaster_02', 1, 1, 1);
  // Walls are boxes whose UVs are already scaled in metres, so undo the repeat.
  for (const t of [m.map, m.normalMap, m.aoMap]) t?.repeat.set(1, 1);
  m.color.set('#ffffff');
  // A faint warm glow lifts walls that face away from the sun.
  m.emissive.set('#3a342c');
  // The scan's stains read as grey concrete at full strength; blend it 35% over white to keep only the trowel texture.
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        diffuseColor *= mix(vec4(1.0), texture2D(map, vMapUv), 0.35);
      #endif
    `);
  };
  m.customProgramCacheKey = () => 'plaster-softened';
  return m;
}

export function fabricMaterial(widthM: number, depthM: number, color = '#ffffff') {
  // Fabric is never metallic. Letting the texture's metal channel through made linen mirror the sky and turn blue.
  const m = pbrMaterial('rough_linen', widthM, depthM, 0.8, { metalness: 0 });
  m.metalnessMap = null;
  m.color.set(color);
  // The linen scan is dyed light blue (average sRGB 144,170,204), which tinted every fabric cool. Keep only its
  // weave (luminance), normalised by that average (~0.38 linear), so each fabric shows its own colour.
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #ifdef USE_MAP
        diffuseColor.rgb *= vec3(dot(texture2D(map, vMapUv).rgb, vec3(0.2126, 0.7152, 0.0722)) / 0.38);
      #endif
    `);
  };
  m.customProgramCacheKey = () => 'fabric-weave-only';
  return m;
}

export function poolTileMaterial(widthM: number, depthM: number) {
  const m = pbrMaterial('long_white_tiles', widthM, depthM, 1.5);
  m.color.set('#8fd0d4');
  return m;
}

export function grassMaterial() {
  const m = pbrMaterial('leafy_grass', 1200, 1200, 5, { transparent: true, opacity: 0 });
  m.color.set('#b6e89a');
  return m;
}

/** Tileable ripple normal map for the pool, drawn in code. */
export function waterNormalMap() {
  const size = 128;
  const h = (x: number, y: number) => {
    const u = (x / size) * Math.PI * 2;
    const v = (y / size) * Math.PI * 2;
    return Math.sin(u * 3 + Math.sin(v * 2)) * 0.5 + Math.sin(v * 4 + u) * 0.35 + Math.sin((u + v) * 5) * 0.2;
  };
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const n = new THREE.Vector3(-dx, -dy, 1.4).normalize();
      const i = (y * size + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 3);
  tex.needsUpdate = true;
  return tex;
}

export const PAPER = new THREE.Color('#f3ece0');
export const INK = new THREE.Color('#2a2623');
export const WHITE = new THREE.Color('#ffffff');
export const GROUND_PLAN = new THREE.Color('#ebe3d5');

export function plain(color: string, rough = 0.8, metal = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
}
