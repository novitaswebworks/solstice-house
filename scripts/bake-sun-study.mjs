// Measures hours of direct sun per room on desktop (all six skies) and stores
// the result in src/house/sun-study.json, which the site ships instead of
// raycasting on every visit. Re-run after changing the plan, walls or skies.
//   npm run build && npx vite preview --port 4173 &
//   npm run bake:sun && npm run build
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const browser = await chromium.launch({ headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/?bake-sun', { waitUntil: 'domcontentloaded' });
const handle = await page.waitForFunction(() => window.__sunStudy, null, { timeout: 120000 });
const study = await handle.jsonValue();
await browser.close();

if (!Array.isArray(study) || study.length !== 6 || study.some((r) => typeof r.hours !== 'number' || !Array.isArray(r.slots))) {
  throw new Error(`Unexpected sun study: ${JSON.stringify(study).slice(0, 200)}`);
}
writeFileSync('src/house/sun-study.json', `${JSON.stringify(study)}\n`);
console.log('sun study:', study.map((r) => r.hours).join(', '), 'hours');
