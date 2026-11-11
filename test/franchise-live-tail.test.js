import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ledgerWithLiveTail, liveRow, liveSeasons } from '../src/api/history/franchise.js'

// #3036: the ledger-plus-live-tail rule, with the statsapi reads faked, and the live row it builds (#2763).

const team = { id: 158, league: { id: 104 } }
const stored = [{ season: 2024, name: 'Milwaukee Brewers', w: 93, l: 69 }]
const finalGame = { gamePk: 1, gameType: 'R', status: { abstractGameState: 'Final' }, teams: { home: { team: { id: 158 }, isWinner: true }, away: { team: { id: 112 }, isWinner: false } } }

test('liveSeasons: the seasons after the stored file, none with no file', () => {
  assert.deepEqual(liveSeasons(2024, 2026), [2025, 2026])
  assert.deepEqual(liveSeasons(2026, 2026), [])
  assert.deepEqual(liveSeasons(null, 2026), [])
})

test('ledgerWithLiveTail: a winter before the offseason re-run has two live rows, oldest first', async () => {
  const urls = []
  const deps = {
    getJson: async (url) => (urls.push(url), { dates: [{ games: [finalGame] }] }),
    fetchStandings: async (_lg, season) => (season === 2025 ? standings(97, 65) : standings(90, 72)),
    fetchManager: async () => ({ personId: 580268, name: 'Pat Murphy' }),
  }
  const rows = await ledgerWithLiveTail({ team, through: 2024, stored, year: 2026 }, deps)
  assert.deepEqual(rows.map((r) => [r.season, r.w, r.name]), [[2024, 93, 'Milwaukee Brewers'], [2025, 97, 'Milwaukee Brewers'], [2026, 90, 'Milwaukee Brewers']])
  assert.equal(rows[2].inProgress, false)
  assert.equal(urls.length, 2)
  assert.match(urls[0], /teamId=158&season=2025&gameType=R,F,D,L,W/)
})

test('ledgerWithLiveTail: a season not started costs no schedule read; a failed schedule drops the row', async () => {
  const urls = []
  const deps = {
    getJson: async (url) => { urls.push(url); throw new Error('down') },
    fetchStandings: async (_lg, season) => (season === 2025 ? standings(97, 65) : standings(0, 0)),
    fetchManager: async () => { throw new Error('none') },
  }
  const rows = await ledgerWithLiveTail({ team, through: 2024, stored, year: 2026 }, deps)
  assert.deepEqual(rows.map((r) => r.season), [2024])
  assert.equal(urls.length, 1)
})
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
  // #2784 review: fetchManager names one manager (an interim first), never who managed which
  // games, so the live row credits no W-L. The page shows it with the † until the ledger run splits it.
  assert.deepEqual(r.managers, [{ id: 580268, name: 'Pat Murphy' }])
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
