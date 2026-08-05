import { test, expect } from './fixtures.js'

// Regression harness for the mobile search surface (ADR-0037). The bug: site
// search was a docked bottom sheet, and a docked sheet is positioned against
// the LAYOUT viewport, which an on-screen keyboard does not shrink — so the
// moment the field took focus, the field and every result sat underneath the
// keyboard, rendered and invisible.
//
// Playwright cannot raise a real keyboard, so the two things that can be
// asserted here are the two that actually make it work:
//   1. the field is anchored at the TOP of the surface, not the bottom, so
//      anything the keyboard covers is list tail rather than the input;
//   2. the overlay sizes itself to the VISIBLE viewport, so when that shrinks
//      (which is exactly what a keyboard does to it) the surface follows
//      instead of keeping its full-window height.
// Plus the field-level details that decide whether typing on a phone is
// pleasant at all: no auto-zoom, a real tap target to clear, a locked page
// behind, and focus handed back on the way out.

const SEARCH_BTN = '.topbar--slate .sitesearch-btn'

async function openSearch(page) {
  await page.goto('/')
  await page.click(SEARCH_BTN)
  await expect(page.locator('.searchoverlay')).toBeVisible()
}

test('the field sits at the top of the surface, above where a keyboard lands', async ({ page }) => {
  await openSearch(page)
  const viewport = page.viewportSize()
  const field = await page.locator('.searchfield').boundingBox()
  // Comfortably inside the top quarter — the failure this guards against put it
  // at the bottom edge of the window.
  expect(field.y + field.height).toBeLessThan(viewport.height / 4)
})

test('the overlay follows the visible viewport when it shrinks', async ({ page }) => {
  await openSearch(page)
  const full = await page.locator('.searchoverlay').boundingBox()
  // A ~336px on-screen keyboard's worth of viewport, taken away.
  await page.setViewportSize({ width: page.viewportSize().width, height: full.height - 336 })
  await expect
    .poll(async () => Math.round((await page.locator('.searchoverlay').boundingBox()).height))
    .toBeLessThan(Math.round(full.height))
  // …and the field is still up top rather than pushed off the shortened surface.
  const field = await page.locator('.searchfield').boundingBox()
  expect(field.y).toBeGreaterThanOrEqual(0)
  expect(field.y + field.height).toBeLessThan(full.height - 336)
})

test('the field opens focused and does not trip iOS auto-zoom', async ({ page }) => {
  await openSearch(page)
  await expect(page.locator('.searchfield__input')).toBeFocused()
  // Under 16px, mobile Safari zooms the page on focus. --fs-field is the floor.
  const size = await page
    .locator('.searchfield__input')
    .evaluate((el) => parseFloat(getComputedStyle(el).fontSize))
  expect(size).toBeGreaterThanOrEqual(16)
})

test('clearing the query leaves you still typing in the field', async ({ page }) => {
  await openSearch(page)
  await page.fill('.searchfield__input', 'brewers')
  const clear = page.locator('.searchfield__clear')
  // A full tap target, not the ~14px native search-cancel affordance. Rounded
  // because a 3× device pixel ratio reports the 44px box as 43.999999.
  const box = await clear.boundingBox()
  expect(Math.round(box.width)).toBeGreaterThanOrEqual(44)
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(44)
  await clear.click()
  await expect(page.locator('.searchfield__input')).toHaveValue('')
  await expect(page.locator('.searchfield__input')).toBeFocused()
})

test('a local club match lands without waiting on the people request', async ({ page }) => {
  // Clubs are filtered from an in-memory directory, so they must appear on the
  // live query rather than the debounced one. Typed, then asserted immediately.
  await openSearch(page)
  await page.fill('.searchfield__input', 'brew')
  await expect(page.locator('.searchoverlay__opt', { hasText: 'BREWERS' }).first()).toBeVisible({
    timeout: 1500,
  })
})

test('the page behind is scroll-locked while open and released on close', async ({ page }) => {
  await openSearch(page)
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .toBe('hidden')
  await page.keyboard.press('Escape')
  await expect(page.locator('.searchoverlay')).toHaveCount(0)
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(document.body).overflow))
    .not.toBe('hidden')
  // Focus goes back to the trigger, per the app's dialog contract.
  await expect(page.locator(SEARCH_BTN)).toBeFocused()
})
