import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playerPennants } from '../src/screens/player/next/modules/teams/pennantsView.js'

const FILE = {
  teams: {
    158: [
      { season: 1982, league: 'AL', name: 'Milwaukee Brewers', club: 'Milwaukee', abbr: 'MIL' },
      { season: 2026, league: 'NL', name: 'Milwaukee Brewers', club: 'Milwaukee', abbr: 'MIL' },
    ],
    147: [{ season: 1982, league: 'AL', name: 'X', club: 'X', abbr: 'X' }],
  },
}
const split = (season, teamId, gamesPlayed) => ({ season: String(season), team: teamId && { id: teamId }, stat: { gamesPlayed } })

test('a season on a club that won the pennant that year earns one, newest first', () => {
  const got = playerPennants(FILE, [split(1982, 158, 140), split(2026, 158, 3)])
  assert.deepEqual(got.map((p) => [p.season, p.teamId]), [[2026, 158], [1982, 158]])
})

test('the same club in another year, or another club that year, earns none', () => {
  assert.deepEqual(playerPennants(FILE, [split(1983, 158, 150), split(1982, 136, 150)]), [])
})

test('a season with no games for the club does not count, and the career total row is skipped', () => {
  assert.deepEqual(playerPennants(FILE, [split(1982, 158, 0), split(1982, 158, undefined), split(1982, null, 150)]), [])
})

test('a player traded between two clubs of a pennant year gets one pennant per club', () => {
  const got = playerPennants(FILE, [split(1982, 158, 20), split(1982, 147, 30), split(1982, 158, 5)])
  assert.deepEqual(got.map((p) => p.teamId), [147, 158])
})

test('a dated page leaves out the pennant of the page\'s own season and later ones', () => {
  const splits = [split(1982, 158, 140), split(2026, 158, 3)]
  assert.deepEqual(playerPennants(FILE, splits, 2026).map((p) => p.season), [1982])
  assert.deepEqual(playerPennants(FILE, splits, 1982), [])
})

test('no file or no splits reads []', () => {
  assert.deepEqual(playerPennants(null, [split(1982, 158, 9)]), [])
  assert.deepEqual(playerPennants(FILE, undefined), [])
})
