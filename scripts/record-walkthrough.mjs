// Captures the whole experience frame by frame and stitches it into the clip
// shown to visitors whose browsers cannot run WebGL.
//   npm run build && npx vite preview --port 4173 &
//   node scripts/record-walkthrough.mjs
import { chromium } from '@playwright/test';
import { mkdirSync, rmSync, copyFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FRAMES = Number(process.env.FRAMES ?? 180);
const FPS = 12;
const dir = process.env.FRAME_DIR ?? 'recordings/frames';
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });
mkdirSync('public/media', { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:4173/', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.app[data-ready="true"]', { timeout: 120000 });
await page.waitForTimeout(1500);

const t0 = Date.now();
for (let i = 0; i < FRAMES; i++) {
  const p = i / (FRAMES - 1);
  await page.evaluate((v) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * v), p);
  await page.waitForTimeout(450);
  await page.screenshot({ path: `${dir}/f_${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
  if (i % 20 === 0) console.log(`frame ${i}/${FRAMES}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();

execFileSync('ffmpeg', ['-y', '-framerate', String(FPS), '-i', `${dir}/f_%04d.jpg`, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '29', '-preset', 'slow', '-movflags', '+faststart', 'public/media/walkthrough.mp4'], { stdio: 'inherit' });
// 55% is well inside the living room; at 50% the scroll-linked caption is still wiping in.
copyFileSync(`${dir}/f_${String(Math.round(FRAMES * 0.55)).padStart(4, '0')}.jpg`, 'public/media/still.jpg');
console.log('done');
