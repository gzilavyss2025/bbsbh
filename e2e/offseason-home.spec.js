import { readFileSync } from 'node:fs'
import { test, expect } from './fixtures.js'

// THE OFFSEASON HOME PAGE (issue #1038, steps 2 and 3) — the slate's winter
// state, at MLB and at the four levels below it.
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

// A MINOR LEVEL's winter, which is a different reading off a different endpoint
// (ADR-0079): High-A 2025 ran out on September 20, the last of its three
// leagues, so October 12 is four weeks into a winter while MLB is still in its
// postseason. April 2, 2026 is the day the first of those leagues played again.
const LEVEL_WINTER = '/higha/10122025'
const LEVEL_LAST_DAY = '/higha/04012026'
const LEVEL_OPENER = '/higha/04022026'

// The promotions list is drawn from the nightly leader board, and that file
// names the season it holds. Reading it here rather than hard-coding a year
// keeps this spec green across a rollover instead of quietly measuring nothing.
const BOARD_SEASON = JSON.parse(
  readFileSync(new URL('../public/data/minors-leaders.json', import.meta.url), 'utf8'),
).season

// The picked-game card's pool names its season the same way, and for the same
// reason — it is one season deep, so the page that deals from it has to be that
// season's winter (ADR-0080).
const POOL_SEASON = JSON.parse(
  readFileSync(new URL('../public/data/milb-pool/13.json', import.meta.url), 'utf8'),
).season

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

test('a minor level gets its own winter, and not the wire', async ({ page }) => {
  await page.goto(LEVEL_WINTER)
  const lead = page.locator('.oseason--level')
  await expect(lead).toBeVisible()
  await expect(lead).toHaveAttribute('aria-label', 'The 2025 A+ offseason')
  await expect(lead.locator('.oseason__title--page')).toHaveText('A+ offseason')

  // The wire leads the MLB page and not this one: at High-A in December it is
  // close to silent, and none of its three presentations belongs here.
  await expect(page.locator('.oseason__list')).toHaveCount(0)
  await expect(page.locator('.wirerail')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveCount(0)
  await expect(page.getByText('No games scheduled.')).toHaveCount(0)
})

test('the level countdown counts to Opening Day, not to spring', async ({ page }) => {
  // There is no minor-league spring training row to count to. High-A 2026
  // opened April 2; from October 12, 2025 that is 172 days.
  await page.goto(LEVEL_WINTER)
  const count = page.locator('.springcount')
  await expect(count.locator('.springcount__label')).toHaveText('Opening Day')
  await expect(count.locator('.springcount__n')).toHaveText('172')
  await expect(count.locator('.springcount__day')).toContainText('Apr 2')

  // And the strip appends the one date it can check, without a spring tick.
  const ticks = page.locator('.wintercal__item')
  await expect(ticks).toHaveCount(1)
  await expect(ticks.nth(0)).toContainText('Opening Day')
})

test('the winter closes the day the FIRST league plays again', async ({ page }) => {
  // The Northwest League opened a day after the other two in 2026. The page has
  // to be gone on the 2nd, when there is baseball at the level again — not on
  // the 3rd, when the last of the three joins in.
  await page.goto(LEVEL_LAST_DAY)
  await expect(page.locator('.oseason--level')).toBeVisible()
  await expect(page.locator('.springcount__n')).toHaveText('1')

  await page.goto(LEVEL_OPENER)
  await expect(page.locator('.oseason')).toHaveCount(0)
  await expect(page.locator('.springcount')).toHaveCount(0)
})

test('the level page leads with who moved up', async ({ page }) => {
  // The board the list is drawn from holds one season, so the page that reads
  // it has to be that season's. Any other winter shows no list at all rather
  // than last year's promotions under this year's heading.
  await page.goto(`/higha/1012${BOARD_SEASON}`)
  const table = page.locator('.movedup__table')
  await expect(table).toBeVisible()
  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(6)
  // A climb is written as its two ends, and it is a real one: the level the
  // player finished at is above the level this page is.
  await expect(rows.first().locator('.movedup__climb')).toContainText('→')
  // A face on every row, and a real photo rather than the monogram fallback —
  // these are minor-leaguers, so the studio silo 404s for most of them and the
  // milb rung is the one that has to answer (Headshot.jsx's rung policy).
  await expect(rows.locator('.movedup__shot img')).toHaveCount(6)
  // What the list is drawn from, in a sentence, in natural case.
  const pool = page.locator('.movedup__pool')
  await expect(pool).toContainText('Not every promotion')
  await expect(pool).toHaveCSS('text-transform', 'none')

  // The same door the wire uses, opening onto the rest. Scoped to this list:
  // step 4's notebook note wears the same door on the same page (#1078).
  const door = page.locator('.movedup .oseason__door')
  await door.click()
  expect(await rows.count()).toBeGreaterThan(6)
})

test('a ranked prospect wears his rank, and the rest wear nothing', async ({ page }) => {
  await page.goto(`/higha/1012${BOARD_SEASON}`)
  const rows = page.locator('.movedup__table tbody tr')
  await expect(rows.first()).toBeVisible()
  // The pill is spliced in unconditionally and renders nothing for a player
  // ranked nowhere, so the count is a real fraction of the list rather than
  // one badge per row. Anything that decorated every row would be decoration.
  const pills = page.locator('.movedup .prospectpill')
  const shown = await pills.count()
  expect(shown).toBeGreaterThan(0)
  expect(shown).toBeLessThan(await rows.count())
  await expect(pills.first()).toContainText('PROSPECT')
})

test('the level page offers a checked game, and says why', async ({ page }) => {
  await page.goto(`/higha/1012${POOL_SEASON}`)
  const card = page.locator('.pgame')
  await expect(card).toBeVisible()

  // It is above the promotions list — the page's one action comes first.
  const cardBox = await card.boundingBox()
  const listBox = await page.locator('.movedup').boundingBox()
  expect(cardBox.y).toBeLessThan(listBox.y)

  // The promise, on kraft tape, because the game it opens is sealed.
  await expect(card.locator('.pgame__seal')).toHaveText('Score sealed')
  // The fact the pool was built to establish, and the only claim on this card
  // that a schedule row could not have made.
  await expect(card.locator('.pgame__meta')).toContainText('Lineups posted')
  // Why this game, in natural case, about the people in it.
  const why = card.locator('.pgame__why')
  await expect(why).toBeVisible()
  await expect(why).toHaveCSS('text-transform', 'none')
  // And nothing on the card that could say how the game went.
  await expect(card).not.toContainText(/final|won|lost|innings/i)

  // The link is the game's ordinary lineup address, not a second way in.
  const href = await card.locator('.pgame__go').getAttribute('href')
  expect(href).toMatch(/^\/\d{8}\/[a-z0-9-]+\/lineup1$/)
})

test('"another game" deals a different game from the same deck', async ({ page }) => {
  await page.goto(`/higha/1012${POOL_SEASON}`)
  const clubs = page.locator('.pgame__clubs')
  await expect(clubs).toBeVisible()
  const first = await clubs.innerText()
  await page.getByRole('button', { name: 'Another game' }).click()
  await expect(clubs).not.toHaveText(first)
})

test('the offered game opens, and opens on its lineups', async ({ page }) => {
  await page.goto(`/higha/1012${POOL_SEASON}`)
  const card = page.locator('.pgame')
  await expect(card).toBeVisible()
  const away = await card.locator('.pgame__name').first().innerText()
  const href = await card.locator('.pgame__go').getAttribute('href')

  await card.locator('.pgame__go').click()
  await expect(page).toHaveURL(new RegExp(`${href}$`))
  // The game the card named, on the page the card promised. A pool entry whose
  // feed had gone thin would land here on an empty shell instead.
  await expect(page.getByText(away, { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Ballpark', { exact: false }).first()).toBeVisible()
})

test('a winter the pool is not about shows no card at all', async ({ page }) => {
  // The pool is one season deep. An older winter still gets its page — the
  // promotions list, the calendar, the countdown — and simply no invitation,
  // rather than a game from a season this page is not about.
  await page.goto(`/higha/1012${POOL_SEASON - 1}`)
  await expect(page.locator('.oseason--level')).toBeVisible()
  await expect(page.locator('.pgame')).toHaveCount(0)
})

test('an in-season empty day at a level is still an empty day', async ({ page }) => {
  // A Monday in July is the case an empty-slate gate gets wrong. High-A 2026
  // ran from April 4, so this is squarely inside the season.
  await page.goto('/higha/07062026')
  await expect(page.locator('.oseason')).toHaveCount(0)
  await expect(page.locator('.springcount')).toHaveCount(0)
})

test('the door opens onto the rest of the window, and closes again', async ({ page }) => {
  await page.goto(WINTER)
  const rows = page.locator('.oseason__list [data-move-row]')
  await expect(rows).toHaveCount(6)
  // The wire's own door is the direct child of the lead; the notebook note
  // below it wears the same one (#1078).
  const door = page.locator('.oseason > .oseason__door')
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

// ---------------------------------------------------------------------------
// STEP 4 — the notebook note, and the season record (issue #1078).
//
// Both notes name the season their FILE is about, so every date below is
// derived from the committed data rather than typed: a spec that hard-coded
// 2026 would quietly measure nothing the first winter after a rollover.

// The MLB note is a census of one season, so the winter that shows it is that
// season's own — November of the year the file names.
const AT_BAT_SEASON = JSON.parse(
  readFileSync(new URL('../public/data/long-at-bats/2026.json', import.meta.url), 'utf8'),
).season
const AT_BAT_WINTER = `/1115${AT_BAT_SEASON}`

// The age note ships one file per level, each naming its own season.
const AGE_SEASON = JSON.parse(
  readFileSync(new URL('../public/data/youngest-regulars/13.json', import.meta.url), 'utf8'),
).season

test('the MLB page carries one note, and it is a count with its denominator', async ({ page }) => {
  await page.goto(AT_BAT_WINTER)
  const note = page.locator('.note')
  await expect(note).toBeVisible()
  await expect(note.locator('.note__title')).toHaveText('The twelve-pitch at-bats')

  // A figure means nothing without the population it came out of, which is the
  // one rule research.md §7 puts on every note in this family.
  const figure = Number(await note.locator('.note__n').innerText())
  expect(figure).toBeGreaterThan(0)
  await expect(note.locator('.note__under')).toContainText('plate appearances')
  await expect(note.locator('.note__under')).toHaveCSS('text-transform', 'none')

  // Five rows up front, and the door opens the whole census — the count on the
  // figure IS the length of the list, or the note is claiming something the
  // rows cannot show.
  const rows = note.locator('.note__story')
  await expect(rows).toHaveCount(5)
  await note.locator('.oseason__door').click()
  await expect(rows).toHaveCount(figure)
})

test('a note row says how LONG an at-bat was, never how it went', async ({ page }) => {
  await page.goto(AT_BAT_WINTER)
  const row = page.locator('.note__story').first()
  await expect(row).toBeVisible()
  // Twelve is the floor, so every row is at or above it.
  expect(Number(await row.locator('.note__valn').innerText())).toBeGreaterThanOrEqual(12)

  // IT IS THE /fouls ROW, MINUS THE SCOREBUG. Both men's faces and both names,
  // which is what makes a long at-bat read as two people — and none of the
  // score, inning, outs, bases or result that board's scorebug carries, because
  // this one is on the slate (ADR-0081). The scan is on the rows rather than the
  // whole note: the note's own footnote explains the inning-ending-caught-
  // stealing rule in words, and has to be allowed to.
  await expect(row.locator('.note__shot')).toHaveCount(2)
  await expect(row.locator('.note__name')).toHaveCount(2)
  await expect(page.locator('.note__stories')).not.toContainText(
    /strikeout|walk|home run|flyout|groundout|inning|final|won|lost|[0-9]+-[0-9]+/i,
  )
  await expect(page.locator('.note .scorebug')).toHaveCount(0)

  // The row opens its game at the slate's own lineup address, so it arrives
  // sealed under the same reveal mark as any other game.
  const href = await row.locator('.note__when').getAttribute('href')
  expect(href).toMatch(/^\/\d{8}\/[a-z0-9-]+\/lineup1$/)
})

test('a level note measures age against its own league, and says what its floor drops', async ({
  page,
}) => {
  await page.goto(`/higha/1012${AGE_SEASON}`)
  const note = page.locator('.note')
  await expect(note).toBeVisible()
  await expect(note.locator('.note__title')).toHaveText('Youngest regulars')

  // The youngest regular, and the league he is being measured against. The
  // whole note is the gap between those two numbers.
  const youngest = Number(await note.locator('.note__n').innerText())
  expect(youngest).toBeGreaterThan(15)
  expect(youngest).toBeLessThan(30)
  await expect(note.locator('.note__under')).toContainText('regulars')

  // The first row IS that figure, and its gap is negative — below his league.
  const first = note.locator('.note__table tbody tr').first()
  await expect(first.locator('.note__age')).toHaveText(youngest.toFixed(1))
  await expect(first.locator('.note__gap')).toContainText('−'.replace('−', '-'))

  // The floor is stated where a reader cannot miss it: a 250-PA floor at one
  // level drops the players who were promoted out of it, and a note that hid
  // that would be read as a ranking of the level's best young hitters.
  const pool = note.locator('.note__pool')
  await expect(pool).toContainText('250')
  await expect(pool).toContainText('promoted')
  await expect(pool).toHaveCSS('text-transform', 'none')
})

test('the level note opens on one league of three, and changes on request', async ({ page }) => {
  await page.goto(`/higha/1012${AGE_SEASON}`)
  const note = page.locator('.note')
  await expect(note).toBeVisible()
  // Three leagues at a level, and exactly one of them showing — no figure on
  // this page is ever computed across two (research.md §7).
  const picks = note.locator('.note__league')
  await expect(picks).toHaveCount(3)
  await expect(note.locator('.note__league.is-on')).toHaveCount(1)

  const named = await note.locator('.oseason__note').innerText()
  const other = picks.filter({ hasNot: page.locator('.is-on') }).first()
  await other.click()
  await expect(note.locator('.oseason__note')).not.toHaveText(named)
  await expect(note.locator('.note__league.is-on')).toHaveCount(1)
})

test('the season record is the one row on the page wearing kraft tape', async ({ page }) => {
  await page.goto(AT_BAT_WINTER)
  const record = page.locator('.srecord')
  await expect(record).toBeVisible()
  await expect(record.locator('.srecord__title')).toHaveText('Season record')
  // The warning is in WORDS, before the tap — never in the tape alone.
  await expect(record.locator('.srecord__note')).toContainText('Opening this shows results')
  await expect(record.locator('.srecord__tape')).toHaveAttribute('aria-hidden', 'true')

  // At MLB both doors go inward, to pages the app already has.
  const doors = record.locator('.srecord__door')
  await expect(doors).toHaveCount(2)
  await expect(doors.nth(0)).toHaveAttribute('href', '/standings')
  await expect(doors.nth(1)).toHaveAttribute('href', '/postseason-history')
  // A thumb-sized target, same floor as every other action in the app.
  expect((await doors.nth(0).boundingBox()).height).toBeGreaterThanOrEqual(44)
})

test('a minor level links its record out, and says it is leaving', async ({ page }) => {
  await page.goto(`/higha/1012${AGE_SEASON}`)
  const doors = page.locator('.srecord__door')
  await expect(doors).toHaveCount(2)
  for (const i of [0, 1]) {
    await expect(doors.nth(i)).toHaveAttribute('href', /^https:\/\/www\.milb\.com\//)
    await expect(doors.nth(i)).toHaveAttribute('target', '_blank')
    await expect(doors.nth(i)).toHaveAttribute('rel', /noopener/)
    // The arrow is decoration; the words are what a reader who cannot see it
    // is given instead.
    await expect(doors.nth(i).locator('.sr-only')).toHaveText('opens MiLB.com')
  }
})

test('the standings page a record opens onto is not empty in the winter', async ({ page }) => {
  // The door has to open onto something. Before #1078 this page defaulted to
  // "entering today" and passed that date to statsapi, which only resolves a
  // day the season actually played — so from November to February it said
  // "No standings available for this date" (ADR-0081).
  //
  // A FIXED CLOCK, because this is the one assertion in the file that cannot be
  // reached by browsing to a date: the standings page has no date in its URL and
  // reads the real one. December 10 of the season the notebook names is a day
  // inside that winter, and everything below it is the live endpoint answering
  // for a closed season.
  await page.clock.setFixedTime(new Date(`${AT_BAT_SEASON}-12-10T18:00:00Z`))
  await page.goto('/standings')
  await expect(page.locator('.standings-ctrl__mode')).toHaveText('Final')
  await expect(page.getByText('No standings available')).toHaveCount(0)
  await expect(page.locator('.standings tbody tr').first()).toBeVisible()
  // And its date controls are put away — there is nothing to scrub to when the
  // record is the record, and every one of those buttons would come back empty.
  await expect(page.locator('.standings-jumps[aria-label="Standings date"]')).toHaveCount(0)
  await expect(page.locator('.standings-daynav')).toHaveCount(0)
})

test('the winter fills the rail with the league, and the page gets shorter for it', async ({
  page,
}) => {
  await page.goto(WINTER)
  const wide = page.viewportSize().width >= 740
  const grid = page.locator('.offday')
  await expect(grid).toBeVisible()

  if (wide) {
    // Every club is idle in the winter, so this is the whole league — 986px of
    // grid that used to run down the bottom of the games column while the rail
    // beside it held a 112px countdown and nothing else. It belongs up there.
    // Measured on the section's HEADING rather than the section, which in the
    // winter is 1,800px of grid — a box that size is a slow protocol round trip
    // and was flaky under a parallel run. The heading is the section's own top
    // left corner, which is the whole claim.
    const main = await page.locator('.slatebody__main').boundingBox()
    const head = await page.locator('.offday__banner').boundingBox()
    expect(head.x).toBeGreaterThan(main.x + main.width - 2)
    // Under the countdown, not above it.
    const count = await page.locator('.springcount').boundingBox()
    expect(head.y).toBeGreaterThan(count.y)
    // And nothing left behind in the games column.
    await expect(page.locator('.slatebody__main .offday')).toHaveCount(0)
  } else {
    // No rail on a phone: the countdown is already inside the lead and the grid
    // already follows it down the one column there is. Nothing moved.
    await expect(page.locator('.winterrail')).toHaveCount(0)
    await expect(page.locator('.slatebody__main .offday')).toHaveCount(1)
  }
})

test('the winter does not call a whole finished season an off day', async ({ page }) => {
  // "Off Day" is a claim about TODAY, and in December it would be a false one
  // over all thirty clubs at once.
  await page.goto(WINTER)
  await expect(page.locator('.offday__banner')).toHaveText('Every club')
  await expect(page.locator('.offday')).toHaveAttribute('aria-label', 'Every club')

  // An ordinary in-season off day is untouched — the clubs not playing today
  // really are on an off day, and the heading has always been right there.
  await page.goto('/04062026')
  const offday = page.locator('.offday')
  if ((await offday.count()) > 0) {
    await expect(page.locator('.offday__banner')).toHaveText('Off Day')
    await expect(page.locator('.winterrail')).toHaveCount(0)
  }
})

test('the countdown names the game it counts to', async ({ page }) => {
  await page.goto(WINTER)
  // Spring training's FIRST GAME, not the day camps open — the date it counts
  // to is a schedulable game on the season row, so the label says so.
  await expect(page.locator('.springcount__label')).toHaveText('First spring training game')
})
