const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    // BASE_URL=https://… runs the suite against a deployed site instead of a local build.
    baseURL: process.env.BASE_URL ?? 'http://127.0.0.1:4173',
    headless: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', grepInvert: /@mobile/, use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } } },
    // The rail is hidden on phones, so the mobile run only covers tests written for it.
    { name: 'mobile', grep: /@mobile/, use: { ...devices['Pixel 7'], launchOptions: { args: ['--use-angle=metal', '--ignore-gpu-blocklist'] } } },
    { name: 'webkit', grepInvert: /@mobile/, use: { ...devices['Desktop Safari'] } },
  ],
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
