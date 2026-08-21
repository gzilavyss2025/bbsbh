import { test, expect } from './fixtures.js'
import { installMockApi, ANCHOR_DATE } from './fixtures/mock-api.js'

// The slate card's phone-only sheen and its full-strength ballpark wash
// (src/styles/06a-gamecard-parkart.css, src/components/game/GameCard.jsx).
//
// Both of these are invisible to the unit suite — there is no JS to test. The
// sheen is a scroll-driven CSS animation and the wash is a media-query branch,
// so a browser reading computed style is the only thing that can say whether
// either one is actually running.
//
// THE ONE THAT WILL BREAK AGAIN is the sheen's timeline. It is bound to a NAMED
// `view-timeline` declared on `.gamecard`, not to the anonymous `view()`,
// because `view()` measures the animated element inside its nearest ancestor
// SCROLL CONTAINER — and `overflow: hidden` on the clipping frame makes one. Go
// back to `view()` and the animation still parses, still applies, still shows a
// transform in DevTools, and never moves: progress pins at a single value for
// the life of the page. Nothing but scrolling and re-reading catches that,
// which is what the first test below does.
//
// Runs offline against the captured anchor slate (mock-api.js), so it needs no
// live statsapi.

const ANCHOR_SLATE = `/${ANCHOR_DATE.slice(5, 7)}${ANCHOR_DATE.slice(8, 10)}${ANCHOR_DATE.slice(0, 4)}`

// The translateY out of a computed `matrix(a, b, c, d, tx, ty)`.
function translateY(transform) {
  const parts = String(transform).match(/matrix\(([^)]+)\)/)
  if (!parts) return null
  return Number(parts[1].split(',')[5])
}

async function openAnchorSlate(page) {
  await installMockApi(page)
  await page.goto(ANCHOR_SLATE)
  await expect(page.locator('.gamecard').first()).toBeVisible()
  return page.locator('.gamecard')
}

test('the sheen moves with the scroll, not with a clock', async ({ page }) => {
  const cards = await openAnchorSlate(page)
  const touch = await page.evaluate(() => matchMedia('(hover: none)').matches)
  test.skip(!touch, 'the sheen is a no-hover-pointer surface — see the CSS partial')
  const driven = await page.evaluate(() => CSS.supports('animation-timeline: view()'))
  test.skip(!driven, 'this browser has no scroll-driven timelines, so the layer stays display:none')

  test.skip((await cards.count()) < 3, 'not enough cards on this slate to scroll one across the screen')
  const sheen = cards.nth(2).locator('.gamecard__sheen')
  await expect(sheen).toHaveCSS('display', 'block')

  const band = () => sheen.evaluate((el) => getComputedStyle(el, '::before').transform)
  await cards.nth(2).scrollIntoViewIfNeeded()
  await page.mouse.wheel(0, -260)
  await page.waitForTimeout(400)
  const before = translateY(await band())
  await page.mouse.wheel(0, 320)
  await page.waitForTimeout(400)
  const after = translateY(await band())

  expect(before, 'the band carries a translate the timeline can drive').not.toBeNull()
  // The trap: a timeline bound to the clipping frame reports the SAME progress
  // at every scroll position, so this is the assertion that fails — not the
  // `display`, not the `animation-name`, and not anything a static snapshot of
  // the page would show.
  expect(Math.abs(after - before), 'scrolling the card moves the band down it').toBeGreaterThan(10)
  expect(after, 'and it travels the way the card does — top of the card first').toBeGreaterThan(before)
})

test('a touch device gets the club wash without a hover to ask for it', async ({ page }) => {
  const cards = await openAnchorSlate(page)
  const touch = await page.evaluate(() => matchMedia('(hover: none)').matches)
  test.skip(!touch, 'a mouse pointer keeps the wash on hover — the other test covers that')

  const card = cards.first()
  const backdrop = card.locator('.gamecard__parkart')
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')
  // Nothing has been hovered, tapped or focused. The photo is on screen, so the
  // colour is on it — at full strength, the one value every club now gets
  // (src/lib/ballpark/parkWash.js).
  await expect
    .poll(() => backdrop.evaluate((el) => getComputedStyle(el, '::after').opacity))
    .toBe('1')
})

test('a mouse pointer keeps its hover reveal, and gets no sheen', async ({ page }) => {
  const cards = await openAnchorSlate(page)
  const hover = await page.evaluate(() => matchMedia('(hover: hover)').matches)
  test.skip(!hover, 'touch projects are covered above')

  const card = cards.first()
  const backdrop = card.locator('.gamecard__parkart')
  if ((await backdrop.count()) === 0) test.skip(true, 'no card on this slate has a park on file')
  const tint = () => backdrop.evaluate((el) => getComputedStyle(el, '::after').opacity)

  expect(await tint(), 'the wash rests hidden until the pointer asks').toBe('0')
  await card.hover()
  await expect.poll(tint, { message: 'hovering the card fills the wash' }).toBe('1')
  // A sheen answering to a scroll wheel is not what this was for.
  await expect(card.locator('.gamecard__sheen')).toHaveCSS('display', 'none')
})
