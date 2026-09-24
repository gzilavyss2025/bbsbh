import { rmSync } from 'node:fs'
import path from 'node:path'
import warm from '../global-setup.js'
import { BASE, BRANCH, OUT, RECORDING_DIR, REUSE } from './setup.js'

// Before any test: check that the base server answers, warm both servers
// (e2e/global-setup.js says why), and clear the last run's base shots and, unless
// VISUAL_REUSE is set, its recording. A stale file must never stand in for this
// run's.
export default async function visualSetup() {
  try {
    await fetch(BASE)
  } catch {
    throw new Error(
      `[visual] no base server at ${BASE}. Start a dev server on main in its own worktree, ` +
        'or set VISUAL_BASE to one that runs (docs/testing.md, "Screenshot suite").',
    )
  }
  rmSync(path.join(OUT, 'base'), { recursive: true, force: true })
  if (!REUSE) rmSync(RECORDING_DIR, { recursive: true, force: true })
  for (const baseURL of [BASE, BRANCH]) await warm({ projects: [{ use: { baseURL } }] })
}
