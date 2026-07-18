import { test, expect } from '../fixtures.js'

// The core invariant (CLAUDE.md: "the whole point of the app"): a sealed
// value must not exist in the DOM pre-reveal, not merely be hidden by CSS.
// `SealBox` only invokes its render-function children in the revealed
// branch, wrapping the result in `.statgrid` — that markup is a direct
// structural proxy for "has this seal been revealed," so absence of it is
// exactly what would break if someone hoisted a reveal-only selector out to
// render-top-level or a pre-reveal `useMemo`. Viewport-independent, so this
// runs on mobile only (see playwright.config.js).
const GAME = '/07072026/milstl-2'

test('half-inning stat line is absent from the DOM, not just hidden, until revealed', async ({
  page,
}) => {
  await page.goto(`${GAME}/top1`)

  await expect(page.locator('.statgrid')).toHaveCount(0)
  await expect(page.locator('.rhe')).toHaveCount(0)
  await expect(page.locator('.pitchgrid')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tap to reveal inning totals' }).click()

  await expect(page.locator('.statgrid')).toHaveCount(1)
  await expect(page.locator('.rhe')).toHaveCount(1)
  await expect(page.locator('.pitchgrid')).toHaveCount(1)
})

test('box score is absent from the DOM until its own seal is tapped', async ({ page }) => {
  await page.goto(`${GAME}/boxscore`)

  // Multiple SealBoxes can live on this page (box score, game buzz, …) —
  // none of them should have leaked their content pre-tap.
  await expect(page.locator('.statgrid')).toHaveCount(0)

  await page.getByRole('button', { name: 'Tap to reveal the box score' }).click()

  await expect(page.locator('.statgrid').first()).toBeVisible()
})
