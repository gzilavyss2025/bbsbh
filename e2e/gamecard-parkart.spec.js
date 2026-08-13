import { test, expect } from './fixtures.js'

// The slate card's hover/scroll ballpark backdrop
// (src/styles/06a-gamecard-parkart.css, src/lib/ballpark/parkBackdrop.js,
// src/components/game/GameCard.jsx).
//
// The resolution — which park, which photo, which crop — is pinned in the unit
// suite (test/park-backdrop.test.js). What only a browser can pin is the part a
// future edit is most likely to break by accident: THE PHOTOS ARE NOT FETCHED
// UNTIL A CARD IS HOVERED OR ON SCREEN. A slate is fifteen cards and the full
// hover art is a 1000px photograph, so an innocent-looking refactor — moving a
// url() out of the armed custom property and into the base rule, say, or
// swapping the layer for an <img loading="lazy"> — would quietly turn a
// decoration nobody asked for into several megabytes on every first visit, and
// would still look and behave identically on screen. Only a request log
// catches that. The two triggers also need to keep reaching for the RIGHT
// size: a hover pointer must only ever fetch the full .jpg, and a touch
// device's on-screen state must only ever fetch the mobile .webp thumbnail —
// getting that backwards would be invisible on screen too.

const HOVER_PHOTO = /\/ballparks\/[a-z0-9]+\.jpg$/i
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

test('a hover-capable card fetches nothing until hovered, then the full photo', async ({ page }) => {
  const fetched = watchParkImages(page)
  await page.goto('/')
  const cards = page.locator('.gamecard')
  await expect(cards.first()).toBeVisible()
  // Settle: give every card, its logos, and the nightly static files time to
  // land, so "nothing yet" means the page is genuinely idle rather than early.
  await page.waitForLoadState('networkidle')

  const card = cards.first()
  const backdrop = card.locator('.gamecard__parkart')
  // An MLB slate: every park is one of the 30 with art on file. If this ever
  // runs on a day with no MLB games, there is nothing to assert and no bug.
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')

  // Only run this test's assertions on a project with a real hover pointer —
  // the touch/scroll counterpart below covers the other trigger.
  const hoverable = await page.evaluate(() => matchMedia('(hover: hover)').matches)
  test.skip(!hoverable, 'no hover pointer on this project')

  expect(fetched, 'the slate paints with no ballpark photos at all').toEqual([])
  await expect(backdrop).toHaveCSS('opacity', '0')
  await card.hover()

  await expect
    .poll(() => fetched.length, { message: 'hovering one card fetches its park' })
    .toBe(1)
  expect(fetched[0], 'a hover pointer fetches the full-size photo, not the mobile thumbnail').toMatch(HOVER_PHOTO)
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

test('a touch card arms its own mobile thumbnail once it is on screen, with no hover', async ({ page }) => {
  const fetched = watchParkImages(page)
  await page.goto('/')
  const cards = page.locator('.gamecard')
  await expect(cards.first()).toBeVisible()

  const hoverable = await page.evaluate(() => matchMedia('(hover: hover)').matches)
  test.skip(hoverable, 'this project has a real hover pointer')

  const card = cards.first()
  const backdrop = card.locator('.gamecard__parkart')
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')

  // The first card is on screen the moment the slate loads, so GameCard's
  // IntersectionObserver arms it with no tap and no scroll at all.
  await expect
    .poll(() => fetched.length, { message: 'the on-screen card arms its own thumbnail' })
    .toBeGreaterThan(0)
  for (const url of fetched) {
    expect(url, 'a touch device never fetches the full-size hover photo').toMatch(TOUCH_THUMB)
  }
  const filter = await backdrop.evaluate((el) => getComputedStyle(el, '::before').filter)
  expect(filter).toBe('grayscale(1)')
  const opacity = Number(await backdrop.evaluate((el) => getComputedStyle(el).opacity))
  expect(opacity).toBeGreaterThan(0)
  expect(opacity).toBeLessThan(0.4)
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
