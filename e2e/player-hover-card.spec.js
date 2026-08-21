import { test, expect } from './fixtures.js'
import { installMockApi } from './fixtures/mock-api.js'

// The hover card must never hold the road.
//
// The bug this pins, reported against the lineup page: the card opens BELOW
// the name it describes, which puts it over the next batter. The card took
// the pointer (its own onMouseEnter cancelled the pending hide), so travelling
// straight DOWN the batting order landed on the card instead of the next name,
// and the reader had to steer left or right to dismiss it first. Two fixes,
// one spec: the card takes no pointer (so a covered name still hovers), and a
// wheel closes it (so scroll intent clears it even where nothing scrolls).
//
// Desktop only, by the card's own gate — `HOVER_CARD_QUERY` in
// hooks/useMediaQuery.js asks for `hover: hover` and `pointer: fine`, which
// the mobile and ipad projects (both touch presets) do not match. The skip is
// the card's contract, not a viewport this spec happens to prefer.
const GAME = '/07072026/milstl-2'
const CARD = '#player-hover-card'

test.skip(({ isMobile }) => isMobile, 'the hover card is desktop-only by design')

async function openLineup(page) {
  await installMockApi(page)
  await page.goto(`${GAME}/lineup1`)
  await expect(page.locator('.lineup__name').first()).toBeVisible()
}

// Hovers a name and waits for the card to open on it.
//
// The scroll and the hover are deliberately separate steps. The batting order
// sits well below the fold, so the row has to be scrolled to either way — and
// a bare `.hover()`, which scrolls and moves the pointer in one go, does not
// reliably register as a mouseenter: the browser recomputes what is under the
// cursor after a programmatic scroll, and that recomputation races the move.
// Scrolling first, letting it settle, then moving onto a stationary row is
// what a reader actually does, and it is deterministic. It also fixes the
// viewport before anything below measures a coordinate against it, and gets
// the page's own scrolling out of the way — a scroll after the card opens
// closes it, which is the other half of what this file tests.
const SETTLE_MS = 300

async function hoverName(page, link) {
  await link.scrollIntoViewIfNeeded()
  await page.waitForTimeout(SETTLE_MS)
  await link.hover()
  await expect(page.locator(CARD)).toBeVisible()
}

test('the card takes no pointer, so a name it covers still hovers', async ({ page }) => {
  await openLineup(page)

  const names = page.locator('.lineup__name')
  const first = names.nth(0)
  const second = names.nth(1)
  // The second row is the one the card has to cover, and it is no use to this
  // test off-screen. It sits directly under the first, so scrolling to it puts
  // both in view — and hoverName settles there rather than scrolling again.
  await second.scrollIntoViewIfNeeded()

  await hoverName(page, first)
  const card = page.locator(CARD)
  const firstLabel = await card.getAttribute('aria-label')
  expect(firstLabel).toBeTruthy()

  // The premise. If the card ever stops covering the next batter this spec is
  // asserting nothing, so it fails here rather than passing vacuously.
  const cardBox = await card.boundingBox()
  const secondBox = await second.boundingBox()
  const overlap =
    Math.min(cardBox.y + cardBox.height, secondBox.y + secondBox.height) -
    Math.max(cardBox.y, secondBox.y)
  expect(overlap, 'the card must be over the next batter for this to test anything').toBeGreaterThan(0)

  expect(await card.evaluate((el) => getComputedStyle(el).pointerEvents)).toBe('none')

  // Straight down onto a name the card is drawn over — no sideways detour.
  await page.mouse.move(secondBox.x + secondBox.width / 2, secondBox.y + secondBox.height / 2)
  await expect(card).not.toHaveAttribute('aria-label', firstLabel)
  await expect(card).toBeVisible()
})

test('a wheel closes the card even when nothing scrolls', async ({ page }) => {
  await openLineup(page)

  await hoverName(page, page.locator('.lineup__name').first())

  // Dispatched rather than scrolled on purpose: a real wheel over a page with
  // room left to move fires `scroll` too, which the card already closed on
  // before this listener existed. A wheel that moves nothing fires only
  // `wheel` — the case the reader hits at the foot of a lineup, and the one
  // this listener is for.
  await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true })))
  await expect(page.locator(CARD)).toHaveCount(0)
})
