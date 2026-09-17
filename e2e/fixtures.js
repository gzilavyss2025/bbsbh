import { test as base, expect } from '@playwright/test'

// Shared test fixture. Every `page.goto()` automatically carries `?nointro` —
// the query flag that suppresses the first-visit welcome modal (see
// GameSelect.jsx `welcomeSuppressed`). On a fresh/cleared localStorage that
// modal pops on the slate (`/`, `/{MMDDYYYY}`), covers the screen, and steals
// focus, so a test that lands there without the flag flakes on an overlay it
// never asked for. Appending it everywhere is harmless: query strings don't
// affect routing (route.js parses the pathname only), so game/team/umpire/etc.
// routes are unchanged.
//
// ALWAYS import `test`/`expect` from this file, never from '@playwright/test'
// directly, so no spec can forget the flag. `page.reload()` re-requests the
// same `?nointro` URL, so it's covered too.
//
// The wrapper also waits for the route to be DRAWN before handing the page
// back — see `routeRendered` below. That is here, and not in each spec, for
// the same reason the flag is: a spec that forgets it does not fail loudly,
// it fails mysteriously, somewhere else, on a machine that is not yours.
export const test = base.extend({
  page: async ({ page }, use) => {
    const origGoto = page.goto.bind(page)
    page.goto = async (url, opts) => {
      const res = await origGoto(withNoIntro(url), opts)
      await routeRendered(page)
      return res
    }
    await use(page)
  },
})

export { expect }

// Wait until the lazy route module has rendered, before timing anything else.
//
// Vite never pre-transforms a dynamic import (importAnalysis gates that on
// `!isDynamicImport`), and every route in App.jsx is `lazy(() => import(...))`,
// so on a dev server that has not served this route yet the module is compiled
// on the first navigation to it. That compile is charged to whatever the spec
// waits for next. Two wrong readings come out of it (issue #1095):
//
//   - a bare "Test timeout of 30000ms exceeded", which looks like a hang in the
//     code under test and is really the clock spent before the page existed;
//   - a `test.skip` whose reason names the DATA — "this player has no MLB
//     situational splits on file today" — a sentence about MLB that is not
//     true, printed because a locator was counted before the page was drawn.
//
// The route's own Suspense fallback carries `loader--route` (App.jsx) and
// nothing else does, so its absence is exactly "the route is drawn". Past this
// call a missing locator is missing from the DATA, which is the only thing a
// skip is allowed to claim. A route that never renders fails HERE, naming the
// fallback, rather than as a bare timeout further down.
//
// It is not a substitute for a spec's own waits: data arrives after the route.
export async function routeRendered(page) {
  await expect(page.locator('.loader--route')).toHaveCount(0, { timeout: 20_000 })
}

// The Game Log's season grid (`.logbook__cell`) sits inside a disclosure that
// is CLOSED when the page loads — the book above it is already the collection,
// so the same keepsakes as a list wait to be asked for
// (screens/logbook/StampCollection.jsx). Any spec reading a cell opens the card
// first. The closed state is asserted on the way in, so this can never quietly
// become a no-op if the default ever flips back.
export async function openStampCard(page) {
  const head = page.locator('.stampcard__head')
  await expect(head).toHaveAttribute('aria-expanded', 'false')
  await head.click()
  await expect(head).toHaveAttribute('aria-expanded', 'true')
}

// Append `?nointro` without clobbering an existing query string or hash, and
// without doubling up if the caller already opted out. Handles absolute URLs,
// root-relative paths, and bare paths alike.
export function withNoIntro(url) {
  if (typeof url !== 'string') return url
  if (/[?&]nointro\b/.test(url)) return url
  const hashAt = url.indexOf('#')
  const hash = hashAt === -1 ? '' : url.slice(hashAt)
  const path = hashAt === -1 ? url : url.slice(0, hashAt)
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}nointro${hash}`
}
