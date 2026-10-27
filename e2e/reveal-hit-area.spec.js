import { test, expect } from './fixtures.js'

// Gameday's bar: the dead space around the advance control belongs to it
// (`.gdnext__bar .gdnext__advance::after`, src/styles/gameday-next/page.css).
// A thumb that misses the button still steps, instead of landing on nothing.
// These specs pin that, and the things the area must NOT swallow: the step
// switch beside it, the Menu, and the page above the bar.
//
// The old innings bar carried a reveal PAIR ("Next at-bat" / "Rest of half")
// that split the dead space between them. Gameday has one forward action and
// no "Rest of half" (#2568), so the seam this file pins is now the one between
// the advance and the At-bat | Pitch switch.
//
// Anchor game per docs/test-games.md: 2026-07-07 MIL@STL g2 (gamePk 823035).
// Its top of the 1st is sealed on arrival. A step writes the at-bat cursor
// (`bbsbh:reveal-atbat:{gamePk}` = "{halfIdx}:{count}", ADR-0016); revealing
// the whole half would write the reveal mark (`bbsbh:reveal:{gamePk}`).
const GAME = '/07072026/milstl-2'
const CURSOR = 'bbsbh:reveal-atbat:823035'
const MARK = 'bbsbh:reveal:823035'
const PITCH_MODE = 'bbsbh:pitchmode:823035'

// Where the bar's dead space actually is, measured from the live layout rather
// than from the CSS offsets under test (which would make the assertions
// tautological). Refresh is in the Menu now, not on the bar.
async function barSpots(page) {
  await page.waitForSelector('.gdnext__bar .gdnext__advance')
  return page.evaluate(() => {
    const bar = document.querySelector('.gdnext__bar')
    const adv = bar.querySelector('.gdnext__advance').getBoundingClientRect()
    const sw = bar.querySelector('.gdnext__switch').getBoundingClientRect()
    const rBar = bar.getBoundingClientRect()
    return {
      advX: adv.left + adv.width / 2,
      advY: adv.top + adv.height / 2,
      deadY: (rBar.top + adv.top) / 2 + 1,
      belowY: (adv.bottom + rBar.bottom) / 2,
      seamX: (sw.right + adv.left) / 2,
      rightX: (adv.right + rBar.right) / 2,
      aboveBarY: rBar.top - 6,
      centreX: window.innerWidth / 2,
    }
  })
}

const stored = (page, key) => page.evaluate((k) => localStorage.getItem(k), key)

test('a click in the dead space above the button steps an at-bat', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)
  expect(await stored(page, CURSOR)).toBeNull()

  await page.mouse.click(at.advX, at.deadY)

  await expect.poll(() => stored(page, CURSOR)).toBe('0:1')
  // One at-bat, not the whole half: the reveal mark is untouched, and the bar
  // still offers the next step.
  expect(await stored(page, MARK)).toBeNull()
  await expect(page.locator('.gdnext__advance')).toHaveText(/Next play/)
})

test('the dead space below the button steps an at-bat too', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  await page.mouse.click(at.advX, at.belowY)

  await expect.poll(() => stored(page, CURSOR)).toBe('0:1')
})

test('the dead space reaches the seam with the step switch and the bar end, and stops at the switch', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  // The gap between the switch and the advance, and the bar's right end, are
  // the advance's: each steps one at-bat.
  await page.mouse.click(at.seamX, at.advY)
  await expect.poll(() => stored(page, CURSOR)).toBe('0:1')
  // A tap while the stage still plays that step skips the play instead of
  // stepping (#2573), so the stage is put at rest first: a reload restores
  // the cursor and never replays (ADR-0046).
  await page.reload()
  const rested = await barSpots(page)
  await page.mouse.click(rested.rightX, rested.advY)
  await expect.poll(() => stored(page, CURSOR)).toBe('0:2')
  expect(await stored(page, MARK)).toBeNull()

  // The switch keeps its own taps: Pitch sets the mode and steps nothing
  // (ADR-0123: the switch reveals nothing).
  await page.getByRole('button', { name: 'Pitch', exact: true }).click()
  await expect.poll(() => stored(page, PITCH_MODE)).not.toBeNull()
  expect(await stored(page, CURSOR)).toBe('0:2')
  await expect(page.locator('.gdnext__advance')).toHaveText(/Next pitch/)
})

test('the Menu keeps its own taps', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  await barSpots(page)

  // Refresh lives in the Menu now (on a live game; the anchor is final, so it
  // has none). The Menu itself must not be swallowed by the advance's area.
  await page.getByRole('button', { name: 'Menu', exact: true }).click()

  await expect(page.getByRole('dialog')).toHaveCount(1)
  expect(await stored(page, CURSOR)).toBeNull()
})

test('the page above the bar keeps its own taps', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  await page.mouse.click(at.centreX, at.aboveBarY)

  expect(await stored(page, CURSOR)).toBeNull()
})
