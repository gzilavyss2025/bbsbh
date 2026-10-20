import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pennantsOfSeason, groupByTeam } from '../scripts/lib/club/league-pennants.mjs'
import { pennantsList } from '../src/api/history/leaguePennants.js'

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
