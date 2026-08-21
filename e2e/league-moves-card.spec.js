import { test, expect } from './fixtures.js'
import { installMockApi, ANCHOR_DATE } from './fixtures/mock-api.js'

// The home slate's 48-hour roster-move card (issue #772). Two things here the
// unit suite structurally cannot see, which is the whole reason this exists:
//
//  1. **The fit.** The card measures the space it has and ends on a WHOLE row,
//     so the door lands at the fold and the first game card still shows. Rows
//     are not a fixed height, so that is a measurement of rendered boxes —
//     there is nothing to assert on without a browser. It regressed once
//     already in a way every unit test passed through: the measurement ran
//     against the list the trim had already shortened, so the count could only
//     ratchet DOWN from its starting value. A 1180px-tall iPad measured itself
//     868px of room and then used 427px of it. The last two cases below are
//     that bug's guard.
//  2. **Where it may appear.** Today's MLB slate only — a browsed-to July day
//     and a Triple-A slate must not show it at all.
//
// The wire is stubbed rather than read live, for a reason worth stating: the
// card shows today and yesterday, so a captured response would be one day
// stale on the day after it was taken and empty every winter. The rows below
// are real shapes from a real pull (typeCode CU, 2026-08-19) with the ids,
// names and dates rewritten per run, so the spec exercises the real pipeline
// on a wire that is always in the window.

// Mirrors LeagueMovesCard.jsx. A spec that pinned an exact row count would
// fail on any future type-scale change; these are the bounds the card promises.
const MIN_ROWS = 3
const MAX_ROWS = 8

// Real clubs, real names — the cutline is parsed out of the wire's own
// sentence, so the names have to be the ones the wire actually writes.
const CLUBS = [
  [108, 'Los Angeles Angels'], [109, 'Arizona Diamondbacks'], [110, 'Baltimore Orioles'],
  [111, 'Boston Red Sox'], [112, 'Chicago Cubs'], [113, 'Cincinnati Reds'],
  [114, 'Cleveland Guardians'], [115, 'Colorado Rockies'], [116, 'Detroit Tigers'],
  [117, 'Houston Astros'], [118, 'Kansas City Royals'], [119, 'Los Angeles Dodgers'],
  [120, 'Washington Nationals'], [121, 'New York Mets'], [133, 'Athletics'],
  [134, 'Pittsburgh Pirates'],
]
const POSITIONS = ['RHP', 'LHP', 'C', '1B', 'SS', 'CF']

// A day back from an ISO date, by the same manual y/m/d parse the app uses —
// a raw Date subtraction can drift across a DST edge.
function dayBefore(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d - 1)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// One recall per club per day: the wire's own CU shape, which owns cleanly
// (the sending club is a farm club naming no other major-league org) and so
// becomes one story per club rather than one grouped shuffle.
function wireFor(dates) {
  const rows = []
  for (const [dayIndex, date] of dates.entries()) {
    for (const [clubIndex, [id, name]] of CLUBS.entries()) {
      const personId = 900_000 + dayIndex * 100 + clubIndex
      const pos = POSITIONS[clubIndex % POSITIONS.length]
      const player = `Test Player${personId}`
      rows.push({
        id: 900_000 + rows.length,
        person: { id: personId, fullName: player },
        fromTeam: { id: 8000 + clubIndex, name: `${name} Affiliate` },
        toTeam: { id, name },
        date,
        effectiveDate: date,
        typeCode: 'CU',
        typeDesc: 'Recalled',
        description: `${name} recalled ${pos} ${player} from ${name} Affiliate.`,
      })
    }
  }
  return rows
}

function peopleFor(ids) {
  return ids.map((id) => ({
    id: Number(id),
    primaryPosition: { abbreviation: POSITIONS[Number(id) % POSITIONS.length] },
    mlbDebutDate: '2024-04-01',
  }))
}

// Registered AFTER installMockApi so these win — Playwright runs the most
// recently added matching handler first.
async function stubWire(page) {
  await page.route('**/api/v1/transactions*', async (route) => {
    const end = new URL(route.request().url()).searchParams.get('endDate')
    await route.fulfill({ json: { transactions: wireFor([end, dayBefore(end)]) } })
  })
  await page.route('**/api/v1/people*', async (route) => {
    const ids = (new URL(route.request().url()).searchParams.get('personIds') ?? '').split(',')
    await route.fulfill({ json: { people: peopleFor(ids.filter(Boolean)) } })
  })
}

// The card's rows, plus the boxes the fit is a claim about.
async function readCard(page) {
  return await page.evaluate(() => {
    const card = document.querySelector('.wirecard')
    if (!card) return null
    const list = card.querySelector('.wirecard__list')
    const rows = [...list.querySelectorAll('.wire__row')]
    const listBottom = list.getBoundingClientRect().bottom
    const last = rows[rows.length - 1]?.getBoundingClientRect()
    const door = card.querySelector('.wirecard__door')
    return {
      rows: rows.length,
      // A partial row is the failure this is here to catch: the list clips at
      // overflow:hidden, so a row past the budget is drawn cut in half.
      lastRowOverhang: last ? Math.round(last.bottom - listBottom) : null,
      doorBottom: door ? Math.round(door.getBoundingClientRect().bottom) : null,
      viewportH: window.innerHeight,
      pageOverflowsSideways:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })
}

async function openSlate(page, path = '/') {
  await installMockApi(page)
  await stubWire(page)
  await page.goto(path)
}

test("today's slate shows the card, and every row on it is whole", async ({ page }) => {
  // WIDE. Below WIDE_QUERY (740px) this same feed renders as the bottom dock
  // instead — e2e/wire-dock.spec.js owns that half. The split is the point:
  // in the flow the card sits above the game list, which is most of a phone's
  // first screen spent on other clubs' paperwork.
  await page.setViewportSize({ width: 900, height: 844 })
  await openSlate(page)
  await expect(page.locator('.wirecard')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Around the league' })).toBeVisible()

  const card = await readCard(page)
  expect(card.rows).toBeGreaterThanOrEqual(MIN_ROWS)
  expect(card.rows).toBeLessThanOrEqual(MAX_ROWS)
  // Ends on a whole row...
  expect(card.lastRowOverhang).toBeLessThanOrEqual(0)
  // ...and leaves the fold to the slate, which is what the reader came for.
  expect(card.doorBottom).toBeLessThan(card.viewportH)
  expect(card.pageOverflowsSideways).toBe(false)

  // Every row names its club, because the cutline never does (stripLeadingClub
  // takes it out for a surface that already answered).
  const firstRow = page.locator('.wire__row').first()
  await expect(firstRow.locator('.wire__club')).toBeVisible()
  await expect(firstRow.locator('.wire__cutline')).not.toBeEmpty()
})

test('the door opens onto the rest of the moves', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 844 })
  await openSlate(page)
  const door = page.locator('.wirecard__door')
  await expect(door).toBeVisible()

  const collapsed = await page.locator('.wire__row').count()
  const total = Number((await door.textContent()).match(/\d+/)[0])
  expect(total).toBeGreaterThan(collapsed)

  await door.click()
  await expect(page.locator('.wire__row')).toHaveCount(total)
  await expect(door).toHaveText(/Show fewer moves/)
})

test('a browsed-to past day does not claim the last 48 hours', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const [y, m, d] = ANCHOR_DATE.split('-')
  await openSlate(page, `/${m}${d}${y}`)
  await expect(page.locator('.gamecard').first()).toBeVisible()
  await expect(page.locator('.wirecard')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveCount(0)
})

test('a Triple-A slate does not show a major-league wire', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSlate(page, '/aaa')
  await expect(page.locator('.datenav')).toBeVisible()
  await expect(page.locator('.wirecard')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveCount(0)
})

// The two guards for the ratchet-down bug. The fit has to be able to GROW,
// not only shrink — measured against the full candidate list rather than
// against the list the trim already shortened.
test('a taller window fits more rows than a short one', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 620 })
  await openSlate(page)
  await expect(page.locator('.wirecard')).toBeVisible()
  const short = await readCard(page)

  await page.setViewportSize({ width: 900, height: 1400 })
  await expect(page.locator('.wire__row')).not.toHaveCount(short.rows)
  const tall = await readCard(page)

  expect(tall.rows).toBeGreaterThan(short.rows)
  expect(tall.lastRowOverhang).toBeLessThanOrEqual(0)
  expect(short.lastRowOverhang).toBeLessThanOrEqual(0)
})

test('a window that grows again gives the rows back', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 1400 })
  await openSlate(page)
  await expect(page.locator('.wirecard')).toBeVisible()
  const before = await page.locator('.wire__row').count()

  await page.setViewportSize({ width: 900, height: 620 })
  await expect(page.locator('.wire__row')).not.toHaveCount(before)

  await page.setViewportSize({ width: 900, height: 1400 })
  await expect(page.locator('.wire__row')).toHaveCount(before)
})
