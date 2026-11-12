import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { clubPeople, managersView, parksView, retiredTiles } from '../src/screens/team/franchise/people/peopleView.js'
import { summaryView } from '../src/screens/team/franchise/summary/summaryView.js'
import { summarizeFranchise } from '../src/api/history/franchiseSummary.js'

// #2784: the franchise page's summary and People and places, shaped for the cards.

const r = (season, managers, extra = {}) => ({ season, name: 'Milwaukee Brewers', w: 90, l: 72, managers, postseason: null, ...extra })
const murphy = (w, l) => ({ id: 580268, name: 'Pat Murphy', w, l })
const counsell = (w, l) => ({ id: 112736, name: 'Craig Counsell', w, l })

test('managersView: newest first, W-L summed, pct, the winningest marked', () => {
  const rows = [r(2023, [counsell(92, 70)]), r(2024, [murphy(93, 69)]), r(2022, [counsell(86, 76)])]
  const v = managersView(summarizeFranchise(rows, []).managers, 112736)
  assert.deepEqual(v.map((m) => [m.name, m.years, m.wl, m.pct, m.best, m.partial]), [
    ['Pat Murphy', '’24', '93-69', '.574', false, false],
    ['Craig Counsell', '’22–’23', '178-146', '.549', true, false],
  ])
})

test('managersView: a shared season with no split lists its year and marks him partial', () => {
  const rows = [r(2008, [{ id: 1, name: 'Ned Yost III', w: 83, l: 67 }, { id: 2, name: 'Dale Sveum' }]), r(2007, [{ id: 1, name: 'Ned Yost III', w: 83, l: 79 }])]
  const v = managersView(summarizeFranchise(rows, []).managers, null)
  assert.deepEqual(v.find((m) => m.id === 2), { id: 2, name: 'Dale Sveum', years: '’08', wl: '—', pct: '—', partial: true, best: false })
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
  assert.equal(v.title.caption, '’26')
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
  assert.equal(v.pennant.runs, '’21–’23')
  assert.equal(v.title.caption, 'Last 1923')
  assert.equal(v.title.runs, '’21–’23')
  const short = summaryView(summarizeFranchise([r(1982, []), r(2026, [], { postseason: { round: 'World Series', won: true } })], [{ season: 1982, league: 'AL' }, { season: 2026, league: 'NL' }]))
  assert.equal(short.pennant.caption, '1982 AL · 2026 NL')
  assert.equal(short.pennant.runs, null)
  assert.equal(short.title.caption, '’26')
  assert.equal(short.title.runs, null)
})

test('hofHeading: one name says it; a club that moved or renamed says "this franchise"', async () => {
  const { hofHeading } = await import('../src/screens/team/franchise/people/peopleView.js')
  assert.equal(hofHeading('Toronto Blue Jays', [{ name: 'Toronto Blue Jays' }]), 'Inducted as Toronto Blue Jays')
  assert.equal(hofHeading('Washington Nationals', [{ name: 'Montreal Expos' }, { name: 'Washington Nationals' }]), 'Inducted with this franchise')
  assert.equal(hofHeading('Milwaukee Brewers', null), 'Inducted as Milwaukee Brewers')
})

// #2788: the Parks card, on the real franchise-history files.
const history = (id) => JSON.parse(readFileSync(new URL(`../public/data/franchise-history/${id}.json`, import.meta.url), 'utf8'))
const parksFor = (id, live) => {
  const d = history(id)
  return parksView({ spans: d.spans, mates: d.mates, through: d.through }, live)
}

test('parksView: newest first, the current name with the old ones as "also", "on" for a park in use', () => {
  assert.deepEqual(parksFor(158), [
    { id: 32, name: 'American Family Field', also: ['Miller Park 2001–2020'], years: '2001 on', clubs: ['Milwaukee Brewers'], mates: [], temporary: false },
    { id: 23, name: 'Milwaukee County Stadium', also: [], years: '1970–2000', clubs: ['Milwaukee Brewers'], mates: [], temporary: false },
    { id: 3144, name: "Sick's Stadium", also: [], years: '1969', clubs: ['Seattle Pilots'], mates: [], temporary: false },
  ])
})

test('parksView: a park left and returned to keeps two runs; a shared park names the other club', () => {
  const yankees = parksFor(147)
  assert.equal(yankees.find((p) => p.id === 9).years, '1923–1973, 1976–2008')
  assert.deepEqual(parksFor(119).find((p) => p.id === 22).mates, ['Los Angeles Angels 1962–1965'])
  assert.equal(parksFor(119).find((p) => p.id === 3150).name, 'Washington Park')
  assert.deepEqual(parksView(), [])
})

test('parksView: a live season after the file extends the runs; a club that moved back is not "on" at the old park', () => {
  const rays = parksFor(139, [{ season: 2026, venue: { id: 12, name: 'Tropicana Field' } }])
  assert.deepEqual(rays.map((p) => [p.name, p.years]), [
    ['Tropicana Field', '1998–2024, 2026 on'],
    ['George M. Steinbrenner Field', '2025'],
  ])
  const brewers = parksFor(158, [{ season: 2026, venue: { id: 32, name: 'American Family Field' } }])
  assert.equal(brewers[0].years, '2001 on')
  assert.equal(parksFor(158, [{ season: 2026, venue: null }])[0].years, '2001 on')
})

// #2959: a temporary home from the hand-curated file is its own row, marked, sorted by its last season.
test('parksView: a temporary home joins the list with its note; the regular parks are unchanged', () => {
  const temp = [{ venueId: 2756, name: 'Sahlen Field', seasons: [2020, 2021], note: 'Buffalo, during the pandemic' }]
  const d = history(141)
  const v = parksView({ spans: d.spans, mates: d.mates, through: d.through }, [], temp)
  assert.deepEqual(v.map((p) => [p.name, p.years, p.temporary]), [
    ['Rogers Centre', '1990 on', false],
    ['Sahlen Field', '2020–2021', true],
    ['Exhibition Stadium', '1977–1989', false],
  ])
  assert.deepEqual(v[0].also, ['SkyDome 1990–2004'])
  assert.equal(v[1].note, 'Buffalo, during the pandemic')
})

// #2784 review: the retired-numbers file has no ids, so a name two ids share links nowhere.
test('retiredTiles: a name that maps to two ids in the club files gets no link', () => {
  const t = retiredTiles([{ number: 10, name: 'Dave Roberts', role: 'player', year: 2000 }], [
    { id: 121396, name: 'Dave Roberts' },
    { id: 121397, name: 'Dave Roberts' },
  ])
  assert.equal(t[0].playerId, null)
})

test('managersView: a live season with no split marks its manager partial and leaves it out of his W-L', () => {
  const rows = [r(2025, [murphy(97, 65)]), r(2026, [{ id: 580268, name: 'Pat Murphy' }], { w: 103, l: 59 })]
  const [m] = managersView(summarizeFranchise(rows, []).managers, 580268)
  assert.deepEqual([m.years, m.wl, m.partial], ['’25–’26', '97-65', true])
})
