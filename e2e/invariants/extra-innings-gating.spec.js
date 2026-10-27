import { test, expect } from '../fixtures.js'
import { halfCell, revealHalf } from '../lib/gameday.js'

// Extra innings never spoil (InningViewer.jsx): an inning past regulation
// only unlocks once the prior inning's bottom is revealed, so Gameday's line
// score and the advance control never hint a game went to extras before
// the user reveals their way there. 2025-05-27 BOS@MIL (gamePk 777747) is a
// 9-inning-regulation game that actually went to 10 (Yelich walk-off grand
// slam) — real data to exercise the unlock path against. Viewport-independent
// — mobile only.
const GAME = '/05272025/bosmil'

// The line score's inning headers. On a phone it folds into the Menu, so the
// Menu opens first (halfCell); Escape closes it again.
async function innings(page) {
  await halfCell(page, 'Top 1')
  const heads = await page.locator('.gdp__line thead th').allTextContents()
  if (await page.getByRole('dialog').count()) {
    await page.keyboard.press('Escape')
    await page.getByRole('dialog').waitFor({ state: 'detached' })
  }
  return heads
}

test('the 10th inning stays hidden until the 9th’s bottom is revealed', async ({
  page,
}) => {
  // Revealing the bottom of the 9th is a tap per plate appearance. With motion on, every play the
  // stage starts makes the next tap a skip (#2573), which doubles the taps; reduced motion rests the
  // stage, so each tap is a step. The gate under test does not read motion. The longer timeout
  // covers a slow feed on a cold dev server.
  test.setTimeout(90_000)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${GAME}/top1`)

  // Fresh state: only regulation (1-9) columns exist, and there's no way to
  // reach a "Next: Top 10th" from here.
  expect(await innings(page)).toContain('9')
  expect(await innings(page)).not.toContain('10')

  // Bottom of the 9th is directly reachable (it's the last regulation half)
  // — navigating there must not by itself unlock the 10th. Sealed, the bar
  // offers the step (ADR-0016, ADR-0123), not a "Top 10th ›" / "Box score ›"
  // advance — those only appear once this half is revealed. (The Menu's own
  // Box score door is a door, not the advance; it is closed here.)
  await page.goto(`${GAME}/bottom9`)
  expect(await innings(page)).not.toContain('10')
  await expect(page.locator('.gdnext__advance')).toHaveText(/Next play/)
  await expect(page.getByRole('button', { name: /top 10th/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /box score/i })).toHaveCount(0)

  await revealHalf(page)

  // Only now does the 10th unlock.
  expect(await innings(page)).toContain('10')
  await expect(page.getByRole('button', { name: /top 10th/i })).toBeVisible()
})
