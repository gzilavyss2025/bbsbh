import { test, expect } from './fixtures.js'

// The signed-out Game Log pitch normally needs Clerk configured and a fresh
// anonymous session. LogbookPage exposes the same presentation behind a
// DEV-only query for deterministic local verification; production ignores it
// and continues to let Clerk make the auth decision.
test('the signed-out Game Log explains the feature and its path into the book', async ({ page }) => {
  await page.goto('/logbook?signedout')

  await expect(
    page.getByRole('heading', { level: 1, name: 'A passport of the games you’ve scored.' }),
  ).toBeVisible()
  await expect(page.locator('.logbooklanding__book')).toBeVisible()
  await expect(page.locator('.logbooklanding__steps li')).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Start your Game Log' })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'I already have a book' })).toHaveCount(2)

  // A visitor is seeing an explanation, never a flash of their local stamps.
  await expect(page.locator('.logbook__grid')).toHaveCount(0)
})
