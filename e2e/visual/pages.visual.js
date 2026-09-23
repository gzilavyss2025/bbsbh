import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '../fixtures.js'
import { ROUTES, FROZEN_NOW, MASKS } from './routes.js'

// The screenshot suite (issue #1177). One test per route in routes.js, run at
// both widths (playwright.visual.config.js). How to run it and how to update the
// baselines: docs/testing.md, "Screenshot suite".
//
// A page is frozen three ways before it is shot:
//   1. DATA. Every request that leaves the dev server — statsapi, the image
//      CDNs, the weather — and the app's own /data/*.json and /api/* reads are
//      replayed from a HAR per route and width (har/). A request the HAR does
//      not hold is ABORTED, never sent live, so a missing recording shows as a
//      changed page instead of as a page that silently reads today's data.
//   2. TIME. The clock is fixed at FROZEN_NOW, so "today" never moves.
//   3. CHANCE. Math.random is replaced with a seeded generator, so a random
//      pick draws the same value every run.
//
// VISUAL_RECORD=1 records the HARs again, from the live network, instead of
// comparing. It takes no screenshots. Run `npm run visual:update` after it.

const HAR_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'har')
const RECORD = Boolean(process.env.VISUAL_RECORD)

// Every http(s) URL except the dev server's own code and Vercel's analytics
// script: the HAR holds data, never the app. The dev server's `/data/` and
// `/api/` reads are in because the nightly cron rewrites public/data/*.json, and
// a page shot against last night's numbers would change every morning.
const HAR_URL = /^https?:\/\/(?!localhost:\d+\/(?!(?:data|api)\/))(?!va\.vercel-scripts\.com\/)/

// Vercel's analytics script: not part of any page's look, and it posts events.
const BLOCKED = /^https:\/\/va\.vercel-scripts\.com\//

// A HAR stores whole URLs, and the dev server's port is part of them. Each
// worktree runs on its own port (E2E_PORT), so the HARs store the dev server's
// reads under this port-less origin instead: a recording is rewritten to it
// once it is saved, and a replay rewrites each request to it before the HAR
// looks the request up.
const HAR_ORIGIN = 'http://localhost'
const DEV_READS = /^http:\/\/localhost:\d+\/(?:data|api)\//
const recorded = []

// Also drops each request the page cancelled while recording. React's StrictMode
// mounts twice in dev, so the first fetch of a page is often cancelled, and the
// HAR keeps it: as status -1, or as a 200 whose body never arrived. The HAR
// serves the FIRST entry that matches a URL, so it would serve that one — an
// abort, or an empty body the page cannot parse — instead of the whole response
// recorded after it.
function complete(e) {
  const { status, content } = e.response
  if (status <= 0) return false
  if (status === 204 || (status >= 300 && status < 400)) return true
  return Boolean(content?._file) || content?.text !== undefined
}

test.afterAll(() => {
  for (const file of recorded) {
    const har = JSON.parse(readFileSync(file, 'utf8'))
    const key = (e) => `${e.request.method} ${e.request.url} ${e.request.postData?._file ?? e.request.postData?.text ?? ''}`
    const whole = new Set(har.log.entries.filter(complete).map(key))
    // A cancelled entry with no whole twin stays: it is what the page got.
    har.log.entries = har.log.entries.filter(
      (e) => e.response.status > 0 && (complete(e) || !whole.has(key(e))),
    )
    for (const e of har.log.entries) {
      e.request.url = e.request.url.replace(/^http:\/\/localhost:\d+\/(?=(?:data|api)\/)/, `${HAR_ORIGIN}/`)
    }
    writeFileSync(file, JSON.stringify(har))
  }
})

async function freeze(page) {
  await page.clock.setFixedTime(new Date(FROZEN_NOW))
  await page.addInitScript(() => {
    // mulberry32, seed 1177.
    let a = 1177
    Math.random = () => {
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
    // A lazy image off to the side of a carousel never loads, because no scroll
    // brings it into view. Load every image now: the shot is the same, and
    // "every image has loaded" becomes a condition the test can wait for.
    const eager = (root) => {
      for (const img of root.querySelectorAll?.('img[loading="lazy"]') ?? []) img.loading = 'eager'
    }
    new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === 'attributes' && r.target.loading === 'lazy') r.target.loading = 'eager'
        for (const n of r.addedNodes) {
          if (n.nodeName === 'IMG' && n.loading === 'lazy') n.loading = 'eager'
          else eager(n)
        }
      }
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['loading'] })
  })
}

// Scroll to the bottom and back, so every lazy image and every section that
// loads on sight has asked for its data before the shot.
async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = Math.max(200, window.innerHeight - 100)
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y)
      await new Promise((r) => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
}

async function settle(page, ready) {
  if (ready) await page.locator(ready).first().waitFor({ timeout: 30_000 })
  await page.waitForLoadState('networkidle')
  await scrollThrough(page)
  await imagesDrawn(page)
  // Loading placeholders go away once their data has drawn.
  await expect(page.locator('.skel__bar, .loader--route')).toHaveCount(0, { timeout: 30_000 })
}

async function imagesDrawn(page) {
  await page.waitForLoadState('networkidle')
  await page.waitForFunction(
    () => [...document.images].every((img) => img.complete) && document.fonts.status === 'loaded',
    null,
    { timeout: 30_000 },
  )
  // `complete` is not "painted": a logo is `decoding="async"`, so wait for each
  // image to finish decoding too, or the first shot can catch an empty tile.
  await page.evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))))
}

// A whole-page shot is taken with the WINDOW made as tall as the page, not
// with Playwright's `fullPage`. In Chromium, `fullPage` lays the page out
// again at its full height in the middle of the capture, and a page that
// listens for that re-renders: the slate's wire rail at 760px unmounted and
// fetched again, so no two shots matched. A tall window is laid out once, and
// the test waits for what that layout loads (the slate's park art, which loads
// on sight) before it shoots. Repeated because a taller window can make the
// page taller (a `100vh` section); stopped after a few rounds either way.
async function growToPage(page) {
  const { width } = page.viewportSize()
  for (let round = 0; round < 4; round++) {
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    if (height === page.viewportSize().height) break
    await page.setViewportSize({ width, height })
    await imagesDrawn(page)
  }
  await scrollersAtRest(page)
}

// A sideways rail (the lineup page's season series, a photo deck) scrolls
// itself to the current item once it is drawn. Wait until no scroller has moved
// for half a second, so a shot never catches a rail on its way there.
async function scrollersAtRest(page) {
  await page.evaluate(async () => {
    const sample = () =>
      [...document.querySelectorAll('*')]
        .filter((el) => el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight)
        .map((el) => `${el.scrollLeft},${el.scrollTop}`)
        .join(' ')
    let last = sample()
    for (let quiet = 0, tries = 0; quiet < 2 && tries < 40; tries++) {
      await new Promise((r) => setTimeout(r, 250))
      const now = sample()
      quiet = now === last ? quiet + 1 : 0
      last = now
    }
  })
}

for (const route of ROUTES) {
  test(route.name, async ({ page }, testInfo) => {
    const har = path.join(HAR_DIR, `${route.name}-${testInfo.project.name}.har`)
    await page.routeFromHAR(har, {
      url: HAR_URL,
      notFound: 'abort',
      update: RECORD,
      updateContent: 'attach',
      updateMode: 'minimal',
    })
    // Registered after the HAR, so they are matched first.
    if (RECORD) recorded.push(har)
    else {
      await page.route(DEV_READS, (r) => {
        const url = new URL(r.request().url())
        return r.fallback({ url: `${HAR_ORIGIN}${url.pathname}${url.search}` })
      })
    }
    await page.route(BLOCKED, (r) => r.abort())
    await freeze(page)

    // A request the HAR does not hold is aborted, and lands here.
    const missing = []
    // (The page cancelling its own fetch is ERR_ABORTED: StrictMode does that
    // on every first mount in dev. The HAR's abort is ERR_FAILED.)
    page.on('requestfailed', (req) => {
      if (BLOCKED.test(req.url()) || req.failure()?.errorText === 'net::ERR_ABORTED') return
      if (route.offShot?.test(req.url())) return
      missing.push(req.url())
    })

    try {
      await page.goto(route.path)
      await settle(page, route.ready)
      if (route.prepare) {
        await route.prepare(page)
        await imagesDrawn(page)
      }
      if (route.shots.some((shot) => !shot.selector)) await growToPage(page)
    } catch (err) {
      // A page that never drew is most often a page missing its data: say which.
      if (missing.length) err.message += `\n\nRequests the HAR does not hold:\n  ${missing.join('\n  ')}`
      throw err
    }
    if (RECORD) return
    // Checked before the shots, so a page drawn without some of its data fails
    // with the list of what was missing instead of with a picture of the gap.
    // Re-record (docs/testing.md) when this fails.
    expect(missing, 'requests the recorded HAR does not hold').toEqual([])

    const mask = MASKS.map((sel) => page.locator(sel))
    for (const shot of route.shots) {
      const file = `${route.name}--${shot.name}.png`
      if (shot.selector) {
        await expect(page.locator(shot.selector)).toHaveScreenshot(file, { mask })
      } else {
        await expect(page).toHaveScreenshot(file, { mask })
      }
    }
  })
}
