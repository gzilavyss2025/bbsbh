import test, { mock } from 'node:test'
import assert from 'node:assert/strict'

// #2776: a past season whose today-only stores were frozen (scripts/frozen/freeze-season.mjs) keeps
// Money and the Farm prospects and depth chart, read from public/data/frozen/{season}/.
// The clock sits in 2027, so 2026 is a past season; src/lib/data/frozen-seasons.json lists 2026.
// Offline: a stub `fetch` answers every URL and records it.

mock.timers.enable({ apis: ['Date'], now: Date.parse('2027-02-01T12:00:00Z') })

const seen = []
globalThis.fetch = async (url) => {
  const u = String(url)
  seen.push(u)
  let body = {}
  if (u.endsWith('/data/teams.json')) {
    body = {
      bySportId: {
        1: [{ id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers', abbreviation: 'MIL', leagueId: 104, leagueName: 'National League', divisionId: 205 }],
      },
    }
  }
  if (u === '/data/frozen/2026/top-prospects.json') {
    body = { players: [], orgProspects: [{ teamId: 158, playerId: 1, orgRank: 1, name: 'A Prospect', position: 'SS', levelRaw: 'AA' }] }
  }
  if (u === '/data/frozen/2026/team-contracts/158.json') {
    body = { teamId: 158, season: 2026, years: [2026], groups: [], totals: [{ players: 31 }], counts: {}, payroll: 1 }
  }
  if (u === '/data/frozen/2026/salaries.json') body = { owed: [], clubs: [{ id: 158 }], positions: [], totals: {} }
  const ok = !u.startsWith('/data/') || u.endsWith('/data/teams.json') || u.startsWith('/data/frozen/2026/')
  return { ok, status: ok ? 200 : 404, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }
}

const { loadMinors } = await import('../src/screens/team/data/loadMinors.js')
const { loadContracts } = await import('../src/screens/team/data/loadContracts.js')
const { hiddenTeamSections, isFrozenSeason } = await import('../src/screens/team/data/shared.js')

const MLB = { sport: { id: 1 }, league: { id: 104 }, parentOrgId: null }

test('2026 is frozen; 2018 is not', () => {
  assert.equal(isFrozenSeason(2026), true)
  assert.equal(isFrozenSeason(2018), false)
})

test('a frozen past season keeps Money; an unfrozen one hides it', () => {
  assert.deepEqual(hiddenTeamSections(MLB, { pastSeason: true, frozen: true }), new Set())
  assert.deepEqual(hiddenTeamSections(MLB, { pastSeason: true, frozen: false }), new Set(['money']))
})

test('loadMinors on a frozen past season reads the frozen prospect list, with no Horizon', async () => {
  const past = await loadMinors(158, '2026-12-31')
  assert.equal(past.pastSeason, true)
  assert.ok(seen.includes('/data/frozen/2026/top-prospects.json'))
  assert.equal(past.prospects.length, 1)
  assert.deepEqual(past.depthChart.positions, ['SS'])
  assert.deepEqual(past.horizon, { promotionWatch: [], milestones: [] })
})

test('loadContracts on a frozen past season reads the frozen ledger and league file', async () => {
  const money = await loadContracts(158, '2026-12-31')
  assert.equal(money.ledger.season, 2026)
  assert.equal(money.clubCount, 1)
  assert.ok(seen.includes('/data/frozen/2026/team-contracts/158.json'))
  assert.ok(seen.includes('/data/frozen/2026/salaries.json'))
})
