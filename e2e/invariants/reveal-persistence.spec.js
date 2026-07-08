import { test, expect } from '@playwright/test'

// The `revealedThrough` high-water mark (InningViewer.jsx): persists per
// gamePk to localStorage so returning to a game re-reveals only up to where
// the user left off — never further. Also covers the Pitchers table and
// RollingLine running line, which aren't behind their own SealBox but are
// gated by this same mark; folded in here since the setup (reveal top of the
// 1st) is shared. Viewport-independent — mobile only.
const GAME = '/07072026/milstl-2'

test('reveal mark advances forward, gates the Pitchers/RollingLine tables, and survives reload without over-revealing', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  // Nothing revealed yet: the page-wide Pitchers table (gated on the same
  // mark, not its own SealBox) shouldn't render at all.
  await expect(page.locator('.pitchers')).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: 'Bottom of inning 1, sealed' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Tap to reveal inning totals' }).click()

  // Top of the 1st is in; bottom of the 1st must still read as sealed in the
  // running line — revealing one half must not leak its sibling.
  await expect(page.getByRole('button', { name: /Top of inning 1, \d+ runs?/ })).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Bottom of inning 1, sealed' }),
  ).toBeVisible()

  // The Pitchers table now reflects the one revealed half.
  await expect(page.locator('.pitchers')).toHaveCount(1)
  expect(await page.locator('.pitchers__grid tbody tr').count()).toBeGreaterThanOrEqual(1)

  // Reload: top of the 1st should come back pre-revealed from localStorage —
  // no re-tap needed...
  await page.reload()
  await expect(page.locator('.rhe')).toHaveCount(1)
  await expect(page.locator('.pitchers')).toHaveCount(1)

  // ...but the persisted mark must not have crept past what was actually
  // revealed: bottom of the 1st is still sealed after the reload.
  await page.goto(`${GAME}/bottom1`)
  await expect(page.getByRole('button', { name: 'Tap to reveal inning totals' })).toBeVisible()
  await expect(page.locator('.rhe')).toHaveCount(0)
})
