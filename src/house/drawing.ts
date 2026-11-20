import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { rooms } from './layout';
import { INK, PAPER } from './materials';

// The "sheet" look. Every pixel that belongs to a room the camera has not
// reached yet is redrawn as ink on paper: flat paper tone shaded by the real
// light, black lines wherever depth or texture changes sharply. When the camera
// arrives, the real render sweeps outward from it and replaces the drawing.

const SHADER = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    tDepth: { value: null as THREE.Texture | null },
    uProjInv: { value: new THREE.Matrix4() },
    uViewInv: { value: new THREE.Matrix4() },
    uTexel: { value: new THREE.Vector2() },
    uNear: { value: 0.25 },
    uFar: { value: 1400 },
    uCam: { value: new THREE.Vector3() },
    uPaper: { value: PAPER.clone() },
    uInk: { value: INK.clone() },
    uRooms: { value: rooms.map((r) => new THREE.Vector4(r.x0, r.z0, r.x1, r.z1)) },
    uReveal: { value: rooms.map(() => 0) },
    uOutdoor: { value: 0 },
    uMaxDist: { value: 70 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform mat4 uProjInv;
    uniform mat4 uViewInv;
    uniform vec2 uTexel;
    uniform float uNear;
    uniform float uFar;
    uniform vec3 uCam;
    uniform vec3 uPaper;
    uniform vec3 uInk;
    uniform vec4 uRooms[${rooms.length}];
    uniform float uReveal[${rooms.length}];
    uniform float uOutdoor;
    uniform float uMaxDist;
    varying vec2 vUv;

    float linearDepth(float d) {
      float z = d * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
    }
    float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      float d = texture2D(tDepth, vUv).x;
      if (d > 0.99999) { gl_FragColor = base; return; }

      vec4 ndc = vec4(vUv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      vec4 vp = uProjInv * ndc;
      vp /= vp.w;
      vec3 wp = (uViewInv * vp).xyz;

      float rv = uOutdoor;
      for (int i = 0; i < ${rooms.length}; i++) {
        vec4 r = uRooms[i];
        if (wp.x >= r.x && wp.x <= r.z && wp.z >= r.y && wp.z <= r.w) rv = uReveal[i];
      }
      float m;
      if (rv >= 0.999) m = 1.0;
      else if (rv <= 0.001) m = 0.0;
      else {
        float R = rv * uMaxDist;
        m = 1.0 - smoothstep(R - 4.0, R, distance(wp.xz, uCam.xz));
      }
      if (m >= 0.999) { gl_FragColor = base; return; }

      float dc = linearDepth(d);
      float dl = linearDepth(texture2D(tDepth, vUv + vec2(-uTexel.x, 0.0)).x);
      float dr = linearDepth(texture2D(tDepth, vUv + vec2( uTexel.x, 0.0)).x);
      float du = linearDepth(texture2D(tDepth, vUv + vec2(0.0,  uTexel.y)).x);
      float dd = linearDepth(texture2D(tDepth, vUv + vec2(0.0, -uTexel.y)).x);
      float edgeDepth = smoothstep(0.02, 0.07, (abs(dl - dr) + abs(du - dd)) / dc);

      float l  = luma(base.rgb);
      float ll = luma(texture2D(tDiffuse, vUv + vec2(-uTexel.x, 0.0)).rgb);
      float lr = luma(texture2D(tDiffuse, vUv + vec2( uTexel.x, 0.0)).rgb);
      float lu = luma(texture2D(tDiffuse, vUv + vec2(0.0,  uTexel.y)).rgb);
      float ld = luma(texture2D(tDiffuse, vUv + vec2(0.0, -uTexel.y)).rgb);
      float edgeTone = smoothstep(0.10, 0.32, abs(ll - lr) + abs(lu - ld)) * 0.55;

      vec3 tone = uPaper * (0.80 + 0.30 * clamp(l, 0.0, 1.0));
      vec3 paper = mix(uInk, tone, smoothstep(0.0, 0.06, l));
      vec3 drawn = mix(paper, uInk, max(edgeDepth, edgeTone));
      gl_FragColor = vec4(mix(drawn, base.rgb, m), 1.0);
    }
  `,
};

export interface DrawingState {
  /** Sweep progress per room, 0 (drawing) to 1 (fully rendered). */
  reveal: number[];
  camera: THREE.PerspectiveCamera;
}

export class DrawingPass {
  readonly composer: EffectComposer;
  private pass: ShaderPass;
  private near: number;
  private far: number;
  readonly hasAO: boolean;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, samples: number, ao: boolean) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const target = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples,
      depthTexture: new THREE.DepthTexture(size.x, size.y),
    });
    this.composer = new EffectComposer(renderer, target);
    this.composer.addPass(new RenderPass(scene, camera));

    this.pass = new ShaderPass(SHADER as unknown as THREE.ShaderMaterialParameters & { uniforms: Record<string, THREE.IUniform> });
    const original = this.pass.render.bind(this.pass);
    // ShaderPass only hands over colour; the drawing also needs the depth.
    this.pass.render = (r, write, read, dt, mask) => {
      this.pass.uniforms.tDepth.value = read.depthTexture;
      original(r, write, read, dt, mask);
    };
    this.composer.addPass(this.pass);
    this.hasAO = ao;
    if (ao) {
      // Ambient occlusion: soft darkening in corners and under furniture.
      const gtao = new GTAOPass(scene, camera, size.x, size.y);
      gtao.output = GTAOPass.OUTPUT.Default;
      gtao.blendIntensity = 0.85;
      gtao.updateGtaoMaterial({ radius: 0.6, distanceExponent: 1.3, thickness: 1.6, scale: 1.1, samples: 12, distanceFallOff: 1 });
      // Glass, water and the sky dome would cast false occlusion, so skip them.
      let skipped: THREE.Object3D[] | null = null;
      const original = gtao.render.bind(gtao);
      gtao.render = (r, write, read, dt, mask) => {
        skipped ??= (() => { const list: THREE.Object3D[] = []; scene.traverse((o) => { if (o.userData.noAO) list.push(o); }); return list; })();
        const was = skipped.map((o) => o.visible);
        skipped.forEach((o) => { o.visible = false; });
        original(r, write, read, dt, mask);
        skipped.forEach((o, i) => { o.visible = was[i]; });
      };
      this.composer.addPass(gtao);
    }
    this.composer.addPass(new OutputPass());
    this.near = camera.near;
    this.far = camera.far;
  }

  setSize(width: number, height: number) {
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.pass.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
  }

  render(state: DrawingState) {
    const u = this.pass.uniforms;
    u.uProjInv.value.copy(state.camera.projectionMatrixInverse);
    u.uViewInv.value.copy(state.camera.matrixWorld);
    u.uCam.value.copy(state.camera.position);
    u.uNear.value = this.near;
    u.uFar.value = this.far;
    state.reveal.forEach((v, i) => { u.uReveal.value[i] = v; });
    u.uOutdoor.value = state.reveal[0] ?? 0;
    this.composer.render();
  }

  dispose() {
    this.composer.dispose();
  }
}
