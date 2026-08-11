import { test, expect } from './fixtures.js'

// The innings bar's dead space belongs to its primary action
// (`.pagenav--innings .btn::after`, src/styles/24-floating-nav-and-hud.css,
// with focus mode's own tighter set in src/styles/focus/stage.css — that is the
// one in force on this anchor, which opens focused). `.pagenav` is click-through
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
// tautological). `deadY` is the gap above the action row — under Refresh where
// Refresh is there (the "as of 7:42 PM" stamp lives in that gap, so its height
// moves with the poll), and the bar's own top padding where it is not;
// `belowY` is the bar's bottom padding under the buttons.
//
// REFRESH IS OPTIONAL HERE. A finished game drops it — nothing left to fetch
// (InningViewer's `selectIsFinal` gate) — and every fixture game in
// docs/test-games.md is in the past, so on THIS anchor there is none. The
// helper measures from the bar's own top edge in that case rather than
// dereferencing a button that isn't there, and `refreshX/refreshY` come back
// null so the spec that needs them can say so.
async function barSpots(page) {
  await page.waitForSelector('.pagenav--innings .btn')
  return page.evaluate(() => {
    const bar = document.querySelector('.pagenav--innings')
    const refresh = bar.querySelector('.refreshbtn--float')
    const btns = [...bar.querySelectorAll('.btn')].filter((b) => b !== refresh)
    const rBar = bar.getBoundingClientRect()
    const rRefresh = refresh?.getBoundingClientRect() ?? null
    const first = btns[0].getBoundingClientRect()
    const last = btns[btns.length - 1].getBoundingClientRect()
    return {
      firstX: first.left + first.width / 2,
      // Sampled near the right-hand choice's INNER edge, not its centre: on
      // the wide layout the scorebug dock (.gamehud-dock, z-index 21 — above
      // .pagenav by design) parks over the bar's bottom-right corner and takes
      // those clicks itself, button and dead space alike.
      lastX: last.left + last.width * 0.2,
      deadY: ((rRefresh ? rRefresh.bottom : rBar.top) + first.top) / 2,
      belowY: (first.bottom + rBar.bottom) / 2,
      refreshX: rRefresh ? (rRefresh.left + rRefresh.right) / 2 : null,
      refreshY: rRefresh ? (rRefresh.top + rRefresh.bottom) / 2 : null,
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
  // One at-bat, not the whole half: the SEALED pair is still on the bar. Both
  // choices, by count — `.revealsplit` alone no longer says this, since the bar
  // carries a second split once the half is done (see the next spec).
  await expect(page.locator('.revealsplit .btn--reveal')).toHaveCount(2)
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

  // Over the right-hand choice: the whole half, not one at-bat — so the kraft
  // seal leaves the bar entirely.
  //
  // WHAT THE SEAL GOING IS, AND WHY IT ISN'T `.revealsplit` GOING. This used to
  // read `.revealsplit` count 0, on the arrangement where revealing a whole half
  // put a single full-width `.btn--next` back on the bar. Focus mode's postHalf
  // state (ADR-0043) ended that: a just-finished half now offers its own
  // Summary/next-half pair, which is a `.revealsplit` too — so the count stayed
  // 1 and this spec failed while the hit area was working perfectly. Measured on
  // the anchor at all three projects: a click at (lastX, deadY) lands on the
  // "Rest of half" button itself (document.elementFromPoint), commits
  // `bbsbh:reveal:823035` = "0", and leaves the bar reading Summary / Bottom 1st
  // › — byte-for-byte the state that pressing the real button produces.
  //
  // `.btn--reveal` is the kraft-seal skin, and ONLY the sealed pair wears it
  // here. Gone means the half is open; the left-hand step above keeps both. That
  // is the difference this spec is actually about, so assert it directly rather
  // than through a container whose meaning moved.
  await page.mouse.click(at.lastX, at.deadY)

  await expect(page.locator('.revealsplit .btn--reveal')).toHaveCount(0)
  await expect(page.locator('.pbp__entry').first()).toBeVisible()
})

test('Refresh keeps its own taps', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)
  // Only while the game can still change. Refresh is gone on a finished one,
  // and the pointer behaviour this pins — Refresh riding ABOVE the reveal's
  // hit area rather than the area stopping short of it — has nothing to sit on
  // then. Skipped rather than deleted: the rule still governs a live game, and
  // this is the spec that says so. Point the anchor at a live gamePk and it
  // runs.
  test.skip(at.refreshX == null, 'the anchor game is final, so it carries no Refresh')

  await page.mouse.click(at.refreshX, at.refreshY)

  await expect(page.locator('.pbp__entry')).toHaveCount(0)
  await expect(page.locator('.revealsplit .btn--reveal')).toHaveCount(2)
})

test('the page above the bar keeps its own taps', async ({ page }) => {
  await page.goto(`${GAME}/top1`)
  const at = await barSpots(page)

  await page.mouse.click(at.centreX, at.aboveBarY)

  await expect(page.locator('.pbp__entry')).toHaveCount(0)
})
