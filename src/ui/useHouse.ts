import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import Lenis from 'lenis';
import { onLoadProgress } from '../house/assets';
import { createHouseRuntime, STAGES, type FrameInfo, type HouseRuntime, type RoomSun } from '../house/runtime';

export interface HouseUi {
  roomIndex: number;
  finale: boolean;
  ready: boolean;
  error: string | null;
  /** Sun study per room, once measured. */
  sun: RoomSun[] | null;
  /** Every sky has loaded; until then late hours show the nearest earlier sky. */
  skies: boolean;
}

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduce(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduce;
}

/**
 * Starts the 3D house, feeds it the scroll position, and writes per-frame
 * values straight to the DOM (CSS variables, label positions) so React only
 * re-renders when the current room changes.
 */
export function useHouse(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  rootRef: RefObject<HTMLElement | null>,
  labelRefs: RefObject<Array<HTMLElement | null>>,
  clockRef: RefObject<HTMLElement | null>,
  sliderRef: RefObject<HTMLInputElement | null>,
) {
  const reduceMotion = usePrefersReducedMotion();
  const runtimeRef = useRef<HouseRuntime | null>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const overridingRef = useRef(false);
  const [ui, setUi] = useState<HouseUi>({ roomIndex: -1, finale: false, ready: false, error: null, sun: null, skies: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return undefined;

    let last = { roomIndex: -2, finale: false };
    let lastClock = '';
    const onFrame = (info: FrameInfo) => {
      root.style.setProperty('--plan', info.planOpacity.toFixed(3));
      root.style.setProperty('--progress', info.progress.toFixed(4));
      if (info.planOpacity > 0) root.style.setProperty('--metre', `${info.metre.toFixed(2)}px`);
      // Scroll-linked caption: --room-in ramps over the doorway, --room-t runs 0..1 across the room.
      const rp = runtimeRef.current?.roomProgress;
      if (rp && info.roomIndex >= 0) {
        const start = rp[info.roomIndex] - 0.012;
        const end = rp[info.roomIndex + 1] ?? 1;
        const clamp = (x: number) => Math.min(1, Math.max(0, x));
        root.style.setProperty('--room-in', clamp((info.progress - start) / 0.012).toFixed(3));
        root.style.setProperty('--room-t', clamp((info.progress - start) / (end - start)).toFixed(3));
      }
      labelRefs.current?.forEach((el, i) => {
        const l = info.labels[i];
        if (el && l) el.style.transform = `translate(${l.x.toFixed(1)}px, ${l.y.toFixed(1)}px) translate(-50%, -50%)`;
      });
      const h = Math.floor(info.hour);
      const m = Math.floor((info.hour - h) * 60);
      const clock = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (sliderRef.current && !overridingRef.current) sliderRef.current.value = info.hour.toFixed(2);
      if (clock !== lastClock && clockRef.current) {
        clockRef.current.textContent = clock;
        lastClock = clock;
      }
      const finale = info.progress > 0.975;
      if (info.roomIndex !== last.roomIndex || finale !== last.finale) {
        last = { roomIndex: info.roomIndex, finale };
        root.dataset.room = String(info.roomIndex);
        setUi((s) => ({ ...s, roomIndex: info.roomIndex, finale }));
      }
    };

    let runtime: HouseRuntime;
    try {
      runtime = createHouseRuntime(canvas, reduceMotion, onFrame);
    } catch {
      setUi((s) => ({ ...s, error: 'This house is built live in WebGL, and your browser could not start it. Here is the walkthrough instead.' }));
      return undefined;
    }
    runtimeRef.current = runtime;
    let cancelled = false;
    const stopProgress = onLoadProgress((f) => root.style.setProperty('--load', f.toFixed(3)));
    void runtime.ready.then(() => {
      if (cancelled) return;
      root.dataset.ready = 'true';
      setUi((s) => ({ ...s, ready: true }));
      void runtime.skies.then(() => { if (!cancelled) setUi((s) => ({ ...s, skies: true })); });
      // Baked data resolves at once; a live study (no bake, or ?bake-sun) waits for every sky.
      void runtime.sunHours().then((sun) => { if (!cancelled) setUi((s) => ({ ...s, sun })); });
    });

    const lenis = reduceMotion ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
    lenisRef.current = lenis;

    let raf = 0;
    const tick = (time: number) => {
      lenis?.raf(time);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      runtime.setProgress(max > 0 ? window.scrollY / max : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // Watch the canvas itself, not the window: Safari can lay the canvas out after the first measure
    // (leaving a 300x150-shaped buffer stretched over the screen), and iOS resizes it with the address bar.
    // On tall screens the plan fits into the band the page leaves free. Each fixed overlay sitting in the top half
    // reserves space above, each in the bottom half space below: phones put the intro on top, portrait tablets at
    // the bottom with the title block on top. The intro is observed too, since it reflows when web fonts arrive.
    const intro = root.querySelector<HTMLElement>('.intro');
    const overlays = [intro, root.querySelector<HTMLElement>('.titleblock'), root.querySelector<HTMLElement>('.hint')];
    const sizer = new ResizeObserver(() => {
      const vh = window.innerHeight;
      let top = 0;
      let bottom = 0;
      for (const el of overlays) {
        if (!el || !el.offsetHeight) continue; // hidden (display: none) on this layout
        // offsetTop/Height ignore the intro's rise-animation transform; all three are position: fixed.
        const t = el.offsetTop;
        const b = t + el.offsetHeight;
        if (t + b < vh) top = Math.max(top, b + 16);
        else bottom = Math.max(bottom, vh - t + 8);
      }
      runtime.setPlanInset(top, bottom);
      runtime.resize();
    });
    sizer.observe(canvas);
    if (intro) sizer.observe(intro);
    const onLost = (event: Event) => {
      event.preventDefault();
      setUi((s) => ({ ...s, error: 'The 3D view ran out of memory on this device. Here is the walkthrough instead.' }));
    };
    canvas.addEventListener('webglcontextlost', onLost);

    return () => {
      cancelled = true;
      stopProgress();
      delete root.dataset.ready;
      cancelAnimationFrame(raf);
      sizer.disconnect();
      canvas.removeEventListener('webglcontextlost', onLost);
      lenis?.destroy();
      lenisRef.current = null;
      runtime.dispose();
      runtimeRef.current = null;
    };
  }, [canvasRef, rootRef, labelRefs, clockRef, sliderRef, reduceMotion]);

  const jumpTo = useCallback((progress: number) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const target = Math.max(0, Math.min(1, progress)) * max;
    if (lenisRef.current) lenisRef.current.scrollTo(target, { duration: 1.6 });
    else window.scrollTo({ top: target, behavior: 'auto' });
  }, []);

  const roomProgress = useCallback((index: number) => (index < 0 ? 0 : runtimeRef.current?.roomProgress[index] ?? STAGES.walkStart), []);

  const setHour = useCallback((hour: number | null) => {
    overridingRef.current = hour !== null;
    runtimeRef.current?.setHour(hour);
  }, []);

  return { ...ui, jumpTo, roomProgress, setHour };
}
