import { test, expect } from '../fixtures.js'

// The runtime half of My Tally's one rule: **/profile renders no game data at
// all** (PRD §0, invariants P4 and P6).
//
// `scripts/check-stamp-surfaces.mjs` is the static half — it fails lint if
// anything under src/screens/profile/ or src/components/profile/ so much as
// names GameStamp or StampGameButton. This is the half that catches what a
// static check cannot: a fetch that reaches a ballpark, or a number that got
// onto the page by some route nobody predicted.

test('/profile issues no request to statsapi and prints nothing score-shaped', async ({ page }) => {
  const feedRequests = []
  page.on('request', (req) => {
    if (req.url().includes('statsapi.mlb.com')) feedRequests.push(req.url())
  })

  await page.goto('/profile')
  await expect(page.getByRole('heading', { level: 1, name: 'My Tally' })).toBeVisible()

  // Give any late effect a chance to fire before concluding nothing did.
  await page.waitForTimeout(1500)

  // The club strip's marks come from the same-origin public/data/teams.json,
  // deliberately, so this page never touches the feed. If this fails, something
  // reached for src/api/schedule.js — check the import, not the assertion.
  expect(feedRequests, `unexpected feed requests: ${feedRequests.join(', ')}`).toHaveLength(0)

  // No stamp art, by any route — an import, a copy-pasted SVG, anything.
  await expect(page.locator('.gamestamp')).toHaveCount(0)
  await expect(page.locator('[class*="gamestamp"]')).toHaveCount(0)

  // No score-shaped token in the page's own content. The footer is excluded on
  // purpose: it carries the build stamp and the © line, neither of which is
  // this page's doing.
  const body = await page.locator('main').innerText()
  expect(body).not.toMatch(/\b\d+\s*[-–—]\s*\d+\b/)
  // "Final", "top 7th", "bottom of the" — the vocabulary of a game in progress
  // has no business on a settings page.
  expect(body).not.toMatch(/\bfinal\b/i)
  expect(body).not.toMatch(/\b(top|bottom) \d/i)
})
