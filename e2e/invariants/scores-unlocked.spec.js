import { test, expect } from '../fixtures.js'

// Scores Unlocked (ADR-0026) — the app's one opt-in departure from the spoiler
// rule. These specs pin the behavior that keeps it honest:
//   1. the toggle is offered only on today's slate, and turning it ON goes
//      through the consent modal (whose safe DISMISS is default-focused);
//   2. while the pass is on, opening a game shows scores with NO reveal tap, on
//      every section — and the in-game banner rides along on all of them as
//      the off switch (the slate's own toggle is its own off switch instead —
//      no separate banner there, see the .daystate chip in GameSelect.jsx);
//   3. consent records the DAY (`bbsbh:spoiledDays`), and turning the pass off
//      the same day takes that consent back, so a mis-tap costs nothing;
//   4. CRITICAL — none of it EVER writes the persisted reveal mark
//      (`bbsbh:reveal:{gamePk}`). What the pass shows is never recorded as
//      scored, on this device or (via ADR-0022's sync) any other.
//
// Selectors are structure, not copy (the consent wording is admin-editable):
// the data-testid on the slate toggle, ConsentModal's own class names, and
// the same `.statline`/sealed-cell proxies the other invariants specs use.
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

test('the day pass is offered today, gated by consent, and the switch is its own off switch', async ({
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

  // Confirm turns it on: the pass expiry is written and the switch reads on.
  await toggle.click()
  await page.locator('.consent__btn--confirm').click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  const expiry = await page.evaluate((p) => window.localStorage.getItem(p), PASS_KEY)
  expect(Number(expiry)).toBeGreaterThan(Date.now())

  // Consent records the DAY, not just the pass — that is what survives 8am.
  const daysOn = await page.evaluate((d) => window.localStorage.getItem(d), DAYS_KEY)
  expect(JSON.parse(daysOn ?? '[]')).toHaveLength(1)

  // The switch is itself the off switch — one more tap re-seals AND takes the
  // day's consent back, so an accidental tap on confirm costs nothing.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  expect(await page.evaluate((p) => window.localStorage.getItem(p), PASS_KEY)).toBeNull()
  const daysOff = await page.evaluate((d) => window.localStorage.getItem(d), DAYS_KEY)
  expect(JSON.parse(daysOff ?? '[]')).toHaveLength(0)
})

// Switching the pass OFF has to re-seal the slate in THIS tab, immediately —
// "an accidental tap on the confirm button costs nothing" (useScoresUnlocked's
// own words) is worth nothing if the scores stay on screen until a reload.
//
// The test above already toggles off and checks localStorage, and it passed
// throughout the window this was broken: the day map was persisted correctly
// and only the IN-MEMORY copy went stale, so nothing that reads storage could
// see it. `spoilersOffFor` reads the in-memory copy. So this asserts the one
// thing that actually tells them apart — live scores still painted on the
// cards, after the user has explicitly said stop.
//
// WHY THIS ONE STUBS THE FEED where its siblings guard on it: the observable
// IS a score on a card, so "no feed" would mean nothing to assert rather than
// less to assert, and a guarded version would silently pass everywhere it
// mattered. Two synthetic Live games is the smallest slate that renders a score
// line at all. Everything under test — the toggle, the consent sheet, the hook,
// `spoilersOffFor` — is the real thing; only the feed behind it is fixed. A
// stub that stops matching fails loudly (no cards, no score lines at step one)
// rather than quietly asserting nothing.
const localToday = () => {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// The shape fetchSchedule asks for, trimmed to what a card draws with (checked
// against a real statsapi response for a real slate, 2026-08-05).
const liveGame = (gamePk, away, home) => ({
  gamePk,
  gameDate: `${localToday()}T18:10:00Z`,
  officialDate: localToday(),
  // Live, not Final: `todayAllFinal` would otherwise hide the very toggle this
  // test drives, and a Final slate takes the past-day reveal-all path instead.
  status: { abstractGameState: 'Live', detailedState: 'In Progress', statusCode: 'I' },
  teams: {
    away: { team: { ...away, sport: { id: 1, name: 'Major League Baseball' } } },
    home: { team: { ...home, sport: { id: 1, name: 'Major League Baseball' } } },
  },
  venue: { id: 1, name: 'Test Park', timeZone: { tz: 'CDT', id: 'America/Chicago' } },
  gameNumber: 1,
  doubleHeader: 'N',
})

test('switching the pass off re-seals the slate immediately, without a reload', async ({ page }) => {
  const day = localToday()
  const games = [
    liveGame(776001, { id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers', abbreviation: 'MIL' }, { id: 112, name: 'Chicago Cubs', teamName: 'Cubs', abbreviation: 'CHC' }),
    liveGame(776002, { id: 147, name: 'New York Yankees', teamName: 'Yankees', abbreviation: 'NYY' }, { id: 111, name: 'Boston Red Sox', teamName: 'Red Sox', abbreviation: 'BOS' }),
  ]
  const slateScores = {
    dates: [
      {
        games: games.map((g, i) => ({
          gamePk: g.gamePk,
          teams: { away: { score: 3 + i }, home: { score: 1 + i } },
          linescore: { currentInning: 5, inningState: 'Top' },
        })),
      },
    ],
  }

  await page.route(
    (url) => url.hostname === 'statsapi.mlb.com',
    (route) => {
      const u = route.request().url()
      // The two requests this test cares about, told apart by their hydrate:
      // the slate itself never asks for a linescore (that is the whole point of
      // fetchSchedule staying score-free), and the score line's own request is
      // the only one that does.
      const onToday = u.includes(`&date=${day}`)
      const body =
        onToday && u.includes('hydrate=linescore') ? slateScores
        : onToday && u.includes('venue(timezone)') ? { dates: [{ games }] }
        : { dates: [] }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    },
  )

  await page.goto('/')
  await clearPass(page)
  await page.reload()

  const scoreLines = page.locator('.gamecard__scoreline')
  // If this is 0 the stub has stopped matching and nothing below means anything.
  await expect(page.locator('.gamecard')).toHaveCount(2)
  await expect(scoreLines).toHaveCount(0)

  // Pass ON: the slate paints live scores.
  const toggle = page.getByTestId('scores-unlock-switch')
  await toggle.click()
  await page.locator('.consent__btn--confirm').click()
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await expect(scoreLines).toHaveCount(2)

  // Pass OFF again — no reload, no navigation. THE assertion: the scores are
  // gone from the DOM, not merely gone from localStorage.
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')
  await expect(scoreLines).toHaveCount(0)
  expect(
    JSON.parse((await page.evaluate((d) => window.localStorage.getItem(d), DAYS_KEY)) ?? '[]'),
  ).toHaveLength(0)
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
    await expect(page.getByRole('button', { name: /Reveal the rest of half/i })).toHaveCount(0)
    await expect(page.locator('.statline')).toHaveCount(1)
  }

  // Turn the pass off and reload: the game re-seals, and the mark is STILL
  // unwritten (the pass never persisted anything).
  await clearPass(page)
  await page.goto(`${GAME}/top1`)
  const markAfterOff = await page.evaluate((k) => window.localStorage.getItem(k), KEY)
  expect(markAfterOff).toBeNull()
  if (await page.locator('.innings').count()) {
    await expect(page.getByRole('button', { name: /Reveal the rest of half/i })).toBeVisible()
    await expect(page.locator('.statline')).toHaveCount(0)
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
