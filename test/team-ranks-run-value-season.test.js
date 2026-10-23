import test from 'node:test'
import assert from 'node:assert/strict'

// The run value card follows the Savant file's own season, not the calendar: in January, before the
// nightly run rolls the file over, it still holds last season and must not sit under the new
// season's page. Its own file because the file read is memoized per process.
const year = new Date().getFullYear()
globalThis.fetch = async (url) => {
  const u = String(url)
  let body = {}
  if (u.endsWith('/data/teams.json')) {
    body = { bySportId: { 1: [{ id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers', abbreviation: 'MIL', leagueId: 104, leagueName: 'National League', divisionId: 205 }] } }
  }
  if (u.includes('/teams/stats')) body = { stats: [{ splits: [{ team: { id: 158 }, stat: { runs: 700, era: '3.5' } }] }] }
  if (u.endsWith('/data/run-value.json')) {
    body = { season: year - 1, generatedAt: '2025-12-01', players: [{ teamId: 158, name: 'A Player', bat: 5, fld: 1, run: 0, pit: 0 }] }
  }
  const ok = !u.startsWith('/data/') || u.endsWith('/data/teams.json') || u.endsWith('/data/run-value.json')
  return { ok, status: ok ? 200 : 404, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }
}

const { loadRanks } = await import('../src/screens/team/data/loadNumbers.js')

test('a file holding last season draws no card on the live page, and one on last season\'s', async () => {
  assert.equal((await loadRanks(158)).runValue, null)
  assert.equal((await loadRanks(158, `${year - 1}-12-31`)).runValue?.club.teamId, 158)
})
