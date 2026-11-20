import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// All photographic assets come from Poly Haven (https://polyhaven.com), CC0.
// They live in /public/assets and load through one shared manager so the
// loader screen can show real progress.

export const manager = new THREE.LoadingManager();

// Progress for the loading screen.
const progressListeners = new Set<(fraction: number) => void>();
let idleResolvers: Array<() => void> = [];
let counts = { loaded: 0, total: 0 };
const notify = () => progressListeners.forEach((cb) => cb(counts.total ? counts.loaded / counts.total : 0));
manager.onStart = (_u, loaded, total) => { counts = { loaded, total }; notify(); };
manager.onProgress = (_u, loaded, total) => { counts = { loaded, total }; notify(); };
manager.onLoad = () => { idleResolvers.forEach((r) => r()); idleResolvers = []; };
export const onLoadProgress = (cb: (fraction: number) => void) => {
  progressListeners.add(cb);
  return () => { progressListeners.delete(cb); };
};
/** Resolves when the shared manager has no downloads left. */
export const whenIdle = () => new Promise<void>((resolve) => {
  if (counts.total === 0 || counts.loaded >= counts.total) resolve();
  else idleResolvers.push(resolve);
});
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const assetUrl = (path: string) => `${base}/assets/${path}`;

export const coarse = typeof matchMedia === 'function' && matchMedia('(max-width: 760px), (pointer: coarse)').matches;
const texDir = coarse ? 'tex-s' : 'tex';

const textureLoader = new THREE.TextureLoader(manager);
const gltfLoader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder);
// Models that are not needed on first screen load quietly in the background.
const lazyGltfLoader = new GLTFLoader(new THREE.LoadingManager()).setMeshoptDecoder(MeshoptDecoder);

export interface TextureSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  /** Packed ambient occlusion (r), roughness (g), metalness (b). */
  arm: THREE.Texture;
}

const sets = new Map<string, TextureSet>();

function loadTex(path: string, srgb: boolean) {
  const t = textureLoader.load(assetUrl(path));
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

function baseSet(name: string): TextureSet {
  let s = sets.get(name);
  if (!s) {
    s = {
      map: loadTex(`${texDir}/${name}/diff.webp`, true),
      normalMap: loadTex(`${texDir}/${name}/nor.webp`, false),
      arm: loadTex(`${texDir}/${name}/arm.webp`, false),
    };
    sets.set(name, s);
  }
  return s;
}

/**
 * A PBR material whose textures tile once every `tileM` metres over a surface
 * of `widthM` by `depthM`. Each call gets its own repeat but shares the images.
 */
export function pbrMaterial(name: string, widthM: number, depthM: number, tileM = 2, extra: THREE.MeshStandardMaterialParameters = {}) {
  const src = baseSet(name);
  const fit = (t: THREE.Texture) => {
    const c = t.clone();
    c.repeat.set(widthM / tileM, depthM / tileM);
    c.needsUpdate = true;
    return c;
  };
  const arm = fit(src.arm);
  return new THREE.MeshStandardMaterial({
    map: fit(src.map),
    normalMap: fit(src.normalMap),
    aoMap: arm,
    roughnessMap: arm,
    metalnessMap: arm,
    roughness: 1,
    metalness: 1,
    ...extra,
  });
}

/**
 * Re-tiles box UVs so a texture repeats every `tileM` metres on every face,
 * whatever the size of the box.
 */
export function tileBoxUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number, tileM: number) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  const faces: Array<[number, number]> = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  faces.forEach(([fu, fv], f) => {
    for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * fu) / tileM, (uv.getY(k) * fv) / tileM);
    }
  });
  uv.needsUpdate = true;
}

export interface ModelFit {
  /** Footprint centre x, z and the height of the floor under it. */
  x: number;
  z: number;
  y?: number;
  /** Rotation about the vertical axis, radians. 0 faces south (+z). */
  ry?: number;
  /** Scale so the model is this tall (metres), or this wide along its longest side. */
  height?: number;
  width?: number;
  /** Load quietly after the first screen is ready. */
  lazy?: boolean;
}

const models = new Map<string, Promise<THREE.Object3D>>();

function loadModel(id: string, lazy: boolean) {
  let p = models.get(id);
  if (!p) {
    p = (lazy ? lazyGltfLoader : gltfLoader).loadAsync(assetUrl(`models/${id.includes('/') ? id : `${id}.glb`}`)).then((gltf) => {
      gltf.scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        m.castShadow = true;
        m.receiveShadow = true;
        const mat = m.material as THREE.MeshStandardMaterial;
        // Cut-out leaves sort and cast shadows better than blended ones.
        if (mat.transparent) {
          mat.transparent = false;
          mat.alphaTest = 0.5;
          mat.depthWrite = true;
          mat.side = THREE.DoubleSide;
        }
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap'] as const) if (mat[key]) mat[key]!.anisotropy = 8;
      });
      return gltf.scene;
    });
    models.set(id, p);
  }
  return p;
}

/** Loads a model, scales it to the requested size, and stands it on the floor. */
export async function placeModel(parent: THREE.Object3D, id: string, fit: ModelFit) {
  const source = await loadModel(id, !!fit.lazy);
  const obj = source.clone(true);
  const holder = new THREE.Group();
  holder.add(obj);

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  let s = 1;
  if (fit.height) s = fit.height / size.y;
  else if (fit.width) s = fit.width / Math.max(size.x, size.z);
  obj.scale.setScalar(s);

  const scaled = new THREE.Box3().setFromObject(obj);
  const centre = scaled.getCenter(new THREE.Vector3());
  obj.position.set(-centre.x, -scaled.min.y, -centre.z);

  holder.position.set(fit.x, fit.y ?? 0, fit.z);
  holder.rotation.y = fit.ry ?? 0;
  parent.add(holder);
  return holder;
}

export function disposeAssets() {
  sets.clear();
  models.clear();
}
