import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test, expect } from '../fixtures.js'
import { ROUTES } from './routes.js'
import { BASE, BRANCH, RECORDING_DIR } from './setup.js'
import { newContext, replayFrom, shoot, visit } from './shoot.js'

// Passes 2 and 3 of 3: SHOOT and COMPARE. One test per route and width (the
// project names the width, playwright.visual.config.js). Each test opens the
// route on the BASE server and shoots it, then opens it on the BRANCH server
// and shoots it again. Both visits replay the same recording (record.visual.js)
// and take the same steps (shoot.js), so the only thing that differs between
// the two shots is the code and public/data each server serves.
//
// Each pair of shots is compared to the pixel. A changed shot fails the test,
// and the report holds the base shot ("expected"), the branch shot ("actual")
// and a difference image. How to run it: docs/testing.md, "Screenshot suite".

for (const route of ROUTES) {
  test(route.name, async ({ browser }, testInfo) => {
    const width = testInfo.project.name
    const file = path.join(RECORDING_DIR, `${route.name}.json`)
    if (!existsSync(file)) throw new Error(`no recording for ${route.name}: the record pass did not run`)
    const recording = JSON.parse(readFileSync(file, 'utf8'))
    if (recording.base !== BASE) {
      throw new Error(`the recording is from ${recording.base}, not ${BASE}: run without VISUAL_REUSE`)
    }
    if (recording.errors.length) {
      throw new Error(`the base page failed while it was recorded:\n  ${recording.errors.join('\n  ')}`)
    }

    const base = await shootOn(browser, width, BASE, route, recording.requests, 'base')
    const branch = await shootOn(browser, width, BRANCH, route, recording.requests, 'branch')

    for (const [i, shot] of base.entries()) {
      // The base shot is the "expected" image. It is written to the snapshot
      // path (visual-report/base/) just before the compare, and replaced on
      // every run: there is no stored baseline.
      const expected = testInfo.snapshotPath(shot.name)
      mkdirSync(path.dirname(expected), { recursive: true })
      writeFileSync(expected, shot.png)
      // Zero tolerance, in both senses. `maxDiffPixels: 0`: one changed pixel
      // is a change. `threshold: 0`: any colour change in that pixel counts
      // (Playwright's default, 0.2, lets a small colour-token change through).
      // Two servers on the same tree draw the same pixels; a pixel that moves
      // between them is a bug to find, not a tolerance to raise.
      expect.soft(branch[i].png, `${shot.name} changed`).toMatchSnapshot(shot.name, {
        maxDiffPixels: 0,
        threshold: 0,
      })
    }
  })
}

// Open the route on one server in a new context, replaying the recording, and
// take its shots. A page that never gets to its shot state, or asks for a
// request the recording does not hold, fails the test, naming the server.
async function shootOn(browser, width, origin, route, requests, side) {
  const context = await newContext(browser, width)
  const page = await context.newPage()
  const missing = []
  await replayFrom(page, requests, route, missing)
  try {
    await visit(page, origin, route)
    // Checked before the shots, so a page drawn without some of its data fails
    // with the list of what was missing instead of with a picture of the gap.
    expect(missing, `${side}: requests the recording does not hold`).toEqual([])
    return await shoot(page, route)
  } catch (err) {
    err.message = `on the ${side} server (${origin}): ${err.message}`
    if (missing.length) err.message += `\n\nRequests the recording does not hold:\n  ${missing.join('\n  ')}`
    throw err
  } finally {
    await context.close()
  }
}
