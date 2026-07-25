import { test, expect } from '../fixtures.js'

// Scores Unlocked (ADR-0026) — the app's one opt-in departure from the spoiler
// rule. These specs pin the behavior that keeps it honest:
//   1. the toggle is offered only on today's slate, and turning it ON goes
//      through the consent modal (whose safe DISMISS is default-focused);
//   2. while the pass is on, opening a game shows scores with NO reveal tap, on
//      every section — and the banner rides along on all of them as the off
//      switch;
//   3. consent records the DAY (`bbsbh:spoiledDays`), and turning the pass off
//      the same day takes that consent back, so a mis-tap costs nothing;
//   4. CRITICAL — none of it EVER writes the persisted reveal mark
//      (`bbsbh:reveal:{gamePk}`). What the pass shows is never recorded as
//      scored, on this device or (via ADR-0022's sync) any other.
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
const DAYS_KEY = 'bbsbh:spoiledDays'
// The fixture game's own date — what a locked-in consent would name.
const GAME_DAY = '2026-07-07'

const clearPass = async (page) => {
  await page.evaluate(
    ([p, k, d]) => {
      window.localStorage.removeItem(p)
      window.localStorage.removeItem(k)
      window.localStorage.removeItem(d)
    },
    [PASS_KEY, KEY, DAYS_KEY],
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

  // Consent records the DAY, not just the pass — that is what survives 8am.
  const daysOn = await page.evaluate((d) => window.localStorage.getItem(d), DAYS_KEY)
  expect(JSON.parse(daysOn ?? '[]')).toHaveLength(1)

  // The banner is itself the off switch — one tap re-seals AND takes the day's
  // consent back, so an accidental tap on confirm costs nothing.
  await banner.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate((p) => window.localStorage.getItem(p), PASS_KEY)).toBeNull()
  const daysOff = await page.evaluate((d) => window.localStorage.getItem(d), DAYS_KEY)
  expect(JSON.parse(daysOff ?? '[]')).toHaveLength(0)
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

// The box score is a score surface INSIDE a game, so the pass's promise ("every
// score shows plainly: no seals, no tapping") has to hold here too — it did not
// until BoxScore.jsx was wired to SealBox's forceRevealed. Same render-only
// footing as the innings view: unsealed while the pass is on, sealed again the
// moment it is off, and the persisted mark untouched throughout.
test('with the pass on, the box score unseals too — and still never writes the mark', async ({
  page,
}) => {
  await page.addInitScript(
    ([p]) => window.localStorage.setItem(p, String(Date.now() + 24 * 3600 * 1000)),
    [PASS_KEY],
  )
  await page.goto(`${GAME}/boxscore`)

  expect(await page.evaluate((k) => window.localStorage.getItem(k), KEY)).toBeNull()

  // Guarded like the innings assertions above: only meaningful once the feed has
  // actually rendered the box-score surface.
  if (await page.locator('.boxscore').count()) {
    await expect(page.getByRole('button', { name: 'Tap to reveal the box score' })).toHaveCount(0)
  }

  // Pass off -> the seal is back, and nothing was ever persisted.
  await clearPass(page)
  await page.goto(`${GAME}/boxscore`)
  expect(await page.evaluate((k) => window.localStorage.getItem(k), KEY)).toBeNull()
  if (await page.locator('.boxscore').count()) {
    await expect(page.getByRole('button', { name: 'Tap to reveal the box score' })).toBeVisible()
  }
})

// The banner has to ride along on EVERY section of a game, not just the innings
// view — otherwise you can land on an unsealed lineup or box score from a shared
// link with nothing saying why, and no way back to sealed without walking to the
// slate. It is also the off switch on all of them.
test('with the pass on, the off-switch banner is on every game section', async ({ page }) => {
  await page.addInitScript(
    ([p]) => window.localStorage.setItem(p, String(Date.now() + 24 * 3600 * 1000)),
    [PASS_KEY],
  )
  for (const section of ['lineup1', 'lineup2', 'top1', 'boxscore']) {
    await page.goto(`${GAME}/${section}`)
    await expect(page.getByTestId('spoilers-off-banner')).toBeVisible()
  }
  // And tapping it ends the pass from inside the game.
  await page.getByTestId('spoilers-off-banner').click()
  await expect(page.getByTestId('spoilers-off-banner')).toHaveCount(0)
  expect(await page.evaluate((p) => window.localStorage.getItem(p), PASS_KEY)).toBeNull()
})

// A day consented to in the past stays unlocked after its pass expires — that is
// the whole point of recording the day (spoiledDays.js). The distinguishing
// detail: NO banner, because there is no live pass to switch off, and a strip
// offering to would be lying. The reveal mark is still never written.
test('a day locked in by an earlier consent stays unsealed, with no banner', async ({ page }) => {
  await page.addInitScript(
    ([d, day]) => window.localStorage.setItem(d, JSON.stringify([day])),
    [DAYS_KEY, GAME_DAY],
  )
  await page.goto(`${GAME}/boxscore`)

  expect(await page.evaluate((k) => window.localStorage.getItem(k), KEY)).toBeNull()
  await expect(page.getByTestId('spoilers-off-banner')).toHaveCount(0)
  if (await page.locator('.boxscore').count()) {
    await expect(page.getByRole('button', { name: 'Tap to reveal the box score' })).toHaveCount(0)
  }
})
