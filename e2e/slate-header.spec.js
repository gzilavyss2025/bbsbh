import { test, expect } from './fixtures.js'

// Regression harness for the slate topbar's wrap behavior. The bug (seen on a
// real 402px-wide iPhone once the account button joined the row): the actions
// row's flex-wrap moved buttons one at a time, so a single icon — the account
// avatar there, the menu button on a 375px phone even with Clerk off — dropped
// to its own row as a floating orphan while the wordmark drifted vertically
// centered across the doubled-height header. The fix groups search/menu/account
// in the nowrap .topbar__iconcluster (they wrap below the level pills together
// or not at all) and pins the wordmark to the first row.
//
// Viewport-independent CSS (same trick as e2e/invariants/): the widths under
// test are set explicitly below, so only the mobile project needs to run it.

// 430 = iPhone Pro Max, 402 = the width the bug was photographed at (iPhone 16
// Pro class), 390/375 = the common iPhone bucket, 360/320 = small-Android /
// worst-case floor.
const WIDTHS = [430, 402, 390, 375, 360, 320]

// The account button only renders when Clerk is configured
// (VITE_CLERK_PUBLISHABLE_KEY — see lib/clerkConfig.js), which a local test run
// can't assume. The layout contract under test is pure CSS driven by the extra
// element's box, so stand in for AccountButton with the same wrapper/classes it
// renders (a 28px Clerk UserButton trigger inside .accountbtn — see
// AccountButton.jsx) against the real stylesheet. Falls back to appending to
// .topbar__slateactions so on a pre-fix tree (no cluster) the spec still
// reproduces the orphan instead of erroring out.
const INJECT_ACCOUNT_STANDIN = `
  (() => {
    const host =
      document.querySelector('.topbar__iconcluster') ||
      document.querySelector('.topbar__slateactions')
    if (!host || host.querySelector('.accountbtn')) return
    const el = document.createElement('div')
    el.className = 'accountbtn'
    const team = document.createElement('span')
    team.className = 'accountbtn__team'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.style.cssText =
      'width:28px;height:28px;border-radius:50%;padding:0;border:0'
    team.appendChild(btn)
    el.appendChild(team)
    host.appendChild(el)
  })()
`

async function headerBoxes(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { top: r.top, bottom: r.bottom, centerY: r.top + r.height / 2 }
    }
    return {
      home: box('.topbar--slate .topbar__home'),
      levelnav: box('.topbar--slate .levelnav'),
      search: box('.topbar--slate .sitesearch-btn'),
      menu: box('.topbar--slate .sitemenu-btn'),
      acct: box('.topbar--slate .accountbtn'),
    }
  })
}

// Two boxes sit on the same visual row when their vertical centers are within
// half a condensed button height — a wrapped row starts a full 30px+ lower, so
// the tolerance cleanly separates "same row" from "orphaned below".
const SAME_ROW_TOLERANCE = 12

test.describe('slate topbar wrap', () => {
  test.skip(
    ({ isMobile }) => !isMobile,
    'viewport-independent CSS; widths are set explicitly below',
  )

  test('icon buttons never orphan across rows', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.topbar--slate .sitemenu-btn')
    await page.evaluate(INJECT_ACCOUNT_STANDIN)

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 })
      const b = await headerBoxes(page)
      expect(b.search, `${width}px: search button`).toBeTruthy()
      expect(b.menu, `${width}px: menu button`).toBeTruthy()
      expect(b.acct, `${width}px: account stand-in`).toBeTruthy()

      // The three icon buttons ride one row — all beside the level pills, or
      // all wrapped below them together. Never a lone straggler.
      for (const [name, box] of [
        ['menu', b.menu],
        ['account', b.acct],
      ]) {
        expect
          .soft(
            Math.abs(box.centerY - b.search.centerY),
            `${width}px: ${name} button left the search button's row`,
          )
          .toBeLessThanOrEqual(SAME_ROW_TOLERANCE)
      }

      // The wordmark anchors the first row (level pills), not the vertical
      // center of a doubled-up header.
      expect
        .soft(
          Math.abs(b.home.centerY - b.levelnav.centerY),
          `${width}px: wordmark drifted off the level-pill row`,
        )
        .toBeLessThanOrEqual(SAME_ROW_TOLERANCE)

      // And the icons never start above the pills' row (no reverse-orphan
      // where the pills wrap instead).
      expect
        .soft(
          b.search.centerY,
          `${width}px: icons floated above the level pills`,
        )
        .toBeGreaterThanOrEqual(b.levelnav.top)
    }
  })
})
