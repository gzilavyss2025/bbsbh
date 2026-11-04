import { test, expect } from './fixtures.js'

// The club's roster-move ledger (`/team/{id}/transactions`,
// screens/team/TeamTransactionsPage.jsx): the wire lands here. Every club chip on the home
// slate's wire points at this page — the whole reason it exists — and a chip that quietly went
// back to the Games tab would still pass every content assertion. A browser is the only witness.

test('a club chip on the home wire lands on that club’s ledger', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/')
  // The wire is a LIVE read — two statsapi round trips deep, because the
  // /people call cannot name its ids until the transactions call answers — so
  // counting chips on arrival counts zero every time and skips a test that
  // would have passed. Wait for one, and skip only if none ever comes: the wire
  // is today + MLB only, and a genuinely quiet three days draws none.
  const chip = page.locator('.wire__club').first()
  const arrived = await chip
    .waitFor({ state: 'visible', timeout: 30_000 })
    .then(() => true)
    .catch(() => false)
  test.skip(!arrived, 'no roster moves on the wire right now')

  await chip.click()
  await page.waitForURL(/\/team\/[^/]+\/transactions/, { timeout: 30_000 })
  await expect(page.locator('.txpage')).toBeVisible()
  await expect(page.locator('.topbar__title')).toContainText(/transactions/i)
})
