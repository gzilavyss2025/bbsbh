import { test, expect } from './fixtures.js'
import { installMockApi, ANCHOR_DATE } from './fixtures/mock-api.js'
import { VIEWPORT_MARGIN } from '../src/lib/playerHoverPosition.js'

// The home slate's league roster wire on the WIDE surface — the rail down the
// right of the games (WireRail.jsx, issue #772). Below WIDE_QUERY the same feed
// is the bottom-anchored dock instead; e2e/wire-dock.spec.js owns that half.
//
// This file replaced a spec about LeagueMovesCard, the in-flow card the rail
// supersedes, and the swap is worth recording because what is worth testing
// changed completely with it. That card measured the space above the game list
// and trimmed itself to end on a whole row, so the old spec was almost entirely
// about that measurement, and against the VIEWPORT: whether the fit could grow
// again after a resize, whether the last row was drawn cut in half, whether the
// door cleared the fold. The rail fits itself too, but to the GAMES COLUMN
// beside it rather than to the window — a different budget, changing for
// different reasons, so every case below is rewritten around it.
//
// What IS worth a browser now is the claim the rail actually makes, and it is
// a claim about LAYOUT, which the unit suite structurally cannot see:
//
//  1. **The games get the fold.** The wire stopped taking vertical space. The
//     first game card must start level with the rail rather than below it —
//     this is the whole point of the change, and it is the one thing a
//     regression would silently undo (put the rail back in the flow and every
//     assertion about its contents still passes).
//  2. **The fit.** The window is three days and runs 41 to 65 stories — far
//     more rail than the games beside it. So the rail ends where the games end:
//     it measures the column and keeps the last WHOLE row that clears it, with
//     the rest behind one control. Rows are not a fixed height (a cutline runs
//     one line to three), so that is a measurement of rendered boxes; there is
//     nothing to assert on without a browser. The bug it guards is the one the
//     card this replaced actually shipped: measuring the ALREADY-TRIMMED list,
//     so the count could only ratchet DOWN and never recover.
//  3. **The games and the rail trade width.** Two columns where there is room
//     for two, one where the rail leaves too little — the auto-fit rule in
//     25-wide-layout.css, which is a computed-style fact, not a source fact.
//  4. **The shell widens ONLY for a real rail.** The slate is the only screen
//     in the app that goes past 960px, and only when a rail is there to fill
//     the extra. A past day, a Triple-A slate and a quiet 48 hours must all
//     leave it at 960 — the last of those being the case GameSelect reserves
//     the width for up front and gives back, so it is the one that can regress
//     into 288px of empty margin.
//  5. **The wheel belongs to the slate.** With the cursor over the rail, a
//     wheel still moves the games. That is a fact about how a real wheel event
//     routes between scrollers, so it needs a real wheel; nothing below the DOM
//     can see it.
//
// The wire is stubbed rather than read live, for a reason worth stating: the
// feed is a rolling three days, so a captured response would be a day stale the
// day after it was taken and empty every winter. The rows below are real
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
// Mirrors WireRail's own floor: beside a very short games column the rail holds
// its ground rather than shrinking to a stub.
const MIN_ROWS = 4

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
// becomes one story per club rather than one grouped shuffle. THREE days,
// matching WINDOW_DAYS — 48 stories, comfortably more rail than the games
// column can hold, which is what makes the fit a real assertion rather than a
// test of a list that happened to fit anyway.
const WINDOW_DAYS = 3
const STORIES_PER_DAY = CLUBS.length
const TOTAL_STORIES = STORIES_PER_DAY * WINDOW_DAYS

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
    const days = [end]
    while (days.length < WINDOW_DAYS) days.push(dayBefore(days[days.length - 1]))
    await route.fulfill({ json: { transactions: rows ?? wireFor(days) } })
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

// The boxes the FIT is a claim about, read in one pass so they describe the
// same frame.
async function readFit(page) {
  return await page.evaluate(() => {
    const rail = document.querySelector('.wirerail')
    const main = document.querySelector('.slatebody__main')
    const list = document.querySelector('.wirerail__list')
    const rows = [...document.querySelectorAll('.wirerail__list .wire__row')]
    const last = rows[rows.length - 1]?.getBoundingClientRect()
    const listBox = list?.getBoundingClientRect()
    return {
      rowsShown: rows.length,
      mainH: main ? Math.round(main.getBoundingClientRect().height) : null,
      // <= 0 means the rail's foot is at or above the games column's, which is
      // the whole promise: the wire fills the page, it never lengthens it.
      railBottomVsMain:
        rail && main
          ? Math.round(rail.getBoundingClientRect().bottom - main.getBoundingClientRect().bottom)
          : null,
      // > 0 is a row drawn past the clamp — painted cut in half, since the list
      // clips at overflow: hidden.
      lastRowOverhang: last && listBox ? Math.round(last.bottom - listBox.bottom) : null,
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
  await expect(page.getByRole('heading', { name: 'Transactions' })).toBeVisible()

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

test('the head is the one word', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail')).toBeVisible()
  // No window and no count beside it: every dateline in the list already spells
  // out its day and carries that day's count, so a second tally up top restated
  // the ledger to itself.
  await expect(page.locator('.wirerail__head')).toHaveText(/^transactions$/i)
  // The in-flow card the rail replaced is gone, not merely hidden.
  await expect(page.locator('.wirecard')).toHaveCount(0)
})

test('the rail ends where the games end, on a whole row', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail')).toBeVisible()
  await expect(page.locator('.wirerail__door')).toBeVisible()

  const fit = await readFit(page)
  // The wire may FILL the page and must never LENGTHEN it: the rail's foot
  // lands at or above the games column's, so the slate is exactly as long as
  // the games make it.
  expect(fit.railBottomVsMain).toBeLessThanOrEqual(0)
  // Every drawn row is whole. The list clips at overflow:hidden, so a row past
  // the budget is painted cut in half — which is the visible failure.
  expect(fit.lastRowOverhang).toBeLessThanOrEqual(0)
  // Trimmed, but not to a stub, and not to everything.
  expect(fit.rowsShown).toBeGreaterThanOrEqual(MIN_ROWS)
  expect(fit.rowsShown).toBeLessThan(TOTAL_STORIES)
})

test('the more control opens onto the rest of the window, and closes again', async ({ page }) => {
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  const door = page.locator('.wirerail__door')
  await expect(door).toBeVisible()

  const collapsed = await readFit(page)
  const hidden = Number((await door.textContent()).match(/\d+/)[0])
  expect(collapsed.rowsShown + hidden).toBe(TOTAL_STORIES)

  await door.click()
  await expect(page.locator('.wirerail__list .wire__row')).toHaveCount(TOTAL_STORIES)
  await expect(door).toHaveText(/show fewer/i)

  // Closing must return to the SAME fit. This is the ratchet guard: the
  // measurement runs against the full list, so re-collapsing cannot land on a
  // smaller count than it did the first time. The card this replaced got this
  // wrong and shrank a little further on every cycle.
  await door.click()
  await expect(page.locator('.wirerail__list .wire__row')).toHaveCount(collapsed.rowsShown)
  const reclosed = await readFit(page)
  expect(reclosed.rowsShown).toBe(collapsed.rowsShown)
  expect(reclosed.lastRowOverhang).toBeLessThanOrEqual(0)
})

test('a taller games column earns the rail more rows', async ({ page }) => {
  // The fit tracks the column, not the viewport — so the same window at the
  // same window height fits MORE moves when the games run to one column and
  // twice the height. The other half of the ratchet guard: the count has to be
  // able to grow, not only shrink.
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail__door')).toBeVisible()
  const twoUp = await readFit(page)

  await page.setViewportSize({ width: ONE_COL_W, height: 900 })
  await expect.poll(async () => (await readFit(page)).mainH).toBeGreaterThan(twoUp.mainH)
  const oneUp = await readFit(page)

  expect(oneUp.rowsShown).toBeGreaterThan(twoUp.rowsShown)
  expect(oneUp.railBottomVsMain).toBeLessThanOrEqual(0)
  expect(oneUp.lastRowOverhang).toBeLessThanOrEqual(0)
})

test('the wheel scrolls the slate even with the cursor over the rail', async ({ page }) => {
  // The rail used to be its own scroller — capped to the viewport, sticky, and
  // `overscroll-behavior: contain`. A wheel with the cursor over it then moved
  // the rail and not the games, and on a light wire it moved nothing at all:
  // the rail sat a hair over its cap, so it owned the gesture to travel two
  // pixels and `contain` swallowed the rest.
  //
  // A browser test, because the failure is entirely in how a real wheel event
  // is routed between two scrollers. Nothing below the DOM can see it.
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail')).toBeVisible()

  const rail = page.locator('.wirerail')
  const box = await rail.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + Math.min(200, box.height / 2))
  await page.mouse.wheel(0, 600)
  await expect.poll(async () => page.evaluate(() => Math.round(window.scrollY))).toBeGreaterThan(0)

  // And the rail is not quietly holding a scroll position of its own — there is
  // exactly one scroller on this page, which is what makes the gesture
  // unambiguous rather than merely working today.
  const railScroll = await page.evaluate(() => {
    const el = document.querySelector('.wirerail')
    return { top: el.scrollTop, overflowing: el.scrollHeight > el.clientHeight + 1 }
  })
  expect(railScroll.overflowing).toBe(false)
  expect(railScroll.top).toBe(0)
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

test('a browsed-to past day keeps the rail, narrowed to that one day', async ({ page }) => {
  // The wire used to disappear entirely off today's slate — a rolling "last
  // 3 days" is a claim about NOW, which is wrong on a page for a past date.
  // It stays now, but `singleDay` narrows the window to exactly the date on
  // screen rather than a window that would run past it.
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  const [y, m, d] = ANCHOR_DATE.split('-')
  await openSlate(page, `/${m}${d}${y}`)
  await expect(page.locator('.gamecard').first()).toBeVisible()
  const rail = page.locator('.wirerail')
  await expect(rail).toBeVisible()
  await expect(rail).not.toHaveAttribute('aria-label', /last \d+ days/i)
  // Exactly one dateline in the list — the fixture's other WINDOW_DAYS-1 days
  // of rows are still in the response, and must be trimmed rather than shown.
  await expect(page.locator('.wirerail__list .wire__date')).toHaveCount(1)
  expect((await readSlate(page)).shellW).toBe(SHELL_RAILED)
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

test('hovering a player name opens the card at the name, not the corner', async ({ page }) => {
  // .wire__cutline .plink is display:contents (04-site-bar.css) so a long
  // name wraps mid-sentence like the prose around it — a fix that predates
  // the hover card and left the trigger <button> with no box of its own.
  // PlayerLink's hover handler used to read that box straight off the
  // button; getBoundingClientRect() on a display:contents element is always
  // all-zero, and playerHoverCardPosition (playerHoverPosition.js) clamps a
  // zero rect to (VIEWPORT_MARGIN, VIEWPORT_MARGIN) — the card landed in the
  // page's top-left corner regardless of which name was hovered.
  await page.setViewportSize({ width: TWO_COL_W, height: 900 })
  await openSlate(page)
  await expect(page.locator('.wirerail')).toBeVisible()

  // The card is gated on a real mouse (HOVER_CARD_QUERY, useMediaQuery.js) —
  // a wide-but-touch project (ipad) would otherwise wait out the full
  // timeout for a card that correctly never opens.
  const hoverCapable = await page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches)
  test.skip(!hoverCapable, 'no real mouse on this project — desktop covers this test')

  // The hover card's own three requests (bio, transactions, one season stat
  // line — api/playerHoverCard.js), stubbed for the wire's first name
  // (personId 900000, day 0 / club 0's recall) so it resolves real data and
  // stays open. Left unstubbed, fetchPerson's 404 on this fake id resolves
  // to `null` and the card unmounts before an assertion can run.
  await page.route('**/api/v1/transactions*', async (route) => {
    const url = new URL(route.request().url())
    if (!url.searchParams.get('playerId')) return route.fallback()
    await route.fulfill({ json: { transactions: [] } })
  })
  await page.route('**/api/v1/people/900000*', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/stats')) {
      await route.fulfill({
        json: {
          stats: [{
            splits: [{
              stat: {
                era: '3.50', whip: '1.10', wins: 5, losses: 3,
                strikeOuts: 60, saves: 0, gamesPitched: 12, gamesStarted: 12,
              },
            }],
          }],
        },
      })
      return
    }
    await route.fulfill({
      json: {
        people: [{
          id: 900_000,
          fullName: 'Test Player900000',
          primaryPosition: { abbreviation: 'RHP', type: 'Pitcher', code: '1' },
          currentTeam: { id: 108, name: 'Los Angeles Angels', sport: { id: 1 } },
          mlbDebutDate: '2024-04-01',
          rosterEntries: [],
        }],
      },
    })
  })

  const row = page.locator('.wire__row', { hasText: 'Test Player900000' })
  const rowBox = await row.boundingBox()
  // `force: true`: Playwright's own actionability check can't find a
  // hoverable point on a display:contents element either (same box-less
  // quirk this test exists to guard), so it never resolves without this —
  // a real mouse has no such trouble, since the rendered TEXT still occupies
  // real pixels; only the wrapping <button>'s own box is gone.
  await row.locator('.wire__namelink').hover({ force: true })

  const card = page.locator('#player-hover-card')
  await expect(card).toBeVisible()
  const cardBox = await card.boundingBox()

  // Anchored near the row that was hovered...
  expect(Math.abs(cardBox.y - rowBox.y)).toBeLessThan(300)
  // ...not clamped to the page's top-left corner, which sits far above any
  // wire row on a full 900px-tall slate.
  expect(cardBox.y).toBeGreaterThan(VIEWPORT_MARGIN + 100)
})
