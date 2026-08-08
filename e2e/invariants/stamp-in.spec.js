import { test, expect } from '../fixtures.js'

// Stamp In (/team/{id}/stamp-in) — ADR-0042. The one address that lays a whole
// season of final scores in front of you, and the only thing making that safe
// is two properties neither of which a unit test can reach: one is a fact about
// localStorage after a real interaction, the other is a fact about the network
// before one.
//
//   1. RENDER-ONLY, in ADR-0026's exact sense. The page draws finished games
//      and must never MARK one as scored: no `bbsbh:reveal:{gamePk}` key, ever.
//      The blast radius is why this is pinned at runtime — the reveal mark is
//      persisted, cloud-synced (ADR-0022) and forward-only, so an accidental
//      write here would silently unseal these games on every other screen and
//      on every one of the reader's other devices, for games they never opened.
//   2. NOTHING RENDERS, AND NOTHING IS FETCHED, BEFORE CONSENT. The season is a
//      separate component mounted only after the answer is yes. "Not fetched"
//      is the half that only a network observer can see: a fetched-then-hidden
//      regression would leave the DOM assertions passing.
//
// Containment (ADR-0035) rides along: this page MINTS stamps, it never DRAWS
// them, which `scripts/check-stamp-surfaces.mjs`'s FORBIDDEN_ART_FILES holds
// statically. This is that guard's runtime half, the same way
// `logbook-stamp.spec.js` is the runtime half of the import allowlist — and it
// reuses that spec's `.gamestamp` selector for stamp art rather than inventing
// a second one.
//
// Signed out, against localStorage, with no backend configured — the posture a
// visitor with no Clerk key has. Viewport-independent, so mobile only.
const TEAM = 158
const PAGE = `/team/${TEAM}/stamp-in`
const CONSENT_KEY = 'bbsbh:stampIn'
const STAMPS_KEY = 'bbsbh:stamps'

// A full season is up to 162 rows, each fetching its own feed and win
// probability as it nears the viewport, so these run against the real statsapi
// with room to breathe.
test.describe.configure({ timeout: 90_000 })

const seedConsent = (page) =>
  page.addInitScript(
    ([k]) => window.localStorage.setItem(k, JSON.stringify({ consented: true, at: 1 })),
    [CONSENT_KEY],
  )

// Every persisted reveal mark on this device. THE observable of invariant 1.
const revealKeys = (page) =>
  page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('bbsbh:reveal:')))

const stampMap = async (page) =>
  JSON.parse((await page.evaluate((k) => window.localStorage.getItem(k), STAMPS_KEY)) ?? '{}')

// A row with its result actually drawn. `.flipback` alone is not that test —
// BoxScoreSkeleton wears `.flipback skel` while a row's signals are in flight,
// so the loaded faces are the ones WITHOUT `.skel`.
const loadedFaces = (page) => page.locator('.stampin__facewrap .flipback:not(.skel)')

// Rows load lazily (IntersectionObserver, four in flight), so waiting on a
// count rather than a fixed delay is what keeps a slow feed from flaking this.
async function waitForLoadedFaces(page, atLeast) {
  await expect(async () => {
    expect(await loadedFaces(page).count()).toBeGreaterThanOrEqual(atLeast)
  }).toPass({ timeout: 45_000 })
}

test('the page mints stamps and NEVER writes a reveal mark', async ({ page }) => {
  await seedConsent(page)
  await page.goto(PAGE)

  await waitForLoadedFaces(page, 1)
  expect(await revealKeys(page)).toEqual([])

  // Press one. The page has to WORK — a spec that only proved it wrote nothing
  // would pass just as well against a page that does nothing at all.
  const mark = page.locator('.stampin__mark--off').first()
  await expect(mark).toBeVisible()
  await mark.click()
  await expect(page.locator('.stampin__mark--on')).toHaveCount(1)
  await expect(page.locator('.stampin__mark--on')).toHaveText(/Stamped/)

  const minted = await stampMap(page)
  expect(Object.keys(minted)).toHaveLength(1)
  const record = Object.values(minted)[0]
  expect(record.state).toBe('on')
  expect(record.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  // The record carries no score — same footing as `revealedThrough` (ADR-0035).
  expect(record).not.toHaveProperty('runs')

  // THE invariant, after a mint: the reveal ratchet is untouched.
  expect(await revealKeys(page)).toEqual([])

  // And still untouched once the reader scrolls on and more of the season
  // loads — the lazy queue is the other place a reveal write could hide.
  const before = await loadedFaces(page).count()
  await page.locator('.stampin__row').nth(11).scrollIntoViewIfNeeded()
  await waitForLoadedFaces(page, before + 1)
  expect(await revealKeys(page)).toEqual([])

  // A reload replays the page from storage; the mark must still be absent.
  await page.reload()
  await waitForLoadedFaces(page, 1)
  expect(await revealKeys(page)).toEqual([])
})

test('nothing is rendered — or fetched — before consent', async ({ page }) => {
  const statsapi = []
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (url.hostname === 'statsapi.mlb.com') statsapi.push(url.pathname + url.search)
  })

  await page.goto(PAGE)

  const modal = page.locator('.sheet.consent')
  await expect(modal).toBeVisible()
  // The safe choice holds focus, as on every ConsentModal (ADR-0026).
  await expect(page.locator('.consent__btn--dismiss')).toBeFocused()

  // ABSENT, not hidden. A `display: none` season would satisfy a visibility
  // check and still be a page full of final scores one devtools tap away.
  await expect(page.locator('.flipback')).toHaveCount(0)
  await expect(page.locator('.stampin__mark')).toHaveCount(0)
  await expect(page.locator('.stampin__row')).toHaveCount(0)

  // The half only the network can answer: the schedule was never asked for.
  // Give the app time to have misbehaved before concluding it didn't.
  await page.waitForTimeout(2_000)
  expect(statsapi.filter((u) => u.includes('/schedule'))).toEqual([])
  // Nothing else reaches statsapi from this route either, so the stronger
  // statement is the true one and is worth holding.
  expect(statsapi).toEqual([])

  await page.locator('.consent__btn--confirm').click()

  // Consent recorded, season drawn — and the schedule request that was absent
  // above now exists, which is what proves the observer above was watching.
  await expect(modal).toHaveCount(0)
  await waitForLoadedFaces(page, 1)
  expect(statsapi.filter((u) => u.includes('/schedule')).length).toBeGreaterThan(0)

  const stored = JSON.parse(
    (await page.evaluate((k) => window.localStorage.getItem(k), CONSENT_KEY)) ?? 'null',
  )
  expect(stored.consented).toBe(true)

  // One-time, per device: the ask does not come back on the next visit.
  await page.reload()
  await expect(page.locator('.stampin__title')).toBeVisible()
  await expect(page.locator('.sheet.consent')).toHaveCount(0)
})

test('the season carries no stamp art', async ({ page }) => {
  await seedConsent(page)
  await page.goto(PAGE)
  await waitForLoadedFaces(page, 1)

  // ADR-0042 §4: this page MINTS stamps, it does not DRAW them. Neither
  // GameStamp.jsx's nor StampGameButton.jsx's import allowlist was widened for
  // it, so the art's reachable surfaces are what they were before it shipped.
  await expect(page.locator('.gamestamp')).toHaveCount(0)
  await expect(page.locator('.stampstrip')).toHaveCount(0)

  // Still none once a row is stamped — the state most likely to grow a
  // keepsake by accident.
  await page.locator('.stampin__mark--off').first().click()
  await expect(page.locator('.stampin__mark--on')).toHaveCount(1)
  await expect(page.locator('.gamestamp')).toHaveCount(0)
})

test('declining goes back to the schedule and records nothing', async ({ page }) => {
  await page.goto(PAGE)

  await expect(page.locator('.sheet.consent')).toBeVisible()
  await page.locator('.consent__btn--dismiss').click()

  // Back to the club's Games tab — the page's one and only door (ADR-0042).
  await expect(page).toHaveURL(new RegExp(`/team/${TEAM}/games`))
  await expect(page.locator('.flipback:not(.skel)')).toHaveCount(0)
  expect(await page.evaluate((k) => window.localStorage.getItem(k), CONSENT_KEY)).toBeNull()
  expect(await revealKeys(page)).toEqual([])
})
