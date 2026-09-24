import { defineConfig } from '@playwright/test'
import { BASE, BRANCH, BRANCH_PORT } from './e2e/visual/setup.js'

// The screenshot suite (issue #1177). `npm run visual` shoots every page in
// e2e/visual/routes.js on two dev servers — BASE, a worktree on `main`, and
// BRANCH, your worktree — and lists each page that differs. docs/testing.md,
// "Screenshot suite", says how to run it.
//
// NOTHING IT WRITES IS COMMITTED. There are no stored baselines: the "before"
// image is shot from `main` on every run. Everything goes to visual-report/
// (git-ignored): the recording, the base shots, the results and the report.
//
// It has its own config and its own file suffix (`*.visual.js`), so `npm run
// e2e` never picks these files up and this suite never picks up the e2e specs.
// Not CI-gated: it needs two dev servers.
//
//   VISUAL_BASE  the base server's URL (default http://localhost:5173)
//   E2E_PORT     the branch server's port, as in playwright.config.js
//   VISUAL_REUSE =1 to replay the last recording instead of recording again

if (BASE === BRANCH) {
  throw new Error(
    `[visual] the base and the branch are the same server (${BASE}). ` +
      'Set E2E_PORT to your worktree\'s port and VISUAL_BASE to a server running main.',
  )
}

const DEV_SCRIPT =
  { 5173: 'dev', 5172: 'dev:2', 5171: 'dev:3', 5170: 'dev:4', 5169: 'dev:5' }[BRANCH_PORT] ?? 'dev'

export default defineConfig({
  testDir: './e2e/visual',
  // The base shots: the "expected" image of each compare, rewritten every run.
  snapshotPathTemplate: 'visual-report/base/{arg}-{projectName}{ext}',
  outputDir: './visual-report/results',
  globalSetup: './e2e/visual/global-setup.js',
  // Each test opens its page twice (base, then branch). A route's first load on
  // a cold dev server compiles its lazy chunk (~4s), and a long page is
  // scrolled through once before its shot.
  timeout: 240_000,
  retries: 0,
  // Two workers: more make the dev servers the bottleneck, and a slow server is
  // how a page gets shot before its data has drawn.
  workers: 2,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'visual-report/html', open: 'never' }],
    ['./e2e/visual/changed-reporter.js'],
  ],
  use: {
    browserName: 'chromium',
    trace: 'off',
    // Draw every pixel the same way on every run. Without these, Chromium
    // rasterised in tiles across threads, and the edge pixels of a rounded
    // corner (the scorebug, a standings card) came out up to 15 levels apart
    // between two shots of the same page. With them, 16 runs of those pages in
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
    // Pass 1: record each route's external traffic from the base server.
    { name: 'record', testMatch: 'record.visual.js' },
    // Passes 2 and 3, per width (e2e/visual/setup.js, WIDTHS): shoot the base,
    // shoot the branch, compare.
    { name: 'phone', testMatch: 'pages.visual.js', dependencies: ['record'] },
    { name: 'wide', testMatch: 'pages.visual.js', dependencies: ['record'] },
  ],
  // Starts the branch server if it is not up. The base server must already run:
  // it is another worktree's, and global-setup.js stops the run if it is down.
  webServer: {
    command: `npm run ${DEV_SCRIPT}`,
    url: BRANCH,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
