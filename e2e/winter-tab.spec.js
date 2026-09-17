import { test, expect } from './fixtures.js'

// THE CONDITIONAL WINTER TAB (issue #1055, ADR-0078).
//
// Every date below is a REAL past winter browsed to by URL, not a mock. The
// gate reads each league's own published schedule rather than the clock, so
// pointing the slate at October 25, 2025 exercises exactly the code an October
// visit will, against exactly the rows it will get. That is the same property
// ADR-0074 gave the offseason page, and it is why this whole feature is
// testable in September.
//
// The unit suite (test/winter-window.test.js) pins the span and default maths
// in isolation. What needs a browser is the RAIL: that a sixth tab appears and
// disappears, that it lands second, that the picker offers the right leagues,
// that a chip is a real address, and that a winter game opens like any other.
//
// The dates, and why each one is here:
//   2025-10-08  the AFL alone, before the other three open. One league is not
//               a choice, so the picker draws nothing.
//   2025-10-25  four leagues running. FALL holds the default although the
//               Mexican league has more games that day.
//   2025-12-15  the AFL is over. FALL is gone from the picker, and the Mexican
//               league is in season with no game on.
//   2026-02-03  the day after the last winter game anywhere.
//   2026-07-15  midsummer. The rail is the five levels it has always been —
//               including for a saved winter link, which does not resurrect it.

const AFL_ALONE = '/fall/10082025'
const FOUR_LEAGUES = '/fall/10252025'
const AFL_OVER = '/mex/12152025'
const WINTER_DONE = '/02032026'
const IN_SEASON = '/07152026'
const BOOKMARK_OUT_OF_SEASON = '/dom/07152026'

const rail = (page) => page.locator('.levelnav__btn')
const chips = (page) => page.locator('.leaguepicker__chip')

test('the tab appears second, and only inside a winter', async ({ page }) => {
  await page.goto(FOUR_LEAGUES)
  await expect(rail(page)).toHaveText(['MLB', 'WINTER', 'AAA', 'AA', 'A+', 'A'])
  // Second is the decision, not an accident of array order — the ladder splits
  // in the middle on purpose, because for these months this is the only tab
  // with games on it.
  await expect(rail(page).nth(1)).toHaveText('WINTER')
  await expect(rail(page).nth(1)).toHaveAttribute('aria-pressed', 'true')

  // The day after the winter's last game, and midsummer: back to five.
  //
  // BOOKMARK_OUT_OF_SEASON is the third one, and it is the rule rather than an
  // edge case: the tab is conditional on the leagues PLAYING, not on which URL
  // the reader typed. A saved '/dom' link read in July draws the five-level
  // rail with nothing lit, and comes back on its own the day the season opens.
  // That is the whole reason there is no special case here to maintain.
  for (const path of [WINTER_DONE, IN_SEASON, BOOKMARK_OUT_OF_SEASON]) {
    await page.goto(path)
    await expect(rail(page)).toHaveText(['MLB', 'AAA', 'AA', 'A+', 'A'])
    await expect(chips(page)).toHaveCount(0)
  }
})

test('the picker offers the leagues in season, and opens on FALL', async ({ page }) => {
  await page.goto(FOUR_LEAGUES)
  await expect(chips(page)).toHaveCount(4)
  await expect(chips(page).locator('.leaguepicker__chiplabel')).toHaveText([
    'FALL',
    'MEX',
    'VEN',
    'DOM',
  ])
  // The Mexican league has five games to the AFL's three on this date. Volume
  // must not take the default while the AFL is playing.
  await expect(chips(page).first()).toHaveClass(/is-active/)

  // Once the AFL is over its chip goes, because its season ended — not because
  // it is idle. A league in season with no game today stays, dimmed.
  await page.goto(AFL_OVER)
  await expect(chips(page).locator('.leaguepicker__chiplabel')).toHaveText([
    'MEX',
    'VEN',
    'DOM',
  ])

  // One league is not a choice: the tab already says where the reader is.
  await page.goto(AFL_ALONE)
  await expect(rail(page).nth(1)).toHaveText('WINTER')
  await expect(chips(page)).toHaveCount(0)
})

test('every chip is a real address', async ({ page }) => {
  await page.goto(FOUR_LEAGUES)
  // An anchor with an href, so middle-click and cmd-click reach the browser
  // and the reader can copy the link out (ADR-0056).
  await expect(chips(page).nth(1)).toHaveAttribute('href', '/mex/10252025')
  await chips(page).nth(1).click()
  await expect(page).toHaveURL(/\/mex\/10252025/)
  await expect(chips(page).nth(1)).toHaveClass(/is-active/)
  // And it survives a reload, which is the whole point of it being an address.
  await page.reload()
  await expect(chips(page).nth(1)).toHaveClass(/is-active/)
  await expect(rail(page).nth(1)).toHaveAttribute('aria-pressed', 'true')
})

test('the club strip is scoped to one league, and the wire is off', async ({ page }) => {
  await page.goto(FOUR_LEAGUES)
  // Six AFL clubs, not the 46 behind a bare sportId=17 call.
  await expect(page.locator('.teamfilterstrip .vsteam__team')).toHaveCount(6)
  await page.goto(AFL_OVER)
  await expect(page.locator('.teamfilterstrip .vsteam__team')).toHaveCount(10)

  // A winter club has no roster wire worth reading, and `scopeFor` would build
  // the wrong scope for one anyway. Neither presentation may appear.
  await expect(page.locator('.wirerail')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveCount(0)
})

test('a winter game opens like any other game', async ({ page }) => {
  await page.goto(FOUR_LEAGUES)
  await page.locator('.gamecard').first().click()
  await expect(page).toHaveURL(/\/10252025\/[a-z]+\//)
  // Both batting orders are posted, which is what makes it scoreable. The long
  // timeout is the lazy route's own: a click does not go through the fixture's
  // `routeRendered` wait, so on a dev server that has not served the game route
  // yet this is charged the module's first compile (issue #1095).
  await expect(page.locator('.lineup__row').first()).toBeVisible({ timeout: 20000 })
})

test('a shared winter game link resolves on a cold load', async ({ page }) => {
  // A GAME's address carries no league — the league lives on the slate's
  // address. So this link reaches resolveGame with nothing to say it is an AFL
  // game, and the five-level scan cannot find it. Without the winter pass this
  // is the screen that says "Couldn't find that game".
  await page.goto('/10252025/pejgdd/lineup1')
  await expect(page.locator('.lineup__row').first()).toBeVisible()
})

test('six cells do not overlap the wordmark on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 })
  await page.goto(FOUR_LEAGUES)
  await expect(rail(page)).toHaveCount(6)

  const wordmark = await page.locator('.topbar__home').boundingBox()
  const actions = await page.locator('.topbar__slateactions').boundingBox()
  // Below the wide breakpoint the strip takes its own row under the lockup.
  expect(actions.y).toBeGreaterThanOrEqual(wordmark.y + wordmark.height - 1)

  // And nothing runs off the side of the page.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  )
  expect(overflow).toBe(false)
})
