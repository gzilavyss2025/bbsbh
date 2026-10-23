import test from 'node:test'
import assert from 'node:assert/strict'

// #2593: the Farm band's prospects, Horizon and depth chart know only today's org, so a past
// season loads none of them and says so (the band then counts the cards it draws).
// Offline: a stub `fetch` answers every URL; one ranked org prospect exists for club 158.

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
  if (u.includes('top-prospects')) body = { players: [], orgProspects: [{ teamId: 158, playerId: 1, orgRank: 1, name: 'A Prospect', position: 'SS' }] }
  const ok = !u.startsWith('/data/') || u.endsWith('/data/teams.json') || u.includes('top-prospects')
  return { ok, status: ok ? 200 : 404, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }
}

const { loadMinors } = await import('../src/screens/team/data/loadMinors.js')

test('loadMinors on the current season keeps the org prospects', async () => {
  const now = await loadMinors(158, null)
  assert.equal(now.pastSeason, false)
  assert.equal(now.prospects.length, 1)
  assert.deepEqual(now.depthChart.positions, ['SS'])
})

test('loadMinors on a past season returns no prospects, depth chart or milestones', async () => {
  const past = await loadMinors(158, '2018-12-31')
  assert.equal(past.pastSeason, true)
  assert.deepEqual(past.prospects, [])
  assert.deepEqual(past.depthChart.positions, [])
  assert.deepEqual(past.horizon, { promotionWatch: [], milestones: [] })
})
