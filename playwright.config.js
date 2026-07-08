import { defineConfig, devices } from '@playwright/test'

// Verification harness for manually exercising the app (there is no CI test
// suite — see CLAUDE.md). `npm run e2e` (or `npx playwright test <file>`)
// boots the dev server itself (reusing one already running on :5173) and
// tears it down after, so a verification pass never needs a separate
// "start the dev server / wait for it / remember to kill it" round trip.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
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
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
