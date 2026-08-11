import { test, expect } from './fixtures.js'

// The slate card's hover ballpark backdrop (src/styles/06a-gamecard-parkart.css,
// src/lib/ballpark/parkBackdrop.js).
//
// The resolution — which park, which photo, which crop — is pinned in the unit
// suite (test/park-backdrop.test.js). What only a browser can pin is the part a
// future edit is most likely to break by accident: THE PHOTOS ARE NOT FETCHED
// UNTIL YOU HOVER. A slate is fifteen cards and these are 1000px-wide
// photographs, so an innocent-looking refactor — moving the url() out of the
// armed custom property and into the base rule, say, or swapping the layer for
// an <img loading="lazy"> — would quietly turn a decoration nobody asked for
// into several megabytes on every first visit, and would still look and behave
// identically on screen. Only a request log catches that.

const BALLPARK_IMG = /\/ballparks\/[a-z0-9]+\.(jpg|jpeg|png|webp)$/i

// Every image request the page makes for a bundled ballpark photo. Recorded
// from before the first navigation so nothing is missed on the way in.
function watchParkImages(page) {
  const seen = []
  page.on('request', (r) => {
    if (BALLPARK_IMG.test(new URL(r.url()).pathname)) seen.push(r.url())
  })
  return seen
}

test('no ballpark photo is fetched until a card is hovered', async ({ page }) => {
  const fetched = watchParkImages(page)
  await page.goto('/')
  const cards = page.locator('.gamecard')
  await expect(cards.first()).toBeVisible()
  // Settle: give every card, its logos, and the nightly static files time to
  // land, so "nothing yet" means the page is genuinely idle rather than early.
  await page.waitForLoadState('networkidle')
  expect(fetched, 'the slate paints with no ballpark photos at all').toEqual([])

  const card = cards.first()
  const backdrop = card.locator('.gamecard__parkart')
  // An MLB slate: every park is one of the 30 with art on file. If this ever
  // runs on a day with no MLB games, there is nothing to assert and no bug.
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')

  await expect(backdrop).toHaveCSS('opacity', '0')
  await card.hover()

  // The phone/tablet projects run here too, and on a device with no hovering
  // pointer this feature does not exist: the media query never lifts the
  // opacity, and GameCard's matching canHover() check means the tap that
  // Playwright's hover() lands does not fetch the photograph either. That
  // second half is the whole point of asking the question twice — a
  // decoration only a desktop can see must weigh nothing on a phone.
  const hoverable = await page.evaluate(() => matchMedia('(hover: hover)').matches)
  if (!hoverable) {
    await page.waitForTimeout(500)
    expect(fetched, 'a touch device fetches no ballpark photos at all').toEqual([])
    await expect(backdrop).toHaveCSS('opacity', '0')
    return
  }

  await expect
    .poll(() => fetched.length, { message: 'hovering one card fetches its park' })
    .toBe(1)
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

test('a card carries its photo credit, since there is no room for a caption', async ({ page }) => {
  await page.goto('/')
  const card = page.locator('.gamecard').first()
  await expect(card).toBeVisible()
  const backdrop = card.locator('.gamecard__parkart')
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')
  // CC BY / CC BY-SA attribution, in the one place this surface has for it —
  // on the CARD, because the layer is under every hoverable thing on it and a
  // title down there would never be read. "{park} — {credit}".
  await expect(card).toHaveAttribute('title', /\S+ — \S/)
  // And the picture itself stays decorative: the card's accessible name is the
  // two clubs and the game, never the photographer.
  await expect(backdrop).toHaveAttribute('aria-hidden', 'true')
})
