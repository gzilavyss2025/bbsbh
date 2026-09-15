import { test, expect } from './fixtures.js'

// THE OFFSEASON HOME PAGE (issue #1038, step 2) — the slate's winter state.
//
// Every date below is a REAL past winter browsed to by URL, not a mock: the
// gate reads statsapi's own published season dates, so pointing the slate at
// December 10, 2025 exercises exactly the code a December visit will, against
// exactly the rows it will get. The unit suite (test/season-phase.test.js)
// already pins the date arithmetic in isolation; what needs a browser is the
// SWAP — that the wire actually leaves the rail and leads the page, that the
// countdown takes the slot it vacated, and that the whole arrangement is gone
// again the day spring training opens.
//
// The dates, and why each one is here:
//   2025-12-10  Winter Meetings week — a busy wire, mid-offseason.
//   2026-01-20  the far side of the New Year seam. statsapi rolls the season
//               over on January 1, so this is the branch that reads its spring
//               date off the row already in hand. It is also the case a naive
//               `getFullYear() - 1` gets wrong.
//   2026-02-19  the last day of the winter.
//   2026-02-20  spring training opens. The page must be gone, not fading.

const WINTER = '/12102025'
const NEW_YEAR = '/01202026'
const LAST_DAY = '/02192026'
const SPRING = '/02202026'

test('the wire leads the page, and the rail is gone', async ({ page }) => {
  await page.goto(WINTER)
  const lead = page.locator('.oseason')
  await expect(lead).toBeVisible()
  // It is the SAME wire, promoted — so it says so, and it carries real rows.
  await expect(lead.locator('.oseason__title')).toHaveText('Transactions')
  await expect(lead.locator('[data-move-row]').first()).toBeVisible()

  // The rail and the dock are the wire's other two presentations. Exactly one
  // of the three may exist at a time, or the same feed is on screen twice.
  await expect(page.locator('.wirerail')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveCount(0)

  // And the words it replaces are not underneath it.
  await expect(page.getByText('No games scheduled.')).toHaveCount(0)
})

test('the lead sits above the fold and takes the full width', async ({ page }) => {
  await page.goto(WINTER)
  const lead = page.locator('.oseason')
  await expect(lead).toBeVisible()
  const box = await lead.boundingBox()
  const main = await page.locator('.slatebody__main').boundingBox()
  // Full width of the games column — this is the whole claim of the change.
  // A regression that left the wire in a 288px column would still pass every
  // assertion about its contents.
  expect(box.width).toBeGreaterThan(main.width - 2)
  // The reader's first line of type, not something below a banner.
  expect(box.y).toBeLessThan(400)
})

test('the countdown takes the rail slot, and counts to a real date', async ({ page }) => {
  await page.goto(WINTER)
  const count = page.locator('.springcount')
  await expect(count).toBeVisible()
  // Spring training 2026 opened February 20. From December 10 that is 72 days,
  // and the number is arithmetic on a published date, not a typed one.
  await expect(count.locator('.springcount__n')).toHaveText('72')
  await expect(count.locator('.springcount__day')).toContainText('Feb 20')

  // WHERE it stands depends on whether there is a rail slot to stand in, and
  // both placements are worth pinning. Wide, it is the column the wire left —
  // to the RIGHT of the games. On a phone there is no such column and it
  // follows the calendar inside the lead, which is the arrangement the whole
  // `{!wide && <SpringCountdown/>}` child in GameSelect exists to produce.
  const wide = page.viewportSize().width >= 740
  const cd = await count.boundingBox()
  const main = await page.locator('.slatebody__main').boundingBox()
  if (wide) {
    expect(cd.x).toBeGreaterThan(main.x + main.width - 2)
    await expect(page.locator('.oseason .springcount')).toHaveCount(0)
  } else {
    await expect(page.locator('.oseason .springcount')).toHaveCount(1)
    const cal = await page.locator('.wintercal').boundingBox()
    expect(cd.y).toBeGreaterThan(cal.y)
  }
  // Either way there is exactly one of it.
  await expect(count).toHaveCount(1)
})

test('the winter calendar shows only dates the app can source', async ({ page }) => {
  await page.goto(WINTER)
  const ticks = page.locator('.wintercal__item')
  // With no calendar typed at /admin, the strip is the two dates that come off
  // the schedule and nothing else — short rather than confidently wrong.
  await expect(ticks).toHaveCount(2)
  await expect(ticks.nth(0)).toContainText('Spring training')
  await expect(ticks.nth(1)).toContainText('Opening Day')
  // The one that has not happened yet is named for a screen reader, not left
  // to the colour change alone.
  await expect(ticks.nth(0)).toHaveAttribute('aria-current', 'date')
})

test('January is still last season, and needs no second row', async ({ page }) => {
  await page.goto(NEW_YEAR)
  // The season that ended is 2025, though the calendar year is 2026.
  await expect(page.locator('.oseason')).toHaveAttribute('aria-label', 'The 2025 offseason')
  await expect(page.locator('.springcount__n')).toHaveText('31')
})

test('the winter closes the day spring training opens', async ({ page }) => {
  await page.goto(LAST_DAY)
  await expect(page.locator('.oseason')).toBeVisible()
  await expect(page.locator('.springcount__n')).toHaveText('1')
  // Singular, one day out.
  await expect(page.locator('.springcount__day')).toContainText('day —')

  await page.goto(SPRING)
  await expect(page.locator('.oseason')).toHaveCount(0)
  await expect(page.locator('.springcount')).toHaveCount(0)
  // The games are back, and so is the rail beside them.
  await expect(page.locator('.gamelist > li').first()).toBeVisible()
})

test('the offseason page is MLB only', async ({ page }) => {
  // The MiLB tabs go dark far longer than MLB's does, but their offseason has
  // three leagues finishing on three different dates and is step 3 of the
  // issue. Until then a minor level keeps its ordinary empty day.
  await page.goto(`/aaa${WINTER}`)
  await expect(page.locator('.oseason')).toHaveCount(0)
  await expect(page.locator('.springcount')).toHaveCount(0)
})

test('the door opens onto the rest of the window, and closes again', async ({ page }) => {
  await page.goto(WINTER)
  const rows = page.locator('.oseason__list [data-move-row]')
  await expect(rows).toHaveCount(6)
  const door = page.locator('.oseason__door')
  await expect(door).toHaveAttribute('aria-expanded', 'false')
  // A thumb-sized control, same floor as every other action in the app.
  const box = await door.boundingBox()
  expect(box.height).toBeGreaterThanOrEqual(44)

  await door.click()
  await expect(door).toHaveAttribute('aria-expanded', 'true')
  const opened = await rows.count()
  expect(opened).toBeGreaterThan(6)

  await door.click()
  await expect(rows).toHaveCount(6)
})
