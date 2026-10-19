import { test, expect } from './fixtures.js'

// Regression harness for the slate's brand bar (the D1 masthead,
// components/slatehead/SlateMasthead.jsx). The bug this file was first written
// for (seen on a real 402px-wide iPhone once the account button joined the
// row): the header's buttons wrapped one at a time, so a single icon dropped to
// its own row as a floating orphan. The D1 bar holds the lockup and the icon
// buttons on ONE row at every phone width — the Game Log button draws as its
// icon alone below 740px so the row fits at 320px.
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
// renders (a 28px Clerk UserButton trigger inside .account__btn — see
// AccountButton.jsx) against the real stylesheet.
const INJECT_ACCOUNT_STANDIN = `
  (() => {
    const host = document.querySelector('.slatemast__actions')
    if (!host || host.querySelector('.account__btn')) return
    const el = document.createElement('div')
    el.className = 'account__btn'
    const team = document.createElement('span')
    team.className = 'account__team'
    const btn = document.createElement('button')
    btn.type = 'button'
    btn.style.cssText =
      'width:28px;height:28px;border-radius:50%;padding:0;border:0'
    team.appendChild(btn)
    el.appendChild(team)
    host.appendChild(el)
  })()
`

async function barBoxes(page) {
  return page.evaluate(() => {
    const box = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { left: r.left, right: r.right, centerY: r.top + r.height / 2 }
    }
    return {
      brand: box('.slatemast__bar .slatemast__brand'),
      search: box('.slatemast__bar .sitebar__search'),
      log: box('.slatemast__bar .sitebar__logbook'),
      menu: box('.slatemast__bar .sitebar__menu'),
      acct: box('.slatemast__bar .account__btn'),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })
}

// Two boxes sit on the same visual row when their vertical centers are within
// half a button height — a wrapped row starts a full 44px lower.
const SAME_ROW_TOLERANCE = 12

test.describe('slate brand bar', () => {
  test.skip(
    ({ isMobile }) => !isMobile,
    'viewport-independent CSS; widths are set explicitly below',
  )

  test('the lockup and every icon button share one row, inside the page', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('.slatemast__bar .sitebar__menu')
    await page.evaluate(INJECT_ACCOUNT_STANDIN)

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 })
      const b = await barBoxes(page)
      expect(b.acct, `${width}px: account stand-in`).toBeTruthy()

      for (const [name, box] of [
        ['search', b.search],
        ['game log', b.log],
        ['menu', b.menu],
        ['account', b.acct],
      ]) {
        expect
          .soft(
            Math.abs(box.centerY - b.brand.centerY),
            `${width}px: ${name} button left the lockup's row`,
          )
          .toBeLessThanOrEqual(SAME_ROW_TOLERANCE)
        expect.soft(box.right, `${width}px: ${name} button ran off the page`).toBeLessThanOrEqual(width)
      }
      expect.soft(b.overflow, `${width}px: the page scrolls sideways`).toBe(false)
    }
  })
})
