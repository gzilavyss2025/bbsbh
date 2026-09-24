import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { devices } from '@playwright/test'

// The run's settings, in one place, for the config and both spec files.

// The two servers. BASE is a dev server running `main` (from its own worktree);
// BRANCH is your worktree's dev server. Both serve their own tree's code and
// public/data, so a change in either is a change the suite shows.
export const BRANCH_PORT = Number(process.env.E2E_PORT) || 5173
export const BRANCH = `http://localhost:${BRANCH_PORT}`
export const BASE = (process.env.VISUAL_BASE || 'http://localhost:5173').replace(/\/$/, '')

// Everything the suite writes goes here, and .gitignore keeps it out of git.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const OUT = path.join(ROOT, 'visual-report')
export const RECORDING_DIR = path.join(OUT, 'recording')

// VISUAL_REUSE=1 replays the last run's recording instead of recording again.
// Use it to run the comparison again after a fix, with the same data.
export const REUSE = Boolean(process.env.VISUAL_REUSE)

// The two widths. The project name picks one (playwright.visual.config.js), and
// every page, on both servers, is opened in a new context with these settings.
// (A device's `defaultBrowserType` is not a context setting: drop it.)
const device = (name) => {
  const d = { ...devices[name] }
  delete d.defaultBrowserType
  return d
}
const PHONE = device('iPhone 13')
const DESKTOP = device('Desktop Chrome')
const SHARED = {
  timezoneId: 'America/Chicago',
  locale: 'en-US',
  colorScheme: 'light',
  reducedMotion: 'reduce',
  // A service worker's requests go around page.route, so they would go around
  // the recording too.
  serviceWorkers: 'block',
}
export const WIDTHS = {
  // The phone, the main target. deviceScaleFactor 1 keeps the images small; a
  // layout or colour change shows at 1x as well as at 3x.
  phone: { ...SHARED, ...PHONE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 },
  // Just past the 740px breakpoint, where the wide layout starts.
  wide: { ...SHARED, ...DESKTOP, viewport: { width: 760, height: 1024 }, deviceScaleFactor: 1 },
}
