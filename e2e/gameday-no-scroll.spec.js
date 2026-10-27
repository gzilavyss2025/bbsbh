import { test, expect } from './fixtures.js'

// Gameday never scrolls (#2566 "Governing rules" 1, #2568 slice 5): at each of
// the four sizes the design was drawn at, the page is exactly one window, no
// taller and no wider. It covers Gameday only; the box score, the lineup pages
// and the scorecard keep scrolling.
//
// Two games: 823035 (2026-07-07 MIL@STL g2, the anchor in docs/test-games.md)
// and 823169 (2026-09-21 MIN@SF, the umpires' reviews). Each opens on its top
// of the 1st, sealed, which is the state a reader lands in.
//
// The sizes are set here, so the spec runs on one project only.
const GAMES = [
  ['823035', '/07072026/milstl-2/top1'],
  ['823169', '/09212026/minsf/top1'],
]
const SIZES = [
  [390, 763],
  [760, 1024],
  [1180, 820],
  [1440, 900],
]

for (const [gamePk, path] of GAMES) {
  for (const [width, height] of SIZES) {
    test(`Gameday ${gamePk} does not scroll at ${width} x ${height}`, async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== 'mobile', 'the spec sets its own sizes')
      await page.setViewportSize({ width, height })
      await page.goto(path)
      await expect(page.locator('.gdnext')).toBeVisible()
      await expect(page.locator('.gdnext__advance')).toBeVisible()

      const m = await page.evaluate(() => ({
        scrollHeight: document.scrollingElement.scrollHeight,
        scrollWidth: document.scrollingElement.scrollWidth,
        innerHeight: window.innerHeight,
        innerWidth: window.innerWidth,
      }))
      expect(m.scrollHeight, 'no vertical scroll').toBeLessThanOrEqual(m.innerHeight)
      expect(m.scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(m.innerWidth)
    })
  }
}
