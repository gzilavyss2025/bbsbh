import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { test } from '../fixtures.js'
import { ROUTES } from './routes.js'
import { BASE, RECORDING_DIR, REUSE } from './setup.js'
import { newContext, recordInto, visit } from './shoot.js'

// Pass 1 of 3: RECORD. For each route, open it on the BASE server at both
// widths, fetch its external traffic from the live network, and save it to
// visual-report/recording/<route>.json. Both shooting passes then replay that
// one file (pages.visual.js), so the base and the branch draw the same data.
//
// One recording per route serves both widths: the phone visit and the wide visit
// write into the same store, and a request both of them make is fetched once.
//
// A route whose page never gets to its shot state here does NOT fail this test.
// A failed test here would skip every route's comparison (the shooting projects
// depend on this one). The error goes into the recording instead, and that
// route's comparison fails with it.

for (const route of ROUTES) {
  test(route.name, async ({ browser }) => {
    const file = path.join(RECORDING_DIR, `${route.name}.json`)
    if (REUSE && existsSync(file)) return
    const store = new Map()
    const errors = []
    for (const width of ['phone', 'wide']) {
      const context = await newContext(browser, width)
      const page = await context.newPage()
      await recordInto(page, store)
      try {
        await visit(page, BASE, route)
      } catch (err) {
        errors.push(`${width}: ${err.message.split('\n')[0]}`)
      }
      await context.close()
    }
    const requests = {}
    for (const [key, entry] of store) requests[key] = await entry
    mkdirSync(RECORDING_DIR, { recursive: true })
    writeFileSync(file, JSON.stringify({ base: BASE, errors, requests }))
  })
}
