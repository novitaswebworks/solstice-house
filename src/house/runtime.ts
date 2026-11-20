import * as THREE from 'three';
import {
  rooms, dimensions, sunMarks, sunAzimuth, walkPositions, walkTargets, EYE_HEIGHT, DAY_START, DAY_END, HOUSE_CENTER, HOUSE_SIZE,
} from './layout';
import { buildHouse } from './build';
import { PAPER, GROUND_PLAN } from './materials';
import { DrawingPass } from './drawing';
import { buildAnnotations } from './annotations';
import { DaySky } from './sky';
import { whenIdle } from './assets';

/** Scroll progress where each stage of the experience begins and ends. */
export const STAGES = {
  riseStart: 0.03,
  riseEnd: 0.15,
  descendStart: 0.17,
  walkStart: 0.31,
};

export interface FrameInfo {
  progress: number;
  /** Index into `rooms`, or -1 while the plan is still on screen. */
  roomIndex: number;
  hour: number;
  planOpacity: number;
  labels: Array<{ x: number; y: number }>;
}

export interface HouseRuntime {
  /** Resolves once the sky, textures and models have all loaded. */
  ready: Promise<void>;
  setProgress(p: number): void;
  resize(): void;
  dispose(): void;
  /** Scroll progress at which each room is first reached. */
  roomProgress: number[];
  /** Take over the time of day (hours), or pass null to follow the walk again. */
  setHour(hour: number | null): void;
  /** Hours of direct sunlight each room receives over the day (waits for every sky). */
  sunHours(): Promise<number[]>;
}

const smooth = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const inRoom = (x: number, z: number, r: (typeof rooms)[number]) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;

export function createHouseRuntime(
  canvas: HTMLCanvasElement,
  reduceMotion: boolean,
  onFrame: (info: FrameInfo) => void,
): HouseRuntime {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  const coarse = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  scene.background = PAPER.clone();
  scene.fog = new THREE.Fog(PAPER.clone(), 90, 420);
  scene.environmentIntensity = 1.1;

  const camera = new THREE.PerspectiveCamera(34, 1, 0.25, 1400);

  const house = buildHouse();
  scene.add(house.root);

  const annotations = buildAnnotations();
  scene.add(annotations);

  // The sheet: unvisited rooms are drawn in ink until the camera arrives.
  let drawing: DrawingPass | null = null;
  try {
    drawing = new DrawingPass(renderer, scene, camera, coarse ? 0 : 4, !coarse);
  } catch (error) {
    console.warn('Sheet effect unavailable', error);
  }
  let reveal: number[] = rooms.map(() => 0);

  const sky = new DaySky(renderer, scene);
  sky.dome.userData.noAO = true;
  scene.add(sky.dome);
  let skyLoaded = false;
  const skyReady = sky.ready.then(() => { skyLoaded = true; }).catch((error) => console.warn('Sky failed to load', error));

  // Image-based light from the sky does most of the work; these just lift the shade.
  // Warm lamps in the living room and bedroom that come on towards evening.
  const lamps = [new THREE.Vector3(4.6, 1.5, 8.2), new THREE.Vector3(3.9, 1.1, -2.6), new THREE.Vector3(19, 2.2, 8.4)].map((position) => {
    const light = new THREE.PointLight('#ffb36b', 0, 9, 2);
    light.position.copy(position);
    scene.add(light);
    return light;
  });

  const hemi = new THREE.HemisphereLight('#eaf1f7', '#e3d3b8', 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff3e0', 3);
  const shadowSize = coarse ? 2048 : 4096;
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 160;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.04;
  sun.shadow.radius = 3;
  sun.target.position.set(HOUSE_CENTER.x, 0, HOUSE_CENTER.z - 2);
  scene.add(sun, sun.target);

  const posCurve = new THREE.CatmullRomCurve3(walkPositions.map(([x, z]) => new THREE.Vector3(x, EYE_HEIGHT, z)), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(walkTargets.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal');

  // Work out when each room is first reached along the walk.
  const roomProgress = rooms.map((room, index) => {
    if (index === 0) return STAGES.walkStart + 0.004;
    for (let i = 0; i <= 600; i++) {
      const t = i / 600;
      const p = posCurve.getPoint(t);
      const idx = rooms.findIndex((r) => inRoom(p.x, p.z, r));
      if (idx === index) return STAGES.walkStart + t * (1 - STAGES.walkStart) + 0.004;
    }
    return 1;
  });

  const topPos = new THREE.Vector3();
  const topTarget = new THREE.Vector3(HOUSE_CENTER.x, 0, HOUSE_CENTER.z);
  const tmpPos = new THREE.Vector3();
  const tmpTarget = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const upPlan = new THREE.Vector3(0, 0, -1);
  const upWalk = new THREE.Vector3(0, 1, 0);
  const sunDir = new THREE.Vector3();
  const fogColor = new THREE.Color();
  const skyLow = new THREE.Color('#f0b99a');
  const skyHigh = new THREE.Color('#b9d6e6');
  const sunLow = new THREE.Color('#ffa65c');
  const sunHigh = new THREE.Color('#fff3e0');
  const tmpColor = new THREE.Color();
  const labelVec = new THREE.Vector3();
  // Label anchors never move, so build them once rather than every frame.
  const anchors: Array<[number, number]> = [
    ...rooms.map((room) => [(room.x0 + room.x1) / 2, (room.z0 + room.z1) / 2] as [number, number]),
    ...dimensions.map((d) => [d.label[0], d.label[1]] as [number, number]),
    ...sunMarks.map((m) => [m.x, m.z] as [number, number]),
  ];

  let width = 1;
  let height = 1;
  let progress = 0;
  let frame = 0;
  let disposed = false;
  let lastRoom = -2;
  let hourOverride: number | null = null;
  let cachedSunHours: number[] | null = null;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    drawing?.setSize(width, height);
    camera.aspect = width / height;
    const vHalf = THREE.MathUtils.degToRad(34 / 2);
    const needV = HOUSE_SIZE.d / 2 / Math.tan(vHalf);
    const needH = HOUSE_SIZE.w / 2 / (Math.tan(vHalf) * camera.aspect);
    // On wide screens, slide the plan to the right so the intro text has its own space.
    const wide = camera.aspect > 1.25;
    const topH = Math.max(needV, needH) * (wide ? 1.22 : 1.12);
    const visibleW = 2 * topH * Math.tan(vHalf) * camera.aspect;
    const shiftX = HOUSE_CENTER.x - (wide ? 0.16 * visibleW : 0);
    // On tall phones, slide it down instead, under the intro text.
    const tall = camera.aspect < 0.8;
    const shiftZ = HOUSE_CENTER.z - (tall ? 0.135 * 2 * topH * Math.tan(vHalf) : 0);
    topPos.set(shiftX, topH, shiftZ);
    topTarget.set(shiftX, 0, shiftZ);
    camera.updateProjectionMatrix();
  }

  function applyDay(hour: number, e: number) {
    // Where the sun is along its east-to-west arc.
    const phi = (Math.PI * (hour - 6)) / 14;
    const s = Math.max(0, Math.sin(phi));
    const azimuth = sunAzimuth(hour);

    if (skyLoaded) {
      const st = sky.update(hour, azimuth);
      sunDir.copy(st.sunDir);
      sun.color.copy(st.sunColor);
      fogColor.copy(st.horizon).multiplyScalar(0.9);
      sky.dome.visible = e > 0.02;
      sky.dome.position.copy(camera.position);
    } else {
      sunDir.set(Math.cos(phi), s * 0.78 + 0.05, 0.5 * s + 0.1).normalize();
      sun.color.lerpColors(sunLow, sunHigh, Math.pow(s, 0.6));
      fogColor.lerpColors(skyLow, skyHigh, Math.pow(s, 0.5));
    }
    sun.position.copy(sun.target.position).addScaledVector(sunDir, 70);
    sun.intensity = 1.2 + 3.4 * Math.pow(Math.max(0, sunDir.y), 0.6);

    const evening = smooth((hour - 16.8) / 2.4);
    lamps.forEach((l, i) => { l.intensity = evening * (i === 2 ? 14 : 22); });

    tmpColor.lerpColors(PAPER, fogColor, e);
    (scene.background as THREE.Color).copy(tmpColor);
    (scene.fog as THREE.Fog).color.copy(tmpColor);
    (house.ground.material as THREE.MeshStandardMaterial).color.copy(GROUND_PLAN);
    (house.lawn.material as THREE.MeshStandardMaterial).opacity = e;
  }

  function update() {
    const p = progress;
    const rise = smooth((p - STAGES.riseStart) / (STAGES.riseEnd - STAGES.riseStart));
    const descend = smooth((p - STAGES.descendStart) / (STAGES.walkStart - STAGES.descendStart));
    const walkT = clamp01((p - STAGES.walkStart) / (1 - STAGES.walkStart));

    house.rising.scale.y = 0.012 + 0.988 * rise;
    house.furniture.scale.y = 0.001 + 0.999 * smooth((p - 0.1) / 0.14);
    if (house.water?.normalMap) house.water.normalMap.offset.x = (performance.now() / 1000) * 0.012;

    const walkPos = posCurve.getPoint(walkT);
    const walkTarget = tgtCurve.getPoint(walkT);
    if (!reduceMotion && p > STAGES.walkStart) walkPos.y += Math.sin(walkT * 160) * 0.014;

    tmpPos.lerpVectors(topPos, walkPos, descend);
    tmpTarget.lerpVectors(topTarget, walkTarget, descend);
    tmpUp.lerpVectors(upPlan, upWalk, descend).normalize();
    camera.position.copy(tmpPos);
    camera.up.copy(tmpUp);
    camera.lookAt(tmpTarget);
    const fov = 34 + 30 * descend;
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    const autoHour = descend < 1 ? THREE.MathUtils.lerp(10, DAY_START, descend) : THREE.MathUtils.lerp(DAY_START, DAY_END, walkT);
    const hour = hourOverride ?? autoHour;
    applyDay(hour, descend);

    const planOpacity = 1 - smooth((p - 0.1) / 0.1);
    house.caps.visible = p < STAGES.walkStart + 0.02;
    // Ceilings lower into place just as the visitor reaches the front door.
    const lower = smooth((p - 0.25) / 0.05);
    house.roof.visible = lower > 0.001;
    house.roof.position.y = (1 - lower) * 9;
    annotations.visible = planOpacity > 0.01;
    (annotations.material as THREE.LineBasicMaterial).opacity = planOpacity;
    reveal = rooms.map((_, i) => smooth((p - (roomProgress[i] - 0.03)) / 0.05));

    camera.updateMatrixWorld();
    const labels = anchors.map(([ax, az]) => {
      labelVec.set(ax, 0.2, az).project(camera);
      return { x: (labelVec.x * 0.5 + 0.5) * width, y: (-labelVec.y * 0.5 + 0.5) * height };
    });

    let roomIndex = -1;
    if (p >= STAGES.walkStart) {
      // Probe slightly ahead along the route so the caption changes as you reach a doorway.
      const ahead = posCurve.getTangent(walkT).setY(0).normalize().multiplyScalar(0.9);
      roomIndex = rooms.findIndex((r) => inRoom(walkPos.x + ahead.x, walkPos.z + ahead.z, r));
      if (roomIndex < 0) roomIndex = lastRoom >= 0 ? lastRoom : 0;
    }
    lastRoom = roomIndex;

    onFrame({ progress: p, roomIndex, hour, planOpacity, labels });
  }


  function studySun() {
    if (cachedSunHours) return cachedSunHours;
    // Fire rays from a grid of points in each room towards the sun, every 15 minutes.
    const savedScale = house.rising.scale.y;
    const savedRoof = house.roof.position.y;
    const savedVisible = house.roof.visible;
    house.rising.scale.y = 1;
    house.roof.position.y = 0;
    house.roof.visible = true;
    house.root.updateMatrixWorld(true);
    const blockers: THREE.Object3D[] = [];
    house.rising.traverse((o) => { if ((o as THREE.Mesh).isMesh && !o.userData.noAO && !house.caps.children.includes(o)) blockers.push(o); });
    house.roof.traverse((o) => { if ((o as THREE.Mesh).isMesh) blockers.push(o); });
    const ray = new THREE.Raycaster();
    ray.far = 80;
    const dir = new THREE.Vector3();
    cachedSunHours = rooms.map((r) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        points.push(new THREE.Vector3(r.x0 + 0.5 + ((r.x1 - r.x0 - 1) * i) / 4, 0.9, r.z0 + 0.5 + ((r.z1 - r.z0 - 1) * j) / 4));
      }
      let total = 0;
      for (let h = 6.5; h < 19.75; h += 0.25) {
        const st = skyLoaded ? sky.update(h, sunAzimuth(h)) : null;
        if (!st || st.sunDir.y < 0.03) continue;
        dir.copy(st.sunDir);
        let lit = 0;
        for (const p of points) {
          ray.set(p, dir);
          if (ray.intersectObjects(blockers, false).length === 0) lit++;
        }
        total += (lit / points.length) * 0.25;
      }
      return Math.round(total * 10) / 10;
    });
    house.rising.scale.y = savedScale;
    house.roof.position.y = savedRoof;
    house.roof.visible = savedVisible;
    house.root.updateMatrixWorld(true);
    return cachedSunHours;
  }

  function loop() {
    if (disposed) return;
    update();
    // Once every room has been reached there is nothing left to draw.
    const allRevealed = reveal.every((v) => v >= 0.999);
    if (drawing && (!allRevealed || drawing.hasAO)) drawing.render({ reveal, camera });
    else renderer.render(scene, camera);
    frame = requestAnimationFrame(loop);
  }

  resize();
  frame = requestAnimationFrame(loop);

  const ready = Promise.all([skyReady, house.furnished.catch(() => undefined)]).then(() => whenIdle());

  return {
    ready,
    setProgress(p) {
      progress = clamp01(p);
    },
    resize,
    roomProgress,
    setHour(hour) {
      hourOverride = hour;
    },
    sunHours() {
      return sky.complete.then(studySun, studySun);
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      house.dispose();
      sky.dispose();
      drawing?.dispose();
      renderer.dispose();
    },
  };
}
