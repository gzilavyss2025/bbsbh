import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pennantsOfSeason, groupByTeam, worldChampion } from '../scripts/lib/club/league-pennants.mjs'
import { pennantsBefore, pennantsList } from '../src/api/history/leaguePennants.js'

const side = (id, name, franchiseName, abbreviation, leagueId) => ({
  team: { id, name, franchiseName, abbreviation, league: { id: leagueId } },
})
const ws = (away, home, gameType = 'W') => ({ games: [{ gameType, teams: { away, home } }] })

test('the two World Series clubs each won their league, with the name they wore that year', () => {
  const series = [
    { games: [{ gameType: 'L', teams: { away: side(1, 'X', 'X', 'X', 103), home: side(2, 'Y', 'Y', 'Y', 103) } }] },
    ws(side(144, 'Boston Braves', 'Boston', 'BSN', 104), side(114, 'Cleveland Indians', 'Cleveland', 'CLE', 103)),
  ]
  assert.deepEqual(pennantsOfSeason(1948, series), [
    { teamId: 144, season: 1948, league: 'NL', name: 'Boston Braves', club: 'Boston', abbr: 'BSN' },
    { teamId: 114, season: 1948, league: 'AL', name: 'Cleveland Indians', club: 'Cleveland', abbr: 'CLE' },
  ])
})

test('a season with no World Series (1904, 1994) names no pennant', () => {
  assert.deepEqual(pennantsOfSeason(1994, []), [])
  assert.deepEqual(pennantsOfSeason(1969, [{ games: [{ gameType: 'L', teams: {} }] }]), [])
})

test('a club in no known league stops the run instead of leaving a hole', () => {
  const bad = ws(side(1, 'A', 'A', 'A', 999), side(2, 'B', 'B', 'B', 103))
  assert.throws(() => pennantsOfSeason(1950, [bad]), /league/)
})

test('groupByTeam files each pennant under its club, oldest first', () => {
  const rows = [
    { teamId: 147, season: 1923, league: 'AL', name: 'New York Yankees', club: 'New York', abbr: 'NYY' },
    { teamId: 147, season: 1921, league: 'AL', name: 'New York Yankees', club: 'New York', abbr: 'NYY' },
    { teamId: 158, season: 1982, league: 'AL', name: 'Milwaukee Brewers', club: 'Milwaukee', abbr: 'MIL' },
  ]
  const g = groupByTeam(rows)
  assert.deepEqual(Object.keys(g), ['147', '158'])
  assert.deepEqual(g[147].map((p) => p.season), [1921, 1923])
  assert.deepEqual(Object.keys(g[147][0]), ['season', 'league', 'name', 'club', 'abbr'])
})

test('pennantsList reads a club newest first and gives [] for a club with none', () => {
  const file = { through: 2025, teams: { 147: [{ season: 1921 }, { season: 2009 }, { season: 1923 }] } }
  assert.deepEqual(pennantsList(file, 147).map((p) => p.season), [2009, 1923, 1921])
  assert.deepEqual(pennantsList(file, 136), [])
  assert.deepEqual(pennantsList(null, 147), [])
})

test('a World Series still to be played already names the two pennant winners', () => {
  const game = { gameType: 'W', status: { abstractGameState: 'Preview' }, teams: { away: side(139, 'Tampa Bay Rays', 'Tampa Bay', 'TB', 103), home: side(158, 'Milwaukee Brewers', 'Milwaukee', 'MIL', 104) } }
  assert.deepEqual(pennantsOfSeason(2026, [{ games: [game] }]).map((p) => p.teamId), [139, 158])
})

test('a dated team page leaves out the pennant of its own season and later ones', () => {
  const rows = [{ season: 2026 }, { season: 2016 }, { season: 1982 }]
  assert.deepEqual(pennantsBefore(rows, 2016).map((p) => p.season), [1982])
  assert.deepEqual(pennantsBefore(rows, undefined).map((p) => p.season), [2026, 2016, 1982])
})

// The World Series winner: the side whose series wins (the last game's leagueRecord) pass half of gamesInSeries.
const fin = (aw, hw, of = 7) => ({ gamesInSeries: of, teams: { away: { team: { id: 158 }, leagueRecord: { wins: aw } }, home: { team: { id: 119 }, leagueRecord: { wins: hw } } } })
test('the World Series winner is the side that reached the clinching win', () => {
  assert.equal(worldChampion([fin(1, 0), fin(4, 1)]), 158)
  assert.equal(worldChampion([fin(3, 4)]), 119)
  assert.equal(worldChampion([fin(5, 3, 9)]), 158, 'a best-of-nine needs five')
})
test('a Series still being played has no champion yet', () => {
  assert.equal(worldChampion([fin(3, 2)]), null)
  assert.equal(worldChampion([]), null)
})
test('the champion pennant row says so, and the loser row does not', () => {
  const g = { gameType: 'W', gamesInSeries: 7, teams: {
    away: { ...side(158, 'Milwaukee Brewers', 'Milwaukee', 'MIL', 104), leagueRecord: { wins: 4 } },
    home: { ...side(147, 'New York Yankees', 'New York', 'NYY', 103), leagueRecord: { wins: 1 } },
  } }
  const rows = pennantsOfSeason(2026, [{ games: [g] }])
  assert.deepEqual(rows.map((r) => [r.abbr, r.ws === true]), [['MIL', true], ['NYY', false]])
  assert.equal(groupByTeam(rows)[158][0].ws, true)
  assert.equal('ws' in groupByTeam(rows)[147][0], false)
})
