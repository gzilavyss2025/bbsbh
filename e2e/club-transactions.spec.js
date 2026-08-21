import { test, expect } from './fixtures.js'

// The club's roster-move ledger (`/team/{id}/transactions`,
// screens/team/TeamTransactionsPage.jsx) and the day tab the deck grew to match
// it. Both are LAYOUT claims, which is why they are here rather than in the
// unit suite: the data layer emits the same stories either way.
//
// Three things a browser is the only witness to:
//
//  1. **The day is said once.** A deck used to head EVERY card with its own
//     date, restating the previous card's date on 29.7% of them and marking a
//     day boundary nowhere. Now one tab stands before each day's run, and the
//     card carries no dateline at all. That the two never both appear, and that
//     a tab's count matches the cards actually behind it, is a fact about
//     rendered siblings.
//  2. **The card changes layout with the measure.** On the page, wide, the
//     photo rail is a real second column; narrow, it goes back to the deck's
//     float. Neither is visible to anything below the DOM, and the float is the
//     one that can escape its card (see transaction-rail.spec.js).
//  3. **The wire lands here.** Every club chip on the home slate's wire points
//     at this page — the whole reason it exists — and a chip that quietly went
//     back to the Games tab would still pass every content assertion.
//
// Data-driven rather than pinned to a club and a date: the file behind it is
// regenerated nightly, and a live three-day window is laid over it (ADR-0064),
// so any hardcoded day ages out.

// Mirrors TeamTransactionsPage.jsx's INITIAL_DAYS.
const INITIAL_DAYS = 10

// A club with roster moves on file this season. Reads the same sharded dataset
// the app reads — `{season}/index.json` names the clubs, then one file each.
async function findClubWithMoves(page) {
  return await page.evaluate(async () => {
    const season = new Date().getUTCFullYear()
    const index = await fetch(`/data/team-transactions/${season}/index.json`)
    if (!index.ok) return null
    const { teamIds = [] } = await index.json()
    for (const teamId of teamIds) {
      const res = await fetch(`/data/team-transactions/${season}/${teamId}.json`)
      if (!res.ok) continue
      const { days = [] } = await res.json()
      if (days.length >= 2) return { teamId, days: days.length }
    }
    return null
  })
}

test('the club ledger says each day once, over the cards that belong to it', async ({ page }) => {
  await page.goto('/')
  const club = await findClubWithMoves(page)
  test.skip(!club, 'no team-transactions data file for the current season')

  await page.goto(`/team/${club.teamId}/transactions`)
  await page.waitForSelector('.txpage__day', { timeout: 90_000 })

  const sections = await page.locator('.txpage__day').count()
  expect(sections).toBeGreaterThan(0)
  expect(sections).toBeLessThanOrEqual(INITIAL_DAYS)

  // Every heading names its day once and counts the cards under it.
  const days = await page.evaluate(() =>
    [...document.querySelectorAll('.txpage__day')].map((section) => ({
      dateline: section.querySelector('.txpage__dateline span')?.textContent?.trim() ?? '',
      claimed: Number(section.querySelector('.txpage__count')?.textContent ?? -1),
      cards: section.querySelectorAll('.txstory').length,
    })),
  )
  const seen = new Set()
  for (const day of days) {
    expect(day.dateline, 'a day section with no dateline').not.toBe('')
    expect(seen.has(day.dateline), `${day.dateline} is headed twice`).toBe(false)
    seen.add(day.dateline)
    expect(day.claimed, `${day.dateline} counts ${day.claimed} but shows ${day.cards}`).toBe(day.cards)
  }

  // The card's own dateline is gone — the heading is the only one.
  expect(await page.locator('.txstory__date').count()).toBe(0)
})

test('the ledger card is two columns wide and a float narrow', async ({ page }) => {
  await page.goto('/')
  const club = await findClubWithMoves(page)
  test.skip(!club, 'no team-transactions data file for the current season')

  // Wide: the rail is a grid cell beside the words, so it starts to the RIGHT
  // of where the cutline ends rather than being wrapped around.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto(`/team/${club.teamId}/transactions`)
  await page.waitForSelector('.txpage__stories .txstory', { timeout: 90_000 })
  const wide = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.txpage__stories .txstory')].find((c) =>
      c.querySelector('.photorail'),
    )
    if (!card) return null
    const rail = card.querySelector('.photorail')
    const text = card.querySelector('.txstory__cutline')
    return {
      floated: getComputedStyle(rail).float,
      railLeft: Math.round(rail.getBoundingClientRect().left),
      textRight: Math.round(text.getBoundingClientRect().right),
      cardRight: Math.round(card.getBoundingClientRect().right),
    }
  })
  test.skip(!wide, 'no card with a photo rail on the first page')
  expect(wide.floated).toBe('none')
  expect(wide.railLeft, 'the rail overlaps the sentence beside it').toBeGreaterThanOrEqual(
    wide.textRight,
  )
  expect(wide.railLeft, 'the rail escapes the card').toBeLessThan(wide.cardRight)

  // Narrow: back to the deck's float, which is what reads correctly at a phone's
  // measure — a second column there leaves the sentence wrapping every three
  // words.
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  const narrow = await page.evaluate(() => {
    const rail = document.querySelector('.txpage__stories .photorail')
    return rail ? getComputedStyle(rail).float : null
  })
  expect(narrow).toBe('right')
})

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
