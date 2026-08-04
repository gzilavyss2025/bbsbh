import { defineConfig, devices } from '@playwright/test'

// Verification harness for manually exercising the app (there is no CI test
// suite — see CLAUDE.md). `npm run e2e` (or `npx playwright test <file>`)
// boots the dev server itself (reusing one already running on this port) and
// tears it down after, so a verification pass never needs a separate
// "start the dev server / wait for it / remember to kill it" round trip.
//
// E2E_PORT exists because `reuseExistingServer` plus a hardcoded 5173 is a trap
// in this repo's multi-worktree workflow (CLAUDE.md: agents work in parallel
// worktrees on the reserved 5173/5172/5171/5170/5169 band). A second worktree
// running `npm run e2e` finds ANOTHER worktree's server already on 5173, reuses
// it, and silently verifies that branch's code instead of its own — the specs
// pass or fail for reasons that have nothing to do with the diff under test.
// Point it at your own slot:
//
//   E2E_PORT=5172 npx playwright test e2e/invariants/logbook-stamp.spec.js
//
// The dev script it launches follows suit, so a cold run starts a server on the
// same port rather than colliding on 5173 (vite's strictPort would refuse).
const PORT = Number(process.env.E2E_PORT) || 5173
const DEV_SCRIPT =
  { 5173: 'dev', 5172: 'dev:2', 5171: 'dev:3', 5170: 'dev:4', 5169: 'dev:5' }[PORT] ?? 'dev'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Forced onto Chromium everywhere (not each device preset's default
    // engine, e.g. iPhone 13 -> WebKit) since only Chromium's binary is
    // pre-cached here — avoids a browser download just to run a quick
    // verification pass.
    browserName: 'chromium',
  },
  // Three breakpoints: phone-first is the primary target, but the app also
  // has a wider layout (see the `min-width: 740px` rule in index.css) that
  // iPad/desktop sizes exercise. `npm run e2e` runs a spec against all
  // three; pass `--project=mobile` (etc.) to check just one.
  //
  // e2e/invariants/** tests the spoiler-reveal mechanism itself, which is
  // viewport-independent — ipad/desktop skip it so tripling those specs
  // doesn't just triple runtime for no coverage gain.
  projects: [
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
    {
      name: 'ipad',
      use: { ...devices['iPad (gen 7)'], browserName: 'chromium' },
      testIgnore: /invariants[\\/]/,
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], browserName: 'chromium' },
      testIgnore: /invariants[\\/]/,
    },
  ],
  webServer: {
    command: `npm run ${DEV_SCRIPT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
