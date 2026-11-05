import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRoute } from '../src/lib/route.js'
import { ledgerItems, liveRow, oddSeasons, postLabel, seasonCells } from '../src/screens/team/franchise/ledgerRows.js'

// #2763: the franchise page's route and the pure shaping of its season ledger.

test('route: /team/{id}/franchise is its own page, with or without the name slug', () => {
  assert.deepEqual(parseRoute('/team/158/franchise'), { name: 'team-franchise', id: '158', asOf: null, sportId: null })
  assert.equal(parseRoute('/team/milwaukee-brewers-158/franchise').id, '158')
})

const row = (season, extra = {}) => ({
  season,
  name: 'Milwaukee Brewers',
  w: 90,
  l: 72,
  gb: 0,
  divisionRank: 1,
  leagueRank: 2,
  rs: 750,
  ra: 650,
  managers: [],
  postseason: null,
  note: null,
  ...extra,
})

test('seasonCells: W-L, pct, finish, GB, runs and the run difference', () => {
  const c = seasonCells(row(2026, { w: 103, l: 59, rs: 832, ra: 618 }))
  assert.deepEqual([c.wl, c.pct, c.finish, c.gb, c.rs, c.ra, c.diff], ['103-59', '.636', '1st', '—', 832, 618, '+214'])
  const d = seasonCells(row(2016, { w: 73, l: 89, gb: 30.5, divisionRank: 4, rs: 671, ra: 733 }))
  assert.deepEqual([d.pct, d.finish, d.gb, d.diff], ['.451', '4th', '30.5', '-62'])
  assert.equal(seasonCells(row(2000, { rs: 700, ra: 700 })).diff, '0')
})

test('seasonCells: finish is the league rank before divisions (1969); no rank is a dash', () => {
  assert.equal(seasonCells(row(1950, { divisionRank: null, leagueRank: 3 })).finish, '3rd')
  assert.equal(seasonCells(row(1950, { divisionRank: null, leagueRank: 11 })).finish, '11th')
  assert.equal(seasonCells(row(1950, { divisionRank: null, leagueRank: 22 })).finish, '22nd')
  assert.equal(seasonCells(row(1950, { divisionRank: null, leagueRank: null })).finish, '—')
})

test('seasonCells: no games reads a dash for pct, and missing runs read a dash', () => {
  const c = seasonCells(row(2027, { w: 0, l: 0, rs: null, ra: null }))
  assert.deepEqual([c.pct, c.diff], ['—', '—'])
})

test('postLabel: short and long forms, won and lost, every round on file', () => {
  const p = (round, won) => postLabel({ round, won })
  assert.deepEqual(p('World Series', true), { short: 'Won WS', long: 'Won World Series', title: true })
  assert.deepEqual(p('World Series', false), { short: 'Lost WS', long: 'Lost World Series', title: false })
  assert.equal(p('NL Championship Series', false).short, 'Lost NLCS')
  assert.equal(p('AL Division Series', false).long, 'Lost ALDS')
  assert.equal(p('NL Wild Card Game', false).short, 'Lost WC')
  assert.equal(p('AL Wild Card Series', true).long, 'Won Wild Card')
  assert.deepEqual(postLabel(null), { short: '—', long: '—', title: false })
  // a series still being played (the live row): neither won nor lost yet
  assert.equal(p('NL Championship Series', null).short, 'In NLCS')
})

test('seasonCells: managers keep id and name, most games first as the ledger orders them', () => {
  const c = seasonCells(row(2015, { managers: [{ id: 112736, name: 'Craig Counsell', w: 61, l: 76 }, { id: 121373, name: 'Ron Roenicke', w: 7, l: 18 }] }))
  assert.deepEqual(c.managers, [{ id: 112736, name: 'Craig Counsell' }, { id: 121373, name: 'Ron Roenicke' }])
})

test('ledgerItems: newest first; a band above the newest season of each older name', () => {
  const rows = [
    row(1969, { name: 'Seattle Pilots' }),
    row(1970),
    row(1971),
  ]
  const items = ledgerItems(rows)
  assert.deepEqual(
    items.map((i) => (i.kind === 'band' ? `band ${i.name} ${i.from}-${i.to}` : String(i.row.season))),
    ['1971', '1970', 'band Seattle Pilots 1969-1969', '1969'],
  )
})

test('ledgerItems: a name the club returns to gets its own band each time', () => {
  const rows = [row(1, { name: 'A' }), row(2, { name: 'B' }), row(3, { name: 'A' }), row(4, { name: 'A' })]
  const bands = ledgerItems(rows).filter((i) => i.kind === 'band')
  assert.deepEqual(bands.map((b) => [b.name, b.from, b.to]), [['B', 2, 2], ['A', 1, 1]])
})

test('ledgerItems: no rows is an empty list', () => {
  assert.deepEqual(ledgerItems([]), [])
})

// The live row: standings records and the club's own schedule for one season.
const standings = (w, l, extra = {}) => [
  { teamRecords: [{ team: { id: 158 }, wins: w, losses: l, gamesBack: '-', divisionRank: '1', leagueRank: '1', runsScored: 832, runsAllowed: 618, ...extra }] },
]
const g = (gameType, desc, away, home, awayWon, state = 'Final', gamesInSeries = 7) => ({
  gameType,
  seriesDescription: desc,
  gamesInSeries,
  status: { abstractGameState: state },
  teams: { away: { team: { id: away }, isWinner: state === 'Final' ? awayWon : undefined }, home: { team: { id: home }, isWinner: state === 'Final' ? !awayWon : undefined } },
})
const base = { teamId: 158, season: 2026, name: 'Milwaukee Brewers', manager: { personId: 580268, name: 'Pat Murphy' } }

test('liveRow: a finished season that ended in a World Series win, no tag', () => {
  const dates = [{ games: [g('R', 'Regular Season', 158, 112, true, 'Final', 3), ...[1, 2, 3, 4].map(() => g('W', 'World Series', 158, 147, true)), g('W', 'World Series', 158, 147, false)] }]
  const r = liveRow({ ...base, records: standings(103, 59), dates })
  assert.deepEqual([r.season, r.w, r.l, r.gb, r.divisionRank, r.rs, r.ra], [2026, 103, 59, 0, 1, 832, 618])
  assert.deepEqual(r.postseason, { round: 'World Series', won: true })
  assert.equal(r.inProgress, false)
  // #2784: the one manager on file is credited the season, as a stored single-manager season is.
  assert.deepEqual(r.managers, [{ id: 580268, name: 'Pat Murphy', w: 103, l: 59 }])
})

test('liveRow: a game left to play tags the row in progress; a series not yet decided reads as neither won nor lost', () => {
  const dates = [{ games: [
    g('L', 'NL Championship Series', 158, 119, true),
    g('L', 'NL Championship Series', 158, 119, true),
    g('L', 'NL Championship Series', 119, 158, false, 'Preview'),
  ] }]
  const r = liveRow({ ...base, records: standings(103, 59), dates })
  assert.equal(r.inProgress, true)
  assert.deepEqual(r.postseason, { round: 'NL Championship Series', won: null })
})

test('liveRow: the highest round wins; a lost series is lost even with games unplayed in the bracket', () => {
  const dates = [{ games: [
    ...[1, 2, 3].map(() => g('D', 'NL Division Series', 158, 135, true, 'Final', 5)),
    ...[1, 2, 3, 4].map(() => g('L', 'NL Championship Series', 119, 158, true)),
  ] }]
  const r = liveRow({ ...base, records: standings(103, 59), dates })
  assert.deepEqual(r.postseason, { round: 'NL Championship Series', won: false })
  assert.equal(r.inProgress, false)
})

test('liveRow: a regular season under way with no postseason; a season not started is null', () => {
  const live = liveRow({ ...base, records: standings(40, 30, { gamesBack: '2.5', divisionRank: '2' }), dates: [{ games: [g('R', 'Regular Season', 158, 112, true, 'Live')] }] })
  assert.deepEqual([live.gb, live.divisionRank, live.postseason, live.inProgress], [2.5, 2, null, true])
  assert.equal(liveRow({ ...base, records: standings(0, 0), dates: [] }), null)
  assert.equal(liveRow({ ...base, records: [], dates: [] }), null)
})

test('liveRow: no manager on file reads an empty list', () => {
  const r = liveRow({ ...base, manager: null, records: standings(1, 0), dates: [] })
  assert.deepEqual(r.managers, [])
})

test('liveRow: a schedule that could not be read (null) drops the row rather than guessing', () => {
  assert.equal(liveRow({ ...base, records: standings(103, 59), dates: null }), null)
})

test('liveRow: a game listed twice (suspended, then resumed) counts once', () => {
  const ws = (pk, awayWon) => ({ ...g('W', 'World Series', 158, 147, awayWon), gamePk: pk })
  // 3-1 in a best of seven, with game 4 listed on both its dates: not decided yet
  const dates = [{ games: [ws(1, true), ws(2, true), ws(3, false), ws(4, true)] }, { games: [ws(4, true), { ...ws(5, true), status: { abstractGameState: 'Preview' } }] }]
  const r = liveRow({ ...base, records: standings(103, 59), dates })
  assert.deepEqual(r.postseason, { round: 'World Series', won: null })
})

// #2784: an odd season carries a short tag on its row; the notes read as one line under the table.
test('seasonCells: an odd season gets a short tag; any other row has none', () => {
  assert.equal(seasonCells(row(2020, { note: '60-game season' })).tag, '60 G')
  assert.equal(seasonCells(row(1994, { note: 'strike' })).tag, 'Strike')
  assert.equal(seasonCells(row(1981, { note: 'split season' })).tag, 'Split')
  assert.equal(seasonCells(row(1999, { note: 'a note no one mapped' })).tag, 'Note')
  assert.equal(seasonCells(row(2019)).tag, null)
})

test('oddSeasons: the noted seasons oldest first as one line, or null when none', () => {
  const rows = [row(2020, { note: '60-game season' }), row(1981, { note: 'split season' }), row(1994, { note: 'strike' }), row(2019)]
  assert.equal(oddSeasons(rows), '1981 split season · 1994 strike · 2020 60-game season')
  assert.equal(oddSeasons([row(2019)]), null)
})
