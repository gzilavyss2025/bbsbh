import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clubPeople, managersView, retiredTiles, yearRuns } from '../src/screens/team/franchise/people/peopleView.js'
import { summaryView } from '../src/screens/team/franchise/summary/summaryView.js'
import { summarizeFranchise } from '../src/api/history/franchiseSummary.js'

// #2784: the franchise page's summary and People and places, shaped for the cards.

test('yearRuns: runs of seasons, the end year short within a century and whole across one', () => {
  assert.equal(yearRuns([1981, 1982, 1984, 1985]), '1981–82, 1984–85')
  assert.equal(yearRuns([2020, 2018, 2019, 2021, 2023]), '2018–21, 2023')
  assert.equal(yearRuns([1999, 2000, 2001]), '1999–2001')
  assert.equal(yearRuns([]), '')
})

const r = (season, managers, extra = {}) => ({ season, name: 'Milwaukee Brewers', w: 90, l: 72, managers, postseason: null, ...extra })
const murphy = (w, l) => ({ id: 580268, name: 'Pat Murphy', w, l })
const counsell = (w, l) => ({ id: 112736, name: 'Craig Counsell', w, l })

test('managersView: newest first, W-L summed, pct, the winningest marked', () => {
  const rows = [r(2023, [counsell(92, 70)]), r(2024, [murphy(93, 69)]), r(2022, [counsell(86, 76)])]
  const v = managersView(rows, 112736)
  assert.deepEqual(v.map((m) => [m.name, m.years, m.wl, m.pct, m.best, m.partial]), [
    ['Pat Murphy', '2024', '93-69', '.574', false, false],
    ['Craig Counsell', '2022–23', '178-146', '.549', true, false],
  ])
})

test('managersView: a shared season with no split lists its year and marks him partial', () => {
  const rows = [r(2008, [{ id: 1, name: 'Ned Yost III', w: 83, l: 67 }, { id: 2, name: 'Dale Sveum' }]), r(2007, [{ id: 1, name: 'Ned Yost III', w: 83, l: 79 }])]
  const v = managersView(rows, null)
  assert.deepEqual(v.find((m) => m.id === 2), { id: 2, name: 'Dale Sveum', years: '2008', wl: '—', pct: '—', partial: true, best: false })
  assert.equal(v.find((m) => m.id === 1).partial, false)
})

test('retiredTiles: a role tag for a non-player, and a player link only from a matched id', () => {
  const numbers = [
    { number: 1, name: 'Bud Selig', role: 'executive', year: 2015 },
    { number: 19, name: 'Robin Yount', role: 'player', year: 1994 },
    { number: 99, name: 'Nobody Known', role: 'player', year: null },
  ]
  const t = retiredTiles(numbers, [{ id: 124721, name: 'Robin Yount' }, { id: 7, name: 'Bud Selig' }])
  assert.deepEqual(t, [
    { number: 1, name: 'Bud Selig', year: 2015, role: 'executive', playerId: null },
    { number: 19, name: 'Robin Yount', year: 1994, role: null, playerId: 124721 },
    { number: 99, name: 'Nobody Known', year: null, role: null, playerId: null },
  ])
})

test('clubPeople: ids from both Hall of Fame groups and both leader groups', () => {
  const hof = { inductedAs: [{ id: 1, name: 'A' }], alsoPlayed: [{ id: 2, name: 'B', seasons: [] }] }
  const leaders = { career: { hits: [{ id: 3, name: 'C' }] }, season: { wins: [{ id: 4, name: 'D', season: 1978 }] } }
  assert.deepEqual(clubPeople(hof, leaders).map((p) => p.id), [1, 2, 3, 4])
  assert.deepEqual(clubPeople(null, null), [])
})

test('summaryView: the live season counts, so a title won this year shows', () => {
  const rows = [
    r(1969, [{ id: 9, name: 'Joe Schultz Jr.', w: 64, l: 98 }], { name: 'Seattle Pilots', w: 64, l: 98 }),
    r(1970, [], { w: 65, l: 97 }),
    r(2026, [murphy(103, 59)], { w: 103, l: 59, postseason: { round: 'World Series', won: true } }),
  ]
  const v = summaryView(summarizeFranchise(rows, [{ season: 1982, league: 'AL' }, { season: 2026, league: 'NL' }]))
  assert.equal(v.seasons, 3)
  assert.equal(v.record, '232-254')
  assert.equal(v.titles, 1)
  assert.equal(v.title.caption, '2026')
  assert.equal(v.pennant.caption, '1982 AL · 2026 NL')
  assert.deepEqual(v.names, [{ name: 'Seattle Pilots', years: '1969' }, { name: 'Milwaukee Brewers', years: '1970 on' }])
  assert.equal(v.best.name, 'Pat Murphy')
})

test('summaryView: "since" shows only when manager data starts after the club does', () => {
  const brewers = summarizeFranchise([r(1969, [murphy(1, 0)]), r(1970, [])], [])
  assert.equal(summaryView(brewers).since, null)
  const yankees = summarizeFranchise([r(1903, []), r(1969, [murphy(1, 0)])], [])
  assert.equal(summaryView(yankees).since, 1969)
  assert.equal(summaryView(summarizeFranchise([], [])), null)
})

test('summaryView: a long pennant or title list moves out of the tile caption into a fact row', () => {
  const rows = [1, 2, 3].map((i) => r(1920 + i, [], { postseason: { round: 'World Series', won: true } }))
  const v = summaryView(summarizeFranchise(rows, [{ season: 1921, league: 'AL' }, { season: 1922, league: 'AL' }, { season: 1923, league: 'AL' }]))
  assert.equal(v.pennant.caption, 'Last 1923')
  assert.equal(v.pennant.runs, '1921–23')
  assert.equal(v.title.caption, 'Last 1923')
  assert.equal(v.title.runs, '1921–23')
  const short = summaryView(summarizeFranchise([r(1982, []), r(2026, [], { postseason: { round: 'World Series', won: true } })], [{ season: 1982, league: 'AL' }, { season: 2026, league: 'NL' }]))
  assert.equal(short.pennant.caption, '1982 AL · 2026 NL')
  assert.equal(short.pennant.runs, null)
  assert.equal(short.title.caption, '2026')
  assert.equal(short.title.runs, null)
})

test('hofHeading: one name says it; a club that moved or renamed says "this franchise"', async () => {
  const { hofHeading } = await import('../src/screens/team/franchise/people/peopleView.js')
  assert.equal(hofHeading('Toronto Blue Jays', [{ name: 'Toronto Blue Jays' }]), 'Inducted as Toronto Blue Jays')
  assert.equal(hofHeading('Washington Nationals', [{ name: 'Montreal Expos' }, { name: 'Washington Nationals' }]), 'Inducted with this franchise')
  assert.equal(hofHeading('Milwaukee Brewers', null), 'Inducted as Milwaukee Brewers')
})
