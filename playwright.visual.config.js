import { defineConfig, devices } from '@playwright/test'

// The screenshot suite (issue #1177): `npm run visual` compares every page in
// e2e/visual/routes.js against a committed baseline image, and
// `npm run visual:update` writes new baselines. docs/testing.md says when to run
// each one. It has its own config, and its own file suffix (`*.visual.js`), so
// `npm run e2e` never picks these files up and this suite never picks up the e2e
// specs.
//
// NOT CI-gated, and the baselines are Windows images. Font rendering differs
// between this machine and a Linux runner, so a run on another OS shows every
// page as changed. That is why the snapshot path has no `{platform}` part: a run
// on the wrong OS fails loudly instead of quietly writing a second set.
//
// E2E_PORT works the same as in playwright.config.js: point the suite at your own
// worktree's dev server, never at another worktree's.
const PORT = Number(process.env.E2E_PORT) || 5173
const DEV_SCRIPT =
  { 5173: 'dev', 5172: 'dev:2', 5171: 'dev:3', 5170: 'dev:4', 5169: 'dev:5' }[PORT] ?? 'dev'

export default defineConfig({
  testDir: './e2e/visual',
  testMatch: '**/*.visual.js',
  snapshotPathTemplate: '{testDir}/baselines/{arg}-{projectName}{ext}',
  outputDir: './test-results/visual',
  globalSetup: './e2e/global-setup.js',
  // Only acts on a recording run (VISUAL_RECORD=1): deletes stale HAR bodies.
  globalTeardown: './e2e/visual/prune-har.js',
  // A route's first load on a cold dev server compiles its lazy chunk (~4s,
  // global-setup.js), and a long page is scrolled through once before its shot.
  timeout: 120_000,
  retries: 0,
  // Two workers: more make the dev server the bottleneck, and a slow server is
  // how a page gets shot before its data has drawn.
  workers: 2,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/visual', open: 'never' }]],
  expect: {
    toHaveScreenshot: {
      // Zero tolerance, in both senses. `maxDiffPixels: 0` means one changed
      // pixel fails the page, and `threshold: 0` means any colour change in that
      // pixel counts (Playwright's default, 0.2, lets a small colour-token change
      // through). The frozen data and the frozen clock are what make zero
      // possible: on one machine, the same page draws the same pixels. Do not
      // raise either value to hide a flake — find what moved (docs/testing.md).
      maxDiffPixels: 0,
      threshold: 0,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      timeout: 20_000,
    },
  },
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    timezoneId: 'America/Chicago',
    locale: 'en-US',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    // A service worker's requests go around page.route, so it would go around
    // the recorded HAR too (e2e/visual/har/).
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    // Draw every pixel the same way on every run. Without these, Chromium
    // rasterised in tiles across threads, and the edge pixels of a rounded
    // corner (the scorebug, a standings card) came out up to 15 levels apart
    // between two runs of the same page. With them, 16 runs of those pages in
    // a row matched to the pixel. They change how Chromium draws, not what the
    // page looks like.
    launchOptions: {
      args: [
        '--disable-gpu',
        '--disable-gpu-rasterization',
        '--disable-partial-raster',
        '--num-raster-threads=1',
        '--force-color-profile=srgb',
        '--disable-lcd-text',
      ],
    },
  },
  projects: [
    {
      // The phone, the main target. deviceScaleFactor 1 keeps the images small;
      // a layout or colour change shows at 1x as well as at 3x.
      name: 'phone',
      use: {
        ...devices['iPhone 13'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
    {
      // Just past the 740px breakpoint, where the wide layout starts.
      name: 'wide',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        viewport: { width: 760, height: 1024 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: `npm run ${DEV_SCRIPT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
