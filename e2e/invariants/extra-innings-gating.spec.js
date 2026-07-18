import { test, expect } from '../fixtures.js'

// Extra innings never spoil (InningViewer.jsx): an inning past regulation
// only unlocks once the prior inning's bottom is revealed, so the running
// line and the floating nav button never hint a game went to extras before
// the user reveals their way there. 2025-05-27 BOS@MIL (gamePk 777747) is a
// 9-inning-regulation game that actually went to 10 (Yelich walk-off grand
// slam) — real data to exercise the unlock path against. Viewport-independent
// — mobile only.
const GAME = '/05272025/bosmil'

test('the 10th inning stays hidden until the 9th’s bottom is revealed', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  // Fresh state: only regulation (1-9) columns exist, and there's no way to
  // reach a "Next: Top 10th" from here.
  expect(await page.locator('.rolling__grid thead th').allTextContents()).not.toContain('10')

  // Bottom of the 9th is directly reachable (it's the last regulation half)
  // — navigating there must not by itself unlock the 10th.
  await page.goto(`${GAME}/bottom9`)
  expect(await page.locator('.rolling__grid thead th').allTextContents()).not.toContain('10')
  await expect(page.getByRole('button', { name: /view box score/i })).toBeVisible()
  await expect(page.getByRole('button', { name: /next: top 10th/i })).toHaveCount(0)

  await page.getByRole('button', { name: 'Tap to reveal inning totals' }).click()

  // Only now does the 10th unlock.
  expect(await page.locator('.rolling__grid thead th').allTextContents()).toContain('10')
  await expect(page.getByRole('button', { name: /next: top 10th/i })).toBeVisible()
})
