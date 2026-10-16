import { test, expect } from './fixtures.js'

// The two money pages, driven the way a reader drives them: `/salaries` (the
// thirty-club board) and a club's Money band, `/team/{id}#money` (one club's book). Four things
// are checked here, and only the third is about the spoiler rule.
//
//   1. THE TWO FILTERS COMPOSE. The club rail and the position chips narrow the
//      SAME board and are independent of each other, so a club picked while a
//      position is held has to keep both cuts. That is easy to regress into
//      "the last one clicked wins" and impossible to see in a unit test, since
//      both cuts run through the same pure selector and only the component
//      wiring can get it wrong.
//   2. THE EMPTY STATE IS REAL. A club with nobody at a position must say so
//      rather than render a bare masthead over nothing. The pair is DERIVED
//      from the published file rather than hardcoded — these files regenerate
//      nightly, and a spec pinned to "the Brewers have no two-way player"
//      becomes a false alarm the day they sign one.
//   3. NEITHER PAGE PRINTS A SCORE. Both are deliberately unsealed (ADR-0052,
//      on ADR-0034's reasoning: a salary is season-long identity context, not a
//      result). That decision is only safe while it stays true that nothing on
//      these pages comes from a game, so it is asserted rather than assumed.
//   4. THE MONEY BAND SAYS IT IS UNDATED. A contract ledger is a season's book,
//      not a day's, so the band opts out of the cutoff and prints a note saying
//      so, while the page's date banner stays for the bands that do move.
//
// The scope of check 3 is narrow on purpose, and the exclusions are the
// interesting part — each is a real string these pages print that is
// score-SHAPED without being a score:
//
//   - `.ctr__terms` — Cot's own contract shorthand, "9 y/$215M (20-28)+29 m
//     opt*". "20-28" is a span of seasons.
//   - `.paysource` — the attribution line, carrying Cot's as-of date.
//   - The Money band check is scoped to `#money`, the band's own section. The
//     team-hub header wrapped around it carries the club's WON-LOST RECORD on
//     every tab, which is a standings fact the app has always shown live; it is
//     not this page's doing and not this page's to assert.

const SCORE = /\b\d{1,2}\s*[-–—]\s*\d{1,2}\b/

// The text a page prints, minus the subtrees that legitimately carry a
// score-shaped string. Walks text nodes rather than diffing innerText, so an
// exclusion removes exactly its own subtree and nothing near it.
async function textWithout(page, container, excluded) {
  return page.evaluate(
    ([sel, skip]) => {
      const root = document.querySelector(sel)
      if (!root) return ''
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const out = []
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        if (skip.some((s) => node.parentElement?.closest(s))) continue
        out.push(node.nodeValue)
      }
      return out.join(' ')
    },
    [container, excluded],
  )
}

// Every row currently on the board, as the reader sees it: the pos tag first,
// then the club tag (SalaryBoard.jsx renders them in that order).
async function boardRows(page) {
  return page.$$eval('.payboard__row', (rows) =>
    rows.map((row) => ({
      name: row.querySelector('.payboard__name')?.textContent?.trim() ?? '',
      tags: [...row.querySelectorAll('.payboard__tag')].map((t) => t.textContent.trim()),
    })),
  )
}

test('/salaries: the club rail and the position chips narrow the same board together', async ({
  page,
}) => {
  await page.goto('/salaries')
  await expect(page.getByRole('heading', { level: 1, name: 'Salaries' })).toBeVisible()

  // Unfiltered: a full board, and the context line says so.
  await expect(page.locator('.payboard__context').first()).toHaveText('All 30 clubs · every position')
  const all = await boardRows(page)
  expect(all.length).toBeGreaterThan(1)

  // One cut: position only.
  await page.locator('.payboard__filter').getByRole('button', { name: 'SP', exact: true }).click()
  await expect(page.locator('.payboard__context').first()).toHaveText('All 30 clubs · SP')
  const starters = await boardRows(page)
  expect(starters.length).toBeGreaterThan(0)
  for (const row of starters) expect(row.tags[0]).toBe('SP')

  // Second cut, on top of the first: the club rail, without touching the chip.
  // If the two ever stop composing, this is where it shows — the club lands and
  // the position resets, or the other way round.
  await page.locator('.teamfilterstrip [data-team-id="158"]').click()
  await expect(page.locator('.payboard__context').first()).toHaveText('Milwaukee Brewers · SP')
  const brewerStarters = await boardRows(page)
  expect(brewerStarters.length).toBeGreaterThan(0)
  for (const row of brewerStarters) {
    expect(row.tags[0]).toBe('SP')
    expect(row.tags[1]).toBe('MIL')
  }

  // The pick RINGS the club's row in the payroll ranking rather than filtering
  // thirty bars down to one — a ranking of one entry is not a ranking
  // (ClubPayrolls.jsx). All thirty stay on the page.
  await expect(page.locator('.payclubs__row')).toHaveCount(30)
  await expect(page.locator('.payclubs__row.is-picked')).toHaveCount(1)

  // Clearing one cut leaves the other standing.
  await page.locator('.payboard__filter').getByRole('button', { name: 'All positions' }).click()
  await expect(page.locator('.payboard__context').first()).toHaveText('Milwaukee Brewers · every position')
  for (const row of await boardRows(page)) expect(row.tags[1]).toBe('MIL')
})

test('/salaries: a club with nobody at a position says so', async ({ page }) => {
  await page.goto('/salaries')
  await expect(page.locator('.payboard__row').first()).toBeVisible()

  // Read the published file the page is already showing and find a real pair
  // with no player — same fetch, from cache, so this cannot disagree with what
  // is on screen.
  const pair = await page.evaluate(async () => {
    const league = await (await fetch('/data/salaries.json')).json()
    const held = new Set(league.players.map((p) => `${p.teamId}|${p.pos}`))
    for (const club of league.clubs) {
      for (const entry of league.positions) {
        if (!held.has(`${club.teamId}|${entry.pos}`)) {
          return { teamId: club.teamId, pos: entry.pos, name: club.name }
        }
      }
    }
    return null
  })
  expect(pair, 'no empty club/position pair in salaries.json — the empty state is unreachable').not.toBeNull()

  await page.locator(`.teamfilterstrip [data-team-id="${pair.teamId}"]`).click()
  await page.locator('.payboard__filter').getByRole('button', { name: pair.pos, exact: true }).click()

  await expect(page.locator('.payboard__context').first()).toHaveText(`${pair.name} · ${pair.pos}`)
  await expect(page.locator('.payboard__empty')).toHaveText(
    'No salaried player at this club and position.',
  )
  await expect(page.locator('.payboard__row')).toHaveCount(0)
})

test('/salaries prints nothing score-shaped and never reaches the game feed', async ({ page }) => {
  const feedRequests = []
  page.on('request', (req) => {
    if (new URL(req.url()).hostname === 'statsapi.mlb.com') feedRequests.push(req.url())
  })

  await page.goto('/salaries')
  await expect(page.locator('.payclubs__row')).toHaveCount(30)
  // Give any late effect a chance to fire before concluding nothing did.
  await page.waitForTimeout(1000)

  // Every figure on this page comes from public/data/salaries.json. Nothing
  // here has any business asking statsapi for a game.
  expect(feedRequests, `unexpected feed requests: ${feedRequests.join(', ')}`).toHaveLength(0)

  const body = await textWithout(page, '.screen', ['.paysource', '.ctr__terms', 'footer'])
  expect(body).not.toMatch(SCORE)
  expect(body).not.toMatch(/\bfinal\b/i)
  expect(body).not.toMatch(/\b(top|bottom) \d/i)
})

test('the Money band renders the ledger, and the ledger prints nothing score-shaped', async ({
  page,
}) => {
  // The old Contracts address redirects to the bare page at #money (ADR-0082).
  await page.goto('/team/158/contracts')
  await expect(page).toHaveURL(/\/team\/158(?:\?[^#]*)?#money$/)
  await expect(page.locator('h1.tnext__name')).toHaveText('Milwaukee Brewers')

  // The band's own furniture: the stat wall, the cliff bars, the grid, the key.
  const money = page.locator('#money')
  await expect(money.locator('.stattile')).toHaveCount(4)
  await expect(money.getByRole('heading', { name: 'The commitment cliff' })).toBeVisible()
  await expect(money.locator('.ctr__table tbody').first()).toBeVisible()
  await expect(money.getByText('Free agent — no commitment')).toBeVisible()

  // A code cell prints its code, never a figure — the money rule of ADR-0052,
  // seen on the page rather than in the arithmetic. The Brewers carry dozens of
  // unsettled arbitration years, so this is a fair thing to require of them.
  const codes = await page.$$eval('.ctr__code', (els) => els.map((e) => e.textContent.trim()))
  expect(codes.length).toBeGreaterThan(0)
  for (const code of codes) expect(code).toMatch(/^(A\d+|.*opt.*|OPT)$/i)

  const ledger = await textWithout(page, '#money', ['.paysource', '.ctr__terms'])
  expect(ledger).not.toMatch(SCORE)
  expect(ledger).not.toMatch(/\bfinal\b/i)
  expect(ledger).not.toMatch(/\b(top|bottom) \d/i)
})

test('the Money band says the page date does not move it, and the page still offers the date', async ({
  page,
}) => {
  // A contract ledger is a SEASON's book, so loadContracts.js is deliberately
  // not keyed on `asOf`. The tab used to hide the shell's banner; the one-scroll
  // page keeps the banner for its other bands (ADR-0082), so the Money band says
  // in words what the missing banner said by absence: a season's book, not a
  // day's. A dated visit must leave the ledger on the page, unchanged in kind.
  await page.goto('/team/158/contracts?d=2026-04-10')
  await expect(page.locator('#money .ctr__table tbody').first()).toBeVisible()
  await expect(page.locator('#money .paysource')).toContainText('A season’s book, not a day’s')
  await expect(page.locator('.asof-banner')).toHaveCount(1)
})
