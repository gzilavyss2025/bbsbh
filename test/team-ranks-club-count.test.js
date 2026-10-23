import test from 'node:test'
import assert from 'node:assert/strict'

// The Ranks cards read "rank of N", N being the clubs the ranks were computed against: 24 in
// 1969, 30 now (#2594). Offline: a stub `fetch` answers /teams/stats with one row per club.

let clubs = 30
let mineAt = 0 // 158's place in the runs order (0 is first)
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
    const splits = Array.from({ length: clubs }, (_, i) => ({ team: { id: i === mineAt ? 158 : i === 0 ? 900 : 158 + i }, stat: { runs: 700 - i, era: `${3 + i / 100}` } }))
    body = { stats: [{ splits }] }
  }
  if (u.endsWith('/data/run-value.json')) {
    body = { season: new Date().getFullYear(), generatedAt: '2026-01-01', players: [{ teamId: 158, name: 'A Player', bat: 5, fld: 1, run: 0, pit: 0 }] }
  }
  const ok = !u.startsWith('/data/') || u.endsWith('/data/teams.json') || u.endsWith('/data/run-value.json')
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

// The "bad" tone is the bottom third of the clubs ranked, not a fixed 20th (24 clubs in 1969).
test('a rank in the bottom third reads bad whatever the club count', async () => {
  mineAt = 17 // 18th by runs
  clubs = 24
  const r24 = await loadRanks(158, '1969-12-31')
  assert.equal(r24.batting.find((s) => s.k === 'Runs').tone, 'bad')
  clubs = 30
  const r30 = await loadRanks(158, '2018-12-31')
  assert.equal(r30.batting.find((s) => s.k === 'Runs').tone, '')
  mineAt = 0
})

// Savant's run values are this season's file: a past season's page must not draw them (#2593).
test('loadRanks draws no run value card for a past season, and one for the current season', async () => {
  const past = await loadRanks(158, '2018-12-31')
  assert.equal(past.runValue, null)
  const now = await loadRanks(158)
  assert.equal(now.runValue?.club.teamId, 158)
})
