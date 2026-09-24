import { expect, routeRendered, withNoIntro } from '../fixtures.js'
import { FROZEN_NOW, HIDDEN, MASKS } from './routes.js'
import { WIDTHS } from './setup.js'

// How the suite opens a page, feeds it data, waits for it and shoots it. The
// record pass (record.visual.js) and both shooting passes (pages.visual.js) all
// open a page with `visit`, so every pass does the same steps in the same order.

// The traffic the recording holds: every http(s) request that does not go to a
// dev server. statsapi.mlb.com, the image CDNs and the weather are in; the dev
// server's own code, /data/*.json and /api/* reads are out, because each server
// serves its own tree's files, and a change there is a change the suite shows.
export const EXTERNAL = /^https?:\/\/(?!(?:localhost|127\.0\.0\.1)[:/])/

// Vercel's analytics script: not part of any page's look, and it posts events.
// Aborted on every pass. Registered after EXTERNAL, so it is matched first.
const BLOCKED = /^https:\/\/va\.vercel-scripts\.com\//

// A new context at this width. Every page, on both servers, starts clean: no
// localStorage, no cookies, nothing revealed.
export function newContext(browser, width) {
  return browser.newContext(WIDTHS[width])
}

// A request's key in the recording. A POST body is part of the key.
function keyOf(req) {
  const body = req.method() === 'GET' ? '' : ` ${req.postData() ?? ''}`
  return `${req.method()} ${req.url()}${body}`
}

// Headers a fulfilled response must not carry: the body we hand back is the
// decoded one, so its old length and encoding no longer describe it.
const DROP = new Set(['content-encoding', 'content-length', 'transfer-encoding'])

// RECORD. Each external request is fetched from the live network once, stored,
// and handed to the page. The first answer for a key is the one kept, and the
// same key asked again (both widths, a StrictMode double mount) gets it too.
// A fetch that fails is stored as a failure, so a replay fails it the same way.
export async function recordInto(page, store) {
  await page.route(EXTERNAL, async (route) => {
    const key = keyOf(route.request())
    if (!store.has(key)) {
      store.set(
        key,
        route
          .fetch({ timeout: 30_000 })
          .then(async (res) => ({
            status: res.status(),
            headers: Object.fromEntries(Object.entries(res.headers()).filter(([h]) => !DROP.has(h))),
            body: (await res.body()).toString('base64'),
          }))
          .catch((err) => ({ failed: err.message.split('\n')[0] })),
      )
    }
    const entry = await store.get(key)
    // The page may have cancelled the request by now (StrictMode's first mount
    // does), and then there is nothing to answer. The recording is kept anyway.
    if (entry.failed) await route.abort('failed').catch(() => {})
    else await route.fulfill(fulfilment(entry)).catch(() => {})
  })
  await page.route(BLOCKED, (route) => route.abort())
}

// REPLAY. Each external request is answered from the recording, and never sent
// live. A request the recording does not hold is aborted and listed in
// `missing`, unless the route names it as off the shot (routes.js, `offShot`).
export async function replayFrom(page, recording, route, missing) {
  await page.route(EXTERNAL, async (r) => {
    const req = r.request()
    const entry = recording[keyOf(req)]
    if (!entry || entry.failed) {
      if (!entry && !route.offShot?.test(req.url())) missing.push(req.url())
      return r.abort('failed').catch(() => {})
    }
    return r.fulfill(fulfilment(entry)).catch(() => {})
  })
  await page.route(BLOCKED, (r) => r.abort())
}

function fulfilment(entry) {
  return { status: entry.status, headers: entry.headers, body: Buffer.from(entry.body, 'base64') }
}

// Open `route` on `origin` and bring it to the state it is shot in. Throws if
// the page never gets there.
export async function visit(page, origin, route) {
  await freeze(page)
  await page.goto(withNoIntro(`${origin}${route.path}`))
  await routeRendered(page)
  await settle(page, route.ready)
  if (route.prepare) {
    await route.prepare(page)
    await imagesDrawn(page)
  }
  // Every route, element shots too: an element taller than the window is
  // scrolled into view to be shot, and a sticky bar (the design lab's jump bar)
  // then lands on top of it, at a place that depends on the scroll.
  await growToPage(page)
}

// Take each of the route's shots. Returns [{ name, png }].
export async function shoot(page, route) {
  const mask = MASKS.map((sel) => page.locator(sel))
  const shots = []
  for (const shot of route.shots) {
    const target = shot.selector ? page.locator(shot.selector) : page
    shots.push({ name: `${route.name}--${shot.name}.png`, png: await stableShot(page, target, mask) })
  }
  return shots
}

// A shot taken again until two in a row are the same, as toHaveScreenshot does,
// so a shot never catches a page between two frames. Same options on both
// servers. A page that never holds still fails here, on the server it ran on.
async function stableShot(page, target, mask) {
  const style = `${HIDDEN.join(', ')} { display: none !important; }`
  const options = { animations: 'disabled', caret: 'hide', scale: 'css', mask, style, timeout: 20_000 }
  let last = await target.screenshot(options)
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(150)
    const next = await target.screenshot(options)
    if (next.equals(last)) return next
    last = next
  }
  throw new Error('the page did not hold still: 11 shots in a row were all different')
}

// A page is frozen before it loads. DATA comes from the recording (above).
// TIME: the clock is fixed at FROZEN_NOW, so "today" is the same on both
// servers. CHANCE: Math.random is a seeded generator, so a random pick is the
// same on both servers.
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
