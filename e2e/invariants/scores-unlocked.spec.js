import { test, expect } from '../fixtures.js'

// Scores Unlocked (ADR-0026) — the site-wide, today-only day pass. These specs
// pin the behavior that keeps the departure honest:
//   1. the toggle is offered only on today's slate, and turning it ON goes
//      through the consent modal (whose safe DISMISS is default-focused);
//   2. while the pass is on, opening a game shows scores with NO reveal tap;
//   3. the banner is the off switch, and turning the pass off re-seals;
//   4. CRITICAL — the pass NEVER writes the persisted reveal mark
//      (`bbsbh:reveal:{gamePk}`), so nothing it shows survives the 8am reset.
//
// Selectors are structure, not copy (the consent wording is admin-editable):
// data-testids on the slate toggle/banner, ConsentModal's own class names, and
// the same `.rhe`/sealed-cell proxies the other invariants specs use.
//
// Note: the innings-content checks need the live MLB feed. Where a run
// environment can't reach statsapi, those assertions are guarded so the spec
// still pins the pass's storage + toggle invariants (which don't need scores)
// rather than flaking on an absent feed.
const GAME = '/07072026/milstl-2'
const GAME_PK = '823035'
const KEY = `bbsbh:reveal:${GAME_PK}`
const PASS_KEY = 'bbsbh:scoresUnlocked'

const clearPass = async (page) => {
  await page.evaluate(
    ([p, k]) => {
      window.localStorage.removeItem(p)
      window.localStorage.removeItem(k)
    },
    [PASS_KEY, KEY],
  )
}

test('the day pass is offered today, gated by consent, and the banner is the off switch', async ({
  page,
}) => {
  await page.goto('/')
  await clearPass(page)
  await page.reload()

  const toggle = page.getByTestId('scores-unlock-switch')
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  // Turning it on must ASK first — the consent sheet, with the safe dismiss
  // holding initial focus.
  await toggle.click()
  const sheet = page.locator('.sheet.consent')
  await expect(sheet).toBeVisible()
  await expect(page.locator('.consent__btn--dismiss')).toBeFocused()

  // Dismiss leaves everything sealed — no pass written.
  await page.locator('.consent__btn--dismiss').click()
  await expect(sheet).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate((p) => window.localStorage.getItem(p), PASS_KEY)).toBeNull()

  // Confirm turns it on: the pass expiry is written and the banner appears.
  await toggle.click()
  await page.locator('.consent__btn--confirm').click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  const banner = page.getByTestId('scores-unlock-banner')
  await expect(banner).toBeVisible()
  const expiry = await page.evaluate((p) => window.localStorage.getItem(p), PASS_KEY)
  expect(Number(expiry)).toBeGreaterThan(Date.now())

  // The banner is itself the off switch — one tap re-seals.
  await banner.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate((p) => window.localStorage.getItem(p), PASS_KEY)).toBeNull()
})

test('the day pass is NOT offered on a past day', async ({ page }) => {
  await page.goto(GAME) // navigate into a game so a feed request has been made
  await page.goto('/07072026') // a past-day slate
  await expect(page.getByTestId('scores-unlock-switch')).toHaveCount(0)
})

test('with the pass on, a game unseals without a tap — and NEVER writes the reveal mark', async ({
  page,
}) => {
  // Seed the pass BEFORE the app loads, and prove the reveal mark starts absent.
  await page.addInitScript(
    ([p]) => window.localStorage.setItem(p, String(Date.now() + 24 * 3600 * 1000)),
    [PASS_KEY],
  )
  await page.goto(`${GAME}/top1`)

  // THE invariant: the pass shows scores by RENDER only. The persisted reveal
  // mark must remain unwritten no matter what the pass reveals on screen.
  const markWhileOn = await page.evaluate((k) => window.localStorage.getItem(k), KEY)
  expect(markWhileOn).toBeNull()

  // If the feed loaded, the top of the 1st reads as revealed with no tap and no
  // "Tap to reveal" cover. Guarded so a no-feed environment still pins the mark
  // invariant above rather than flaking.
  const runningLine = page.locator('.rolling__pick').first()
  if (await runningLine.count()) {
    await expect(page.getByRole('button', { name: 'Tap to reveal inning totals' })).toHaveCount(0)
    await expect(page.locator('.rhe')).toHaveCount(1)
  }

  // Turn the pass off and reload: the game re-seals, and the mark is STILL
  // unwritten (the pass never persisted anything).
  await clearPass(page)
  await page.goto(`${GAME}/top1`)
  const markAfterOff = await page.evaluate((k) => window.localStorage.getItem(k), KEY)
  expect(markAfterOff).toBeNull()
  if (await page.locator('.innings').count()) {
    await expect(page.getByRole('button', { name: 'Tap to reveal inning totals' })).toBeVisible()
    await expect(page.locator('.rhe')).toHaveCount(0)
  }
})
