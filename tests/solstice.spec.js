const { test, expect } = require('@playwright/test');

const ROOMS = ['Gate Court', 'Hall', 'Living Room', 'Kitchen & Dining', 'Sun Terrace', 'Bedroom'];

async function open(page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveTitle(/Solstice House/);
  await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
}

async function scrollTo(page, progress) {
  await page.evaluate((p) => window.scrollTo(0, (document.documentElement.scrollHeight - window.innerHeight) * p), progress);
  await page.waitForTimeout(1500);
}

test.describe('Solstice House', () => {
  test('opens on the plan with all six rooms labelled', async ({ page }) => {
    await open(page);
    await expect(page.locator('h1')).toHaveText('Follow the sun through a house.');
    await expect(page.locator('canvas.stage')).toBeVisible();
    await expect(page.locator('.label:not(.label--dim):not(.label--sun)')).toHaveCount(6);
    await expect(page.locator('.label--sun')).toHaveCount(7);
    await expect(page.locator('.app')).toHaveAttribute('data-room', '-1');
  });

  test('every room can be reached from the rail, in order', async ({ page }) => {
    await open(page);
    for (const name of ROOMS) {
      await page.locator('.rail').getByRole('button', { name, exact: true }).click();
      await expect(page.locator('.caption h2')).toHaveText(name, { timeout: 10000 });
    }
  });

  test('the sun moves from morning to evening', async ({ page }) => {
    await open(page);
    await scrollTo(page, 0.34);
    const morning = await page.locator('.clock span').textContent();
    await scrollTo(page, 0.95);
    const evening = await page.locator('.clock span').textContent();
    expect(Number(morning.slice(0, 2))).toBeLessThan(9);
    expect(Number(evening.slice(0, 2))).toBeGreaterThanOrEqual(18);
  });

  test('the rail jumps to a room and the finale appears at the end', async ({ page }) => {
    await open(page);
    await page.locator('.rail').getByRole('button', { name: 'Sun Terrace', exact: true }).click();
    await expect(page.locator('.caption h2')).toHaveText('Sun Terrace', { timeout: 8000 });
    await page.waitForTimeout(2500);
    await scrollTo(page, 1);
    await expect(page.locator('.finale')).toHaveClass(/is-on/, { timeout: 8000 });
    await page.getByRole('button', { name: 'Walk again' }).click();
    await expect(page.locator('.app')).toHaveAttribute('data-room', '-1', { timeout: 8000 });
  });

  test('the caption arrows and keyboard step between rooms', async ({ page }) => {
    await open(page);
    await page.locator('.rail').getByRole('button', { name: 'Hall', exact: true }).click();
    await expect(page.locator('.caption h2')).toHaveText('Hall', { timeout: 10000 });
    await page.getByRole('button', { name: 'Next room' }).click();
    await expect(page.locator('.caption h2')).toHaveText('Living Room', { timeout: 10000 });
    await page.waitForTimeout(1800);
    await page.keyboard.press('k');
    await expect(page.locator('.caption h2')).toHaveText('Hall', { timeout: 10000 });
  });

  test('on a phone, the plan opens and the caption arrows walk the house @mobile', async ({ page }) => {
    await open(page);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.rail')).toBeHidden();
    await scrollTo(page, 0.34);
    await expect(page.locator('.caption h2')).toHaveText('Gate Court', { timeout: 10000 });
    await page.getByRole('button', { name: 'Next room' }).tap();
    await expect(page.locator('.caption h2')).toHaveText('Hall', { timeout: 10000 });
    // The caption and sun bar must stay inside the screen.
    const vw = page.viewportSize().width;
    for (const sel of ['.caption', '.sunbar']) {
      const box = await page.locator(sel).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
    }
  });

  test('the finale lists every room with its sun, and each row walks back in', async ({ page }) => {
    await open(page);
    await scrollTo(page, 1);
    await expect(page.locator('.finale')).toHaveClass(/is-on/, { timeout: 8000 });
    const rows = page.locator('.index button');
    await expect(rows).toHaveCount(6);
    await expect(rows.nth(3)).toContainText(/\d+\.\d h sun/, { timeout: 15000 });
    await rows.nth(3).click();
    await expect(page.locator('.caption h2')).toHaveText('Kitchen & Dining', { timeout: 10000 });
  });

  test('opens at a room from a deep link', async ({ page }) => {
    await page.goto('/#kitchen', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.app')).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
    await expect(page.locator('.caption h2')).toHaveText('Kitchen & Dining', { timeout: 15000 });
    expect(page.url()).toContain('#kitchen');
  });

  test('room file reports size and direct sun', async ({ page }) => {
    await open(page);
    await page.locator('.rail').getByRole('button', { name: 'Living Room', exact: true }).click();
    await expect(page.locator('.caption h2')).toHaveText('Living Room', { timeout: 10000 });
    await page.getByRole('button', { name: /Open room file/ }).click();
    await expect(page.locator('.file')).toContainText('88 m²');
    await expect(page.locator('.file')).toContainText(/\d+\.\d hours a day/, { timeout: 15000 });
    await expect(page.locator('.file .strip svg rect:not(.strip__day)').first()).toBeAttached();
  });

  test('the sun slider moves the clock', async ({ page }) => {
    await open(page);
    await page.locator('.rail').getByRole('button', { name: 'Hall', exact: true }).click();
    await expect(page.locator('.caption h2')).toHaveText('Hall', { timeout: 10000 });
    await page.locator('#sun-hour').fill('17.5');
    await expect(page.locator('.clock span')).toHaveText(/^17:/, { timeout: 5000 });
  });

  test('draws something on the canvas, not a blank page', async ({ page }) => {
    await open(page);
    await scrollTo(page, 0.5);
    const shot = await page.locator('canvas.stage').screenshot();
    // A blank canvas compresses to a few hundred bytes; a lit room is far larger.
    expect(shot.length).toBeGreaterThan(20000);
  });

  test('shows the walkthrough clip when WebGL is unavailable', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        if (/webgl/i.test(type)) return null;
        return original.call(this, type, ...rest);
      };
    });
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.fallback')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.fallback video')).toBeVisible();
  });

  // Opt-in (npm run test:perf): frame timing is only meaningful on a quiet machine with a real GPU.
  test('keeps a usable frame rate through the walk @perf', async ({ page }) => {
    test.skip(!process.env.PERF, 'set PERF=1 to run');
    await open(page);
    await scrollTo(page, 0.3);
    const frames = await page.evaluate(() => new Promise((resolve) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const t0 = performance.now();
      const times = [];
      let last = t0;
      const step = (t) => {
        times.push(t - last);
        last = t;
        const k = (t - t0) / 8000;
        window.scrollTo(0, max * (0.3 + 0.6 * Math.min(1, k)));
        if (k < 1) requestAnimationFrame(step); else resolve(times.slice(5));
      };
      requestAnimationFrame(step);
    }));
    frames.sort((a, b) => a - b);
    const median = frames[Math.floor(frames.length / 2)];
    console.log(`median frame ${median.toFixed(1)} ms over ${frames.length} frames`);
    expect(median).toBeLessThan(20); // 50 fps
  });

  test('does not carry over any old project names', async ({ page }) => {
    await open(page);
    const html = (await page.content()).toLowerCase();
    for (const old of ['plan / 01', 'casa larga', 'casa-serra', 'afterimage', 'lintel']) expect(html).not.toContain(old);
  });
});
