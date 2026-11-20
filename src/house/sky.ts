import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { assetUrl, manager, coarse } from './assets';

// A day of real skies: Poly Haven's "Kiara" series photographs one sky from
// dawn to dusk. We blend between neighbours as the walk advances, and read the
// sun's position out of each image so the shadow-casting light matches it.

const ALL_KEYS = [
  { hour: 7.0, file: 'kiara_2_sunrise' },
  { hour: 9.5, file: 'kiara_3_morning' },
  { hour: 12.5, file: 'kiara_5_noon' },
  { hour: 15.5, file: 'kiara_6_afternoon' },
  { hour: 17.8, file: 'kiara_7_late-afternoon' },
  { hour: 19.4, file: 'kiara_8_sunset' },
];

// Phones get three skies instead of six.
const KEYS = coarse ? ALL_KEYS.filter((_, i) => i === 0 || i === 2 || i === 5) : ALL_KEYS;

interface Key {
  hour: number;
  texture: THREE.DataTexture;
  env: THREE.Texture;
  /** Where the sun sits inside the image (radians). */
  azimuth: number;
  elevation: number;
  horizon: THREE.Color;
  sunColor: THREE.Color;
}

export interface SkyState {
  sunDir: THREE.Vector3;
  sunColor: THREE.Color;
  horizon: THREE.Color;
}

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D tA;
  uniform sampler2D tB;
  uniform float mixAB;
  uniform float offA;
  uniform float offB;
  uniform float exposure;
  varying vec3 vDir;
  const float PI = 3.141592653589793;
  vec2 uvFor(vec3 d, float off) {
    float az = atan(d.z, d.x) + off;
    return vec2(az / (2.0 * PI) + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
  }
  void main() {
    vec3 d = normalize(vDir);
    vec3 a = texture2D(tA, uvFor(d, offA)).rgb;
    vec3 b = texture2D(tB, uvFor(d, offB)).rgb;
    gl_FragColor = vec4(mix(a, b, mixAB) * exposure, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

const wrapPi = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class DaySky {
  readonly dome: THREE.Mesh;
  /** The first two skies: enough to open the walk. */
  readonly ready: Promise<void>;
  /** Every sky, including the ones fetched in the background after `ready`. */
  readonly complete: Promise<void>;
  private keys: Key[] = [];
  private uniforms = {
    tA: { value: null as THREE.Texture | null },
    tB: { value: null as THREE.Texture | null },
    mixAB: { value: 0 },
    offA: { value: 0 },
    offB: { value: 0 },
    exposure: { value: 1 },
  };
  private currentEnv = -1;
  readonly state: SkyState = { sunDir: new THREE.Vector3(), sunColor: new THREE.Color(), horizon: new THREE.Color() };

  constructor(private renderer: THREE.WebGLRenderer, private scene: THREE.Scene) {
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: VERT, fragmentShader: FRAG, side: THREE.BackSide, depthWrite: false, depthTest: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), material);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    this.dome.visible = false;
    this.ready = this.load(KEYS.slice(0, 2), manager);
    // The later skies stay off the loading screen; its manager would hold `ready` back.
    // shortcut: a visitor who races to the evening before these arrive sees the morning sky until they land.
    this.complete = this.ready.then(() => this.load(KEYS.slice(2), new THREE.LoadingManager()));
  }

  private async load(keys: typeof KEYS, loadingManager: THREE.LoadingManager) {
    const loader = new HDRLoader(loadingManager);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const textures = await Promise.all(keys.map((k) => loader.loadAsync(assetUrl(`sky/${k.file}_1k.hdr`))));
    textures.forEach((texture, i) => {
      texture.mapping = THREE.EquirectangularReflectionMapping;
      texture.wrapS = THREE.RepeatWrapping;
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      texture.generateMipmaps = false;
      const analysis = analyse(texture);
      this.keys.push({ hour: keys[i].hour, texture, env: pmrem.fromEquirectangular(texture).texture, ...analysis });
    });
    pmrem.dispose();
    this.keys.sort((a, b) => a.hour - b.hour);
    this.currentEnv = -1;
  }

  /** Hour of day in, sky and sun out. */
  update(hour: number, sunAzimuth: number, intensityScale = 1) {
    const ks = this.keys;
    if (!ks.length) return this.state;
    let i = 0;
    while (i < ks.length - 2 && hour > ks[i + 1].hour) i++;
    const a = ks[i];
    const b = ks[i + 1];
    const t = THREE.MathUtils.clamp((hour - a.hour) / (b.hour - a.hour), 0, 1);

    this.uniforms.tA.value = a.texture;
    this.uniforms.tB.value = b.texture;
    this.uniforms.mixAB.value = t;
    // Turn each image so its sun sits where our light is.
    this.uniforms.offA.value = wrapPi(a.azimuth - sunAzimuth);
    this.uniforms.offB.value = wrapPi(b.azimuth - sunAzimuth);
    this.uniforms.exposure.value = intensityScale;

    const nearest = t < 0.5 ? i : i + 1;
    if (nearest !== this.currentEnv) {
      this.currentEnv = nearest;
      this.scene.environment = ks[nearest].env;
    }
    this.scene.environmentRotation.y = wrapPi(sunAzimuth - ks[nearest].azimuth);

    const el = THREE.MathUtils.lerp(a.elevation, b.elevation, t);
    this.state.sunDir.set(Math.cos(el) * Math.cos(sunAzimuth), Math.sin(el), Math.cos(el) * Math.sin(sunAzimuth));
    this.state.sunColor.lerpColors(a.sunColor, b.sunColor, t);
    this.state.horizon.lerpColors(a.horizon, b.horizon, t);
    return this.state;
  }

  dispose() {
    this.keys.forEach((k) => {
      k.texture.dispose();
      k.env.dispose();
    });
    this.keys = [];
    (this.dome.material as THREE.Material).dispose();
    this.dome.geometry.dispose();
  }
}

/** Finds the sun (brightest spot) and the horizon colour inside an equirectangular HDR. */
function analyse(tex: THREE.DataTexture) {
  const { width, height, data } = tex.image as { width: number; height: number; data: Uint16Array | Float32Array };
  const half = data instanceof Uint16Array;
  const read = (i: number) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i]);
  // Row 0 is the top of the picture, which the loader uploads as v = 1.
  const rowToV = (row: number) => 1 - (row + 0.5) / height;

  let best = -1;
  let bx = 0;
  let by = 0;
  for (let y = 0; y < height / 2; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const l = read(i) + read(i + 1) + read(i + 2);
      if (l > best) {
        best = l;
        bx = x;
        by = y;
      }
    }
  }
  const sunI = (by * width + bx) * 4;
  const sunColor = new THREE.Color(read(sunI), read(sunI + 1), read(sunI + 2));
  const m = Math.max(sunColor.r, sunColor.g, sunColor.b) || 1;
  sunColor.multiplyScalar(1 / m);
  // Soften towards white so a saturated pixel doesn't tint the light too hard.
  sunColor.lerp(new THREE.Color(1, 1, 1), 0.25);

  const v = rowToV(by);
  const elevation = Math.max(0.03, (v - 0.5) * Math.PI);
  const azimuth = ((bx + 0.5) / width - 0.5) * Math.PI * 2;

  // Average colour in a thin band just above the horizon.
  const horizon = new THREE.Color(0, 0, 0);
  let n = 0;
  const r0 = Math.floor(height * 0.5) - Math.floor(height * 0.05);
  const r1 = Math.floor(height * 0.5) - 1;
  for (let y = r0; y <= r1; y++) {
    for (let x = 0; x < width; x += 4) {
      const i = (y * width + x) * 4;
      horizon.r += read(i);
      horizon.g += read(i + 1);
      horizon.b += read(i + 2);
      n++;
    }
  }
  horizon.multiplyScalar(1 / Math.max(1, n));
  return { azimuth, elevation, horizon, sunColor };
}
