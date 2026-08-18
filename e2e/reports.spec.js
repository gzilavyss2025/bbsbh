import { test, expect } from './fixtures.js'

// The four broadcast report boards (src/screens/reports/), checked at PHONE
// WIDTH, which is the only width where the thing under test exists.
//
// WHY THIS SPEC EXISTS. Every one of these boards is wider than a phone and
// scrolls horizontally inside `.ledger-wrap`, with the club column pinned so
// the numbers scroll under it. That pin was broken on the first version and
// invisible in every desktop check: at 768px and up there is no overflow at
// all, so the column is never exercised. On a 390px iPhone the pinned cell
// slid to x = -261 and the board became eighteen rows of unattributable
// numbers.
//
// The cause is written up in styles/26-player-page.css: `position: sticky`
// resolves against the nearest ancestor whose overflow is not `visible`, and
// the shared `.standings` base sets `overflow: hidden` on the TABLE — which
// never scrolls. `.ledger-wrap .rpt { overflow: visible }` is the fix. This
// spec is what stops it regressing the next time someone touches either
// stylesheet, because nothing about the failure is visible on a laptop.
//
// Not CI-gated (`npm run e2e` is the browser verification harness, not part of
// lint-and-build) — run it against a live dev server.

const PHONE = { width: 390, height: 844 }

const BOARDS = [
  { path: '/attendance', name: 'The Gate' },
  { path: '/pace-of-play', name: 'The Clock' },
  { path: '/farm-system-rankings', name: 'The Farm Report' },
  { path: '/bullpen-availability', name: 'The Pen' },
]

for (const board of BOARDS) {
  test(`${board.name}: the club column stays pinned when the board scrolls`, async ({ page }) => {
    await page.setViewportSize(PHONE)
    await page.goto(board.path)

    const wrap = page.locator('.ledger-wrap').first()
    await expect(wrap.locator('tbody tr').first()).toBeVisible()

    // The pin only means anything if there is something to scroll. If a board
    // ever stops overflowing at phone width this assertion fails loudly rather
    // than letting the real check below pass vacuously.
    const overflow = await wrap.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow, 'board should be wider than a phone').toBeGreaterThan(0)

    const cell = wrap.locator('tbody th.team').first()
    const before = await cell.boundingBox()
    await wrap.evaluate((el) => {
      el.scrollLeft = el.scrollWidth
    })
    const after = await cell.boundingBox()

    // Pinned: the cell holds its own left edge instead of travelling with the
    // columns. A tolerance of 2px absorbs sub-pixel layout, nothing more.
    expect(Math.abs(after.x - before.x)).toBeLessThan(2)
    expect(after.x).toBeGreaterThanOrEqual(0)
  })
}

// The board's rank glyph and the figure printed beside it are computed from
// two different numbers on The Clock — the sort runs on the float, the rank on
// the minute a reader sees. They agreed until they did not: the board once
// printed "T3 2:47 / T3 2:47 / T3 2:47 / 6 2:47", marking three clubs as tied
// and denying the fourth showing the identical clock. Any two rows printing
// the same clock must carry the same rank.
test('The Clock: rows showing the same time carry the same rank', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/pace-of-play')

  // Wait for the FULL board, not just its first row. `evaluateAll` does not
  // auto-wait, so reading it mid-render catches a half-populated table and the
  // comparison below becomes a comparison of two different sorts.
  const body = page.locator('.ledger-wrap').first().locator('tbody tr')
  await expect.poll(() => body.count(), { timeout: 10_000 }).toBeGreaterThan(25)

  const rows = await body.evaluateAll((trs) =>
    trs.map((tr) => {
      // The club cell is a `<th scope="row">`, so the numeric columns are the
      // `td`s and the rank glyph lives in the header cell beside them.
      return {
        rank: tr.querySelector('th.team .rpt__rank')?.textContent?.trim() ?? '',
        clock: tr.querySelectorAll('td')[0].textContent.trim(),
      }
    }),
  )

  const rankByClock = new Map()
  for (const row of rows) {
    if (!rankByClock.has(row.clock)) rankByClock.set(row.clock, row.rank)
    expect(rankByClock.get(row.clock), `two rows print ${row.clock} with different ranks`).toBe(
      row.rank,
    )
  }
})
