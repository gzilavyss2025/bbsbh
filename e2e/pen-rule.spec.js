import { test, expect } from './fixtures.js'

// THE PEN'S RULE MARK — BullpenPage.jsx's PenRule, under the staff grid.
//
// The page used to state the thresholds in prose because the grid draws cells
// and rails and never the lines those readings are judged against. The bullets
// draw them now, on the arm the grid sorts to the top, so what has to hold is
// a WIRING claim rather than a value: the caption names the man whose bars are
// drawn, and the paragraph no longer repeats numbers the mark carries.
//
// Nothing here pins a pitcher or a count. workload.json is regenerated nightly,
// so every assertion is a relationship between two things ON THE PAGE — which
// is also what makes the spec worth having: a mix-up would still show real
// numbers under a real name.
//
// Runs offline: The Pen reads /data/workload.json and the static teams file,
// never statsapi.
test('the rule is drawn under the grid, on the arm the grid ranks first', async ({ page }) => {
  await page.goto('/bullpen-availability')

  const rule = page.locator('.penpage__rule')
  await expect(rule).toBeVisible()

  // One bullet a flag, in api/workload.js's fixed TIRED_FLAGS order.
  await expect(rule.locator('.bullets__label')).toHaveText(['Yest.', '3 days', 'In a row'])

  const captionArm = await rule.locator('.penpage__rulehead .plink').innerText()
  const topArm = await page
    .locator('.staffgrid__row')
    .first()
    .locator('.staffgrid__name')
    .getAttribute('aria-label')
  expect(captionArm).toBe(topArm)
})

// Every chip re-reads the grid AND the mark. A caption left behind on the
// previous club is the failure this catches — the numbers would still be real.
test('switching clubs moves the mark with the grid', async ({ page }) => {
  await page.goto('/bullpen-availability')
  await expect(page.locator('.penpage__rule')).toBeVisible()

  const chips = page.locator('[aria-label="Club"] .rpt-chip')
  const count = await chips.count()
  expect(count).toBeGreaterThan(1)

  for (let i = 0; i < count; i++) {
    await chips.nth(i).click()
    const captionArm = await page.locator('.penpage__rulehead .plink').innerText()
    const topArm = await page
      .locator('.staffgrid__row')
      .first()
      .locator('.staffgrid__name')
      .getAttribute('aria-label')
    expect(captionArm, `club chip ${i}`).toBe(topArm)
    await expect(page.locator('.penpage__rule .bullets__row')).toHaveCount(3)
  }
})

// The point of drawing the rule was to stop the paragraph carrying it. If the
// numbers come back into the prose, the mark has become decoration.
test('the method note keeps the combining rule and drops the numbers', async ({ page }) => {
  await page.goto('/bullpen-availability')
  const method = page.locator('section.method')
  await expect(method).toBeVisible()

  const text = await method.innerText()
  expect(text).toContain('files an arm as likely down')
  for (const spelled of ['25 or more', '35 or more', 'both of the previous two days']) {
    expect(text, `the bullets draw this now: "${spelled}"`).not.toContain(spelled)
  }

  // The caption is a sentence, not chrome — it must escape the ALL-CAPS
  // invariant (01-base.css), which `#root *` would otherwise impose on it.
  const caption = page.locator('.penpage__rulehead')
  await expect(caption).toHaveCSS('text-transform', 'none')
})
