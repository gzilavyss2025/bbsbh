import { test, expect } from './fixtures.js'

// The innings bar's dead space belongs to its primary action
// (`.pagenav--innings .btn::after` in index.css). `.pagenav` is click-through
// by design, so a thumb that missed the reveal button used to punch through
// the fade and open whichever player card sat underneath — you asked to
// reveal an at-bat and got a page you didn't want. These specs pin the two
// halves of that: the dead space around the button now answers for it, and
// the two things that must NOT be swallowed — Refresh, and the page above the
// bar — still answer for themselves.
//
// Anchor game per docs/test-games.md: 2026-07-07 MIL@STL g2 (gamePk 823035).
// Its top of the 1st is sealed on arrival, so the bar shows the reveal-split
// pair (ADR-0016).
const GAME = '/07072026/milstl-2'

// Where the bar's dead space actually is, measured from the live layout rather
// than from the CSS offsets under test (which would make the assertions
// tautological). `deadY` is the gap between the Refresh row and the action row
// — the "as of 7:42 PM" stamp lives in there, so its height moves with the
// poll; `belowY` is the bar's bottom padding under the buttons.
async function barSpots(page) {
  await page.waitForSelector('.pagenav--innings .btn')
  return page.evaluate(() => {
    const bar = document.querySelector('.pagenav--innings')
    const refresh = bar.querySelector('.refreshbtn--float')
    const btns = [...bar.querySelectorAll('.btn')]
    const rBar = bar.getBoundingClientRect()
    const rRefresh = refresh.getBoundingClientRect()
    const first = btns[0].getBoundingClientRect()
    const last = btns[btns.length - 1].getBoundingClientRect()
    return {
      firstX: first.left + first.width / 2,
      // Sampled near the right-hand choice's INNER edge, not its centre: on
      // the wide layout the scorebug dock (.gamehud-dock, z-index 21 — above
      // .pagenav by design) parks over the bar's bottom-right corner and takes
      // those clicks itself, button and dead space alike.
      lastX: last.left + last.width * 0.2,
      deadY: (rRefresh.bottom + first.top) / 2,
      belowY: (first.bottom + rBar.bottom) / 2,
      refreshX: (rRefresh.left + rRefresh.right) / 2,
      refreshY: (rRefresh.top + rRefresh.bottom) / 2,
      aboveBarY: rBar.top - 6,
      centreX: window.innerWidth / 2,
    }
  })
}

test('a click in the dead space above the buttons steps an at-bat', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)
  await expect(page.locator('.pbp__entry')).toHaveCount(0)

  await page.mouse.click(at.firstX, at.deadY)

  await expect(page.locator('.pbp__entry')).toHaveCount(1)
  // One at-bat, not the whole half: the split pair is still on the bar.
  await expect(page.locator('.revealsplit')).toHaveCount(1)
})

test('the dead space below the buttons steps an at-bat too', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  await page.mouse.click(at.firstX, at.belowY)

  await expect(page.locator('.pbp__entry')).toHaveCount(1)
})

test('the dead space splits between the two choices, seam included', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  // Over the right-hand choice: the whole half, not one at-bat — so the split
  // pair is replaced by the forward action.
  await page.mouse.click(at.lastX, at.deadY)

  await expect(page.locator('.revealsplit')).toHaveCount(0)
  await expect(page.locator('.pbp__entry').first()).toBeVisible()
})

test('Refresh keeps its own taps', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  await page.mouse.click(at.refreshX, at.refreshY)

  await expect(page.locator('.pbp__entry')).toHaveCount(0)
  await expect(page.locator('.revealsplit')).toHaveCount(1)
})

test('the page above the bar keeps its own taps', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  await page.mouse.click(at.centreX, at.aboveBarY)

  await expect(page.locator('.pbp__entry')).toHaveCount(0)
})
