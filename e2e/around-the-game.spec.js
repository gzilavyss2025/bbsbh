import { test, expect } from './fixtures.js'

// The five broadcast report boards (src/screens/around-the-game/), checked at PHONE
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
  { path: '/doubleheaders', name: 'The Double Dip' },
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

// THE YEAR SLIDER, which is the one control in the app with two handles and the
// one place a stacked-input range can quietly stop working. Two full-width
// inputs on one track means the top one swallows every tap unless the
// pointer-events rules in styles/68-around-the-game.css hold, and nothing about
// that failure is visible in a screenshot — the handle simply does not move.
//
// Driven by the keyboard rather than by a drag, deliberately: a native range
// input answers arrow keys, so this tests the CONTROL rather than testing
// Playwright's mouse. If the inputs ever stop being real sliders, this fails.
test('The Double Dip: narrowing the year range recounts the board', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/doubleheaders')

  const readout = page.locator('.yrange__years')
  await expect(readout).toBeVisible()
  const wholeSpan = await readout.innerText()

  const board = page.locator('table.dh tbody tr')
  await expect(board.first()).toBeVisible()
  const topRowWholeSpan = await board.first().innerText()

  // Both handles are reachable and each one moves its own end.
  await page.locator('.yrange__input--from').focus()
  await page.keyboard.press('ArrowRight')
  await expect(readout).not.toHaveText(wholeSpan)

  // One season only: drag the first handle up to the last. The two are allowed
  // to meet — a single season is a legitimate span — but never to cross.
  await page.getByRole('button', { name: 'This season' }).click()
  await expect(page.locator('.yrange__count')).toHaveText(/1 SEASON/i)

  // The board is recounted, not merely re-sorted: one season holds a few dozen
  // doubleheaders league-wide, so the top row cannot still read the same as it
  // did over twenty-three of them.
  await expect(board.first()).not.toHaveText(topRowWholeSpan)
})

// The year drawer — the "per year" half of the page. It opens from the DHs
// figure rather than from the row, because the row already holds a link.
test('The Double Dip: a row opens its year-by-year lines', async ({ page }) => {
  await page.setViewportSize(PHONE)
  await page.goto('/doubleheaders')

  const opener = page.locator('.dh__open').first()
  await expect(opener).toBeVisible()
  await expect(opener).toHaveAttribute('aria-expanded', 'false')
  await opener.click()

  await expect(opener).toHaveAttribute('aria-expanded', 'true')
  const drawer = page.locator('.dh__drawer')
  await expect(drawer).toBeVisible()
  await expect(drawer.locator('tbody tr').first()).toBeVisible()

  await opener.click()
  await expect(drawer).toHaveCount(0)
})
