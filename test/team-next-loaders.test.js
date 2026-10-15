import test from 'node:test'
import assert from 'node:assert/strict'

// The one-scroll team page's loaders (#1107, row 4): Standing and Ranks each buy only their
// own share of the old Numbers load, and the page-level reads more than one band makes
// (standings, schedule, roster, /stats) are bought once per page through SHARED. The tab
// routes call the same loaders with no sources, so each still fetches on its own.
// Offline: a stub `fetch` answers every URL, and records it.

const urls = []
globalThis.fetch = async (url) => {
  const u = String(url)
  urls.push(u)
  let body = {}
  if (u.endsWith('/data/teams.json')) {
    body = {
      bySportId: {
        1: [{ id: 158, name: 'Milwaukee Brewers', teamName: 'Brewers', abbreviation: 'MIL', leagueId: 104, leagueName: 'National League', divisionId: 205 }],
      },
    }
  }
  // One ranked org prospect, so the Farm loader reaches its org stats pool.
  if (u.includes('top-prospects')) body = { players: [], orgProspects: [{ teamId: 158, playerId: 1, orgRank: 1, name: 'A Prospect' }] }
  // Any other static file is absent (a 404), the way a club with no shard reads; the
  // transactions feed walks back a year per empty file, so `{}` there never ends.
  const ok = !u.startsWith('/data/') || u.endsWith('/data/teams.json') || u.includes('top-prospects')
  return { ok, status: ok ? 200 : 404, headers: new Headers(), json: async () => body, text: async () => JSON.stringify(body) }
}

const { loadStanding, loadRanks, loadNumbers } = await import('../src/screens/team/data/loadNumbers.js')
const { loadGames } = await import('../src/screens/team/data/loadGames.js')
const { loadRoster } = await import('../src/screens/team/data/loadRoster.js')
const { loadMinors } = await import('../src/screens/team/data/loadMinors.js')
const { loadTeamIdentity } = await import('../src/screens/team/loadTeamIdentity.js')
const { SHARED, forgetLoads } = await import('../src/screens/team/next/once.js')

async function fired(run) {
  urls.length = 0
  await run()
  return [...urls]
}
const RANKS_ONLY = ['/teams/stats', 'playerPool=all', 'run-value.json', '/abs/', '/people?']
const STANDING_ONLY = ['/standings', '/schedule', '/uniforms/', 'postseason-odds', 'comeback-wins', 'team-records', 'schedule-shape']

test('loadStanding buys none of the Ranks reads', async () => {
  const seen = await fired(() => loadStanding(158, null))
  for (const part of RANKS_ONLY) assert.ok(!seen.some((u) => u.includes(part)), `Standing fetched ${part}`)
  assert.ok(seen.some((u) => u.includes('/standings')))
})

test('loadRanks buys none of the Standing reads', async () => {
  const seen = await fired(() => loadRanks(158, null))
  for (const part of STANDING_ONLY) assert.ok(!seen.some((u) => u.includes(part)), `Ranks fetched ${part}`)
  assert.ok(seen.some((u) => u.includes('/teams/stats')))
})

test('loadNumbers (the Numbers tab) still returns both shares', async () => {
  const n = await loadNumbers(158, null)
  for (const key of ['standings', 'teamRecords', 'dayOfWeek', 'jerseyCombos', 'batting', 'leaderPool', 'runValue', 'injuredIds']) {
    assert.ok(key in n, `missing ${key}`)
  }
})

// The page-level reads: each URL that two loaders share.
const PAGE_READS = [/\/standings\?/, /\/schedule\?.*teamId=158/, /\/teams\/158\/roster\?rosterType=active/, /\/stats\?.*group=hitting.*teamId=158/, /\/stats\?.*group=pitching.*teamId=158/]
const loadPage = (src) =>
  Promise.all([
    loadTeamIdentity(158, null, src),
    loadStanding(158, null, src),
    loadRanks(158, null, src),
    loadGames(158, null, src),
    loadRoster(158, null, src),
    loadMinors(158, null, src),
  ])

test('the one-scroll page buys each shared read once', async () => {
  forgetLoads()
  const seen = await fired(() => loadPage(SHARED))
  for (const re of PAGE_READS) {
    const n = seen.filter((u) => re.test(u)).length
    assert.equal(n, 1, `${re} fetched ${n} times`)
  }
  forgetLoads()
})

test('the tab routes (no sources) still each buy their own copy', async () => {
  const seen = await fired(() => loadPage(undefined))
  assert.ok(seen.filter((u) => /\/schedule\?.*teamId=158/.test(u)).length > 1)
})
