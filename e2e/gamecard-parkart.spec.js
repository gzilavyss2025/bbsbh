import { test, expect } from './fixtures.js'

// The slate card's on-screen ballpark backdrop
// (src/styles/06a-gamecard-parkart.css, src/lib/ballpark/parkBackdrop.js,
// src/components/game/GameCard.jsx).
//
// The resolution — which park, which photo, which crop — is pinned in the unit
// suite (test/park-backdrop.test.js). What only a browser can pin is the part a
// future edit is most likely to break by accident: THE PHOTOS ARE NOT FETCHED
// UNTIL A CARD IS ON SCREEN, and only ever the mobile-sized WebP thumbnail —
// never the full 1000px photo. A slate is fifteen cards, so an innocent-looking
// refactor — moving a url() out of the armed custom property and into the base
// rule, say, or swapping the layer for an <img loading="lazy">, or reaching for
// the full-size photo again — would quietly turn a decoration nobody asked for
// into several megabytes on every first visit, and would still look and behave
// identically on screen. Only a request log catches that. Every device shares
// the one trigger now (an IntersectionObserver) and the one smaller photo —
// there is no separate hover-only path left to pin.

const TOUCH_THUMB = /\/ballparks\/thumb\/[a-z0-9]+\.webp$/i
const BALLPARK_IMG = /\/ballparks\/([a-z0-9]+\.jpg|thumb\/[a-z0-9]+\.webp)$/i

// Every image request the page makes for a bundled ballpark photo. Recorded
// from before the first navigation so nothing is missed on the way in.
function watchParkImages(page) {
  const seen = []
  page.on('request', (r) => {
    if (BALLPARK_IMG.test(new URL(r.url()).pathname)) seen.push(r.url())
  })
  return seen
}

test('an on-screen card arms its own mobile thumbnail, with no hover needed', async ({ page }) => {
  const fetched = watchParkImages(page)
  await page.goto('/')
  const cards = page.locator('.gamecard')
  await expect(cards.first()).toBeVisible()

  const card = cards.first()
  const backdrop = card.locator('.gamecard__parkart')
  // An MLB slate: every park is one of the 30 with art on file. If this ever
  // runs on a day with no MLB games, there is nothing to assert and no bug.
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')

  // The first card is on screen the moment the slate loads, so GameCard's
  // IntersectionObserver arms it with no tap, no scroll, and — on a project
  // with a real hover pointer — no hover either.
  await expect
    .poll(() => fetched.length, { message: 'the on-screen card arms its own thumbnail' })
    .toBeGreaterThan(0)
  for (const url of fetched) {
    expect(url, 'the backdrop only ever fetches the small thumbnail, never the full-size photo').toMatch(
      TOUCH_THUMB,
    )
  }
  // Grayscale and faded well down, because the '@', both club names and the
  // whole meta row are printed over it — see the CSS partial's header. The
  // filter is on the ::before that carries the image, not on the frame that
  // clips it, so it has to be read from there.
  const filter = await backdrop.evaluate((el) => getComputedStyle(el, '::before').filter)
  expect(filter).toBe('grayscale(1)')
  const opacity = Number(await backdrop.evaluate((el) => getComputedStyle(el).opacity))
  expect(opacity).toBeGreaterThan(0)
  expect(opacity).toBeLessThan(0.4)
})

test('a card off screen fetches nothing until it scrolls into view', async ({ page }) => {
  const fetched = watchParkImages(page)
  await page.goto('/')
  const cards = page.locator('.gamecard')
  await expect(cards.first()).toBeVisible()
  await page.waitForLoadState('networkidle')

  const count = await cards.count()
  test.skip(count < 2, 'not enough cards on this slate to have one off screen')
  const last = cards.last()
  const backdrop = last.locator('.gamecard__parkart')
  if ((await backdrop.count()) === 0) test.skip(true, 'the last card on this slate has no park on file')

  const before = fetched.length
  await last.scrollIntoViewIfNeeded()
  await expect
    .poll(() => fetched.length, { message: 'scrolling the card into view arms its own thumbnail' })
    .toBeGreaterThan(before)
})

test('the backdrop stays decorative', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.gamecard').first()
  await expect(card).toBeVisible()
  const backdrop = card.locator('.gamecard__parkart')
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')
  // The card's accessible name stays the two clubs and the game, never the
  // photograph behind them.
  await expect(backdrop).toHaveAttribute('aria-hidden', 'true')
})
