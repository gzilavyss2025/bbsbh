import { test, expect } from './fixtures.js'
import { collectBoxes, tabCollisions } from './lib/tabClearance.js'

// A named stamped card's tab must not sit on the card above it. The tab hangs 14px over the
// card's top edge, and the card above throws a shadow below its own, so a card that overruns its
// cell, a gap that shrinks, or a parent rule that eats the tab's margin leaves the two touching.
// It came back three times before this check (the scouting cards, #2587) because nothing looked at
// the rendered page: the lint guard (scripts/layout/check-card-fill.mjs) catches one cause, this
// catches every cause.
//
// Run on all three projects (390, iPad and desktop widths): a grid that clears at one width
// collides at another. The geometry is e2e/lib/tabClearance.js, pinned by
// test/tab-clearance.test.js. A route with no named card is skipped, so a page that loses its
// cards says so rather than passing empty.

const ROUTES = ['/', '/team/158', '/player/677594', '/standings', '/postseason-leaders', '/awards']

for (const route of ROUTES) {
  test(`${route} clears every name tab from the card above`, async ({ page }) => {
    await page.goto(route)
    // Cards below the fold draw as the page loads; give the data a moment, then sweep the page.
    await page.waitForTimeout(3500)
    const height = await page.evaluate(() => document.documentElement.scrollHeight)
    for (let y = 0; y < height; y += 600) {
      await page.evaluate((top) => window.scrollTo(0, top), y)
      await page.waitForTimeout(120)
    }
    await page.evaluate(() => window.scrollTo(0, 0))

    const boxes = await page.evaluate(collectBoxes)
    test.skip(!boxes.some((b) => b.tabTop != null), `no named card on ${route} today`)

    const hits = tabCollisions(boxes)
    expect(
      hits,
      `name tabs touching the card above on ${route}: ${hits.map((h) => `${h.id} is ${h.gap}px from ${h.above}`).join('; ')}`,
    ).toEqual([])
  })
}
