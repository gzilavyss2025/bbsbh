import test from 'node:test'
import assert from 'node:assert/strict'

// The Ranks cards read "rank of N", N being the clubs the ranks were computed against: 24 in
// 1969, 30 now (#2594). Offline: a stub `fetch` answers /teams/stats with one row per club.

let clubs = 30
globalThis.fetch = async (url) => {
  const u = String(url)
  let body = {}
  if (u.endsWith('/data/teams.json')) {
    body = {
      bySportId: {
        1: [{ id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers', abbreviation: 'MIL', leagueId: 104, leagueName: 'National League', divisionId: 205 }],
      },
    }
  }
  if (u.includes('/teams/stats')) {
    const splits = Array.from({ length: clubs }, (_, i) => ({ team: { id: 158 + i }, stat: { runs: 700 - i, era: `${3 + i / 100}` } }))
    body = { stats: [{ splits }] }
  }
  const ok = !u.startsWith('/data/') || u.endsWith('/data/teams.json')
  return { ok, status: ok ? 200 : 404, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }
}

const { loadRanks } = await import('../src/screens/team/data/loadNumbers.js')

test('loadRanks reports the club count of a 24-club season', async () => {
  clubs = 24
  const n = await loadRanks(158, '1969-12-31')
  assert.equal(n.clubCount, 24)
})

test('loadRanks reports the club count of a 30-club season', async () => {
  clubs = 30
  const n = await loadRanks(158, '2018-12-31')
  assert.equal(n.clubCount, 30)
})
