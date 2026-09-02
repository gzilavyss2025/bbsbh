import { test, expect } from './fixtures.js'

// The Box Lines sheet (ADR-0069): the lineup page's "Career vs MIL" line is a
// door; behind it are the game-by-game rows, each dated strictly BEFORE the
// game being scored, each carrying a final score and a box-score link.
//
// Anchor game: 2026-06-27 CHC @ MIL (gamePk 823770), David Peterson's start
// against the Brewers. lineup2 is the Brewers' page, whose Starting pitcher
// card shows the CUBS' arm — him. Opening it for THAT game is the
// spoiler case the unit suite pins in the pure module: the June 27 row is the
// game being scored and must not exist, while the six earlier meetings show.
// Peterson's line only renders while he is on an MLB active roster (the
// nightly vs-team-splits file's scope), so the door assertion is skipped
// rather than failed when the line is absent — the row-date invariant is what
// this spec exists to hold, and it holds vacuously with no door.
const GAME = '/06272026/chcmil/lineup2'
const CUTOFF = '2026-06-27'

test('the career line opens Box Lines, and no row is dated on or after the scored game', async ({ page }) => {
  await page.goto(GAME)
  const door = page.getByRole('button', { name: /Career vs MIL/ })
  // The line rides the deferred enrichment tier (useGameData), so give it a
  // real chance to land before deciding it is absent.
  await door.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})
  if ((await door.count()) === 0) {
    test.skip(true, 'the opposing starter has no career line on file today')
    return
  }
  await door.click()

  const sheet = page.getByRole('dialog', { name: /vs the Brewers/ })
  await expect(sheet).toBeVisible()
  // The headline is the door's own text, verbatim.
  await expect(sheet.locator('.boxlines__headline')).toHaveText(await door.locator('span').first().textContent())

  // Rows land (or the sheet says why not); either way every row that exists
  // is dated before the cutoff and links to a box score.
  const rows = sheet.locator('.boxline:not(.boxline--skel)')
  await expect
    .poll(async () => (await rows.count()) > 0 || (await sheet.locator('.boxlines__hint').count()) > 0, {
      timeout: 20_000,
    })
    .toBe(true)
  const n = await rows.count()
  for (let i = 0; i < n; i++) {
    const href = await rows.nth(i).locator('a').getAttribute('href')
    expect(href).toMatch(/^\/(\d{8})\/[a-z]+(-\d)?\/boxscore$/)
    // MMDDYYYY in the path → YYYY-MM-DD, compared as strings.
    const [, mmddyyyy] = href.match(/^\/(\d{8})\//)
    const iso = `${mmddyyyy.slice(4)}-${mmddyyyy.slice(0, 2)}-${mmddyyyy.slice(2, 4)}`
    expect(iso < CUTOFF, `row ${i} is dated ${iso}, not before ${CUTOFF}`).toBe(true)
    // The score cell names both clubs, his first.
    await expect(rows.nth(i).locator('.boxline__score')).toHaveText(/^[A-Z]{2,3} \d+, [A-Z]{2,3} \d+$/)
  }

  // Escape closes it and focus returns to the door.
  await page.keyboard.press('Escape')
  await expect(sheet).toHaveCount(0)
  await expect(door).toBeFocused()
})
