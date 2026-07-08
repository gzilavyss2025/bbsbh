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
    // iPhone viewport/touch to match the real phone-first layout, but forced
    // onto Chromium (not the iPhone 13 preset's default WebKit) since only
    // Chromium's binary is pre-cached here — avoids a WebKit download just to
    // run a quick verification pass.
    ...devices['iPhone 13'],
    browserName: 'chromium',
  },
  projects: [{ name: 'chromium' }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
