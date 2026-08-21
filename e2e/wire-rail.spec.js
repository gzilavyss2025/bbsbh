import { test, expect } from './fixtures.js'
import { installMockApi, ANCHOR_DATE } from './fixtures/mock-api.js'

// The home slate's 48-hour roster wire on the WIDE surface — the rail down the
// right of the games (WireRail.jsx, issue #772). Below WIDE_QUERY the same feed
// is the bottom-anchored dock instead; e2e/wire-dock.spec.js owns that half.
//
// This file replaced a spec about LeagueMovesCard, the in-flow card the rail
// supersedes, and the swap is worth recording because what is worth testing
// changed completely with it. That card measured the space above the game list
// and trimmed itself to end on a whole row, so the old spec was almost entirely
// about that measurement: whether the fit could grow again after a resize,
// whether the last row was drawn cut in half, whether the door cleared the
// fold. None of it survives, because none of the mechanism does — a rail that
// scrolls has no fold to end at, so there is no fit, no trim and no door.
//
// What IS worth a browser now is the claim the rail actually makes, and it is
// a claim about LAYOUT, which the unit suite structurally cannot see:
//
//  1. **The games get the fold.** The wire stopped taking vertical space. The
//     first game card must start level with the rail rather than below it —
//     this is the whole point of the change, and it is the one thing a
//     regression would silently undo (put the rail back in the flow and every
//     assertion about its contents still passes).
//  2. **Nothing is hidden.** The card showed 7 of 10 behind a door. The rail
//     shows every story it was given.
//  3. **The games and the rail trade width.** Two columns where there is room
//     for two, one where the rail leaves too little — the auto-fit rule in
//     25-wide-layout.css, which is a computed-style fact, not a source fact.
//  4. **The shell widens ONLY for a real rail.** The slate is the only screen
//     in the app that goes past 960px, and only when a rail is there to fill
//     the extra. A past day, a Triple-A slate and a quiet 48 hours must all
//     leave it at 960 — the last of those being the case GameSelect reserves
//     the width for up front and gives back, so it is the one that can regress
//     into 288px of empty margin.
//
// The wire is stubbed rather than read live, for a reason worth stating: the
// feed shows today and yesterday, so a captured response would be one day stale
// on the day after it was taken and empty every winter. The rows below are real
// shapes from a real pull (typeCode CU, 2026-08-19) with the ids, names and
// dates rewritten per run, so the spec exercises the real pipeline on a wire
// that is always in the window.

// Mirrors 25-wide-layout.css. A spec that pinned pixel widths would fail on any
// future type-scale change; these are the numbers the layout actually promises.
const SHELL_PLAIN = 960 // .screen's global cap — every other page in the app
const SHELL_RAILED = 1272 // .screen--slate.screen--wirerail: 928 + 24 + 288
const RAIL_W = 288
// Wide enough for two cards beside the rail, and narrow enough for one. The
// switch sits near 1090; these clear it in both directions without pinning it.
const TWO_COL_W = 1280
const ONE_COL_W = 1000
// The rail is aligned to the game grid's own top margin, so "level" is exact on
// a plain slate. This absorbs the rows the games column may legitimately grow
// above the grid (a filter bar, a break banner) without absorbing a regression.
const LEVEL_SLOP = 48

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
// becomes one story per club rather than one grouped shuffle. Two days of
// sixteen clubs is 32 stories — comfortably more than the old card's eight-row
// ceiling, which is what makes "nothing is hidden" a real assertion.
const STORIES_PER_DAY = CLUBS.length
const TOTAL_STORIES = STORIES_PER_DAY * 2

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
// recently added matching handler first. `rows` lets one test hand back an
// empty wire without a second helper.
async function stubWire(page, rows = null) {
  await page.route('**/api/v1/transactions*', async (route) => {
    const end = new URL(route.request().url()).searchParams.get('endDate')
    await route.fulfill({ json: { transactions: rows ?? wireFor([end, dayBefore(end)]) } })
  })
  await page.route('**/api/v1/people*', async (route) => {
    const ids = (new URL(route.request().url()).searchParams.get('personIds') ?? '').split(',')
    await route.fulfill({ json: { people: peopleFor(ids.filter(Boolean)) } })
  })
}

// The boxes the layout is a claim about. Read together in one pass so the
// numbers describe the same frame.
async function readSlate(page) {
  return await page.evaluate(() => {
    const screen = document.querySelector('.screen--slate')
    const rail = document.querySelector('.wirerail')
    const grid = document.querySelector('.gamelist')
    const card = document.querySelector('.gamecard, .gamecardstack')
    const box = (el) => (el ? el.getBoundingClientRect() : null)
    const railBox = box(rail)
    const cardBox = box(card)
    return {
      shellW: Math.round(box(screen).width),
      hasRail: !!rail,
      railW: railBox ? Math.round(railBox.width) : null,
      railTop: railBox ? Math.round(railBox.top) : null,
      firstCardTop: cardBox ? Math.round(cardBox.top) : null,
      // The auto-fit rule resolves to a track list; its length is the column
      // count actually in force, which is the only honest way to read it.
      columns: grid
        ? getComputedStyle(grid).gridTemplateColumns.split(' ').filter(Boolean).length
        : 0,
      viewportH: window.innerHeight,
      // A rail is added width, so a shell that forgot to widen shows up here
      // rather than as a subtle overlap.
      overflowsSideways:
        document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }
  })
}

async function openSlate(page, path = '/', rows = null) {
  await installMockApi(page)
  await stubWire(page, rows)
  await page.goto(path)
}

test('the wire runs beside the games, not above them', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Around the league' })).toBeVisible()

  const slate = await readSlate(page)
  // THE POINT OF THE WHOLE CHANGE: the first game card starts level with the
  // rail. The card this replaced ran 658px before the games began, which put
  // every one of them below the fold.
  //
  // A tolerance rather than equality, because the games column can legitimately
  // grow a row above the grid — a filter bar, an All-Star break banner — and
  // the rail does not follow it down. LEVEL is the claim; the failure this
  // guards against is the rail going back into the flow, which shows up here as
  // hundreds of pixels, not tens.
  expect(Math.abs(slate.firstCardTop - slate.railTop)).toBeLessThanOrEqual(LEVEL_SLOP)
  expect(slate.firstCardTop).toBeLessThan(slate.viewportH / 2)
  expect(slate.overflowsSideways).toBe(false)

  // The rail took its width from the margin, so the shell is wider and the
  // game grid keeps the two columns it had.
  expect(slate.shellW).toBe(SHELL_RAILED)
  expect(slate.railW).toBe(RAIL_W)
  expect(slate.columns).toBe(2)

  // Every row still names its club, because the cutline never does
  // (stripLeadingClub takes it out for a surface that already answered).
  const firstRow = page.locator('.wire__row').first()
  await expect(firstRow.locator('.wire__club')).toBeVisible()
  await expect(firstRow.locator('.wire__cutline')).not.toBeEmpty()
})

test('every move is on the rail — there is no door and nothing is trimmed', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail')).toBeVisible()

  await expect(page.locator('.wire__row')).toHaveCount(TOTAL_STORIES)
  // The count in the rail's own head agrees with what it drew.
  await expect(page.locator('.wirerail__note')).toContainText(String(TOTAL_STORIES))
  // The card's door and its expanded state are gone, not merely hidden.
  await expect(page.locator('.wirecard__door')).toHaveCount(0)
  await expect(page.locator('.wirecard')).toHaveCount(0)

  // A rail taller than the window scrolls inside itself rather than pushing
  // the slate down — which is what lets it hold a busy day.
  const scrolls = await page.evaluate(() => {
    const rail = document.querySelector('.wirerail')
    return rail.scrollHeight > rail.clientHeight
  })
  expect(scrolls).toBe(true)
})

test('the games drop to one column when the rail leaves room for one', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail')).toBeVisible()
  expect((await readSlate(page)).columns).toBe(2)

  // Narrower, the rail keeps its width and the grid gives way instead — no
  // second breakpoint decides this, `repeat(auto-fit, minmax(360px, 1fr))`
  // does. The rail must NOT shrink and the page must NOT overflow.
  await page.setViewportSize({ width: ONE_COL_W, height: 900 })
  await expect(page.locator('.wirerail')).toBeVisible()
  const narrow = await readSlate(page)
  expect(narrow.columns).toBe(1)
  expect(narrow.railW).toBe(RAIL_W)
  expect(Math.abs(narrow.firstCardTop - narrow.railTop)).toBeLessThanOrEqual(LEVEL_SLOP)
  expect(narrow.overflowsSideways).toBe(false)
})

test('a quiet 48 hours gives the reserved width back', async ({ page }) => {
  // GameSelect reserves the wider shell up front, before the wire has answered,
  // so the grid cannot slide sideways a beat after first paint. WireRail is
  // what reports the room is not needed — without that, an empty wire leaves
  // 288px of margin holding nothing.
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page, '/', [])
  await expect(page.locator('.gamecard').first()).toBeVisible()
  await expect(page.locator('.wirerail')).toHaveCount(0)

  await expect
    .poll(async () => (await readSlate(page)).shellW)
    .toBe(SHELL_PLAIN)
  expect((await readSlate(page)).columns).toBe(2)
})

test('a browsed-to past day does not claim the last 48 hours', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  const [y, m, d] = ANCHOR_DATE.split('-')
  await openSlate(page, `/${m}${d}${y}`)
  await expect(page.locator('.gamecard').first()).toBeVisible()
  await expect(page.locator('.wirerail')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveCount(0)
  expect((await readSlate(page)).shellW).toBe(SHELL_PLAIN)
})

test('a Triple-A slate does not show a major-league wire', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page, '/aaa')
  await expect(page.locator('.datenav')).toBeVisible()
  await expect(page.locator('.wirerail')).toHaveCount(0)
  await expect(page.locator('.wiredock')).toHaveCount(0)
  expect((await readSlate(page)).shellW).toBe(SHELL_PLAIN)
})

test('a phone gets the dock, never the rail', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openSlate(page)
  await expect(page.locator('.wiredock')).toBeVisible()
  await expect(page.locator('.wirerail')).toHaveCount(0)
})
