// Coverage for src/api/team.js — team identity, roster, affiliates, standings,
// and ranked team stats. Every export here fetches (either the static weekly
// snapshot or a live statsapi endpoint), so each test mocks globalThis.fetch
// and restores it in a finally block, same convention as test/jerseys.test.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchTeam,
  fetchTeamRoster,
  fetchTeamIL,
  fetchTeamRosterEntries,
  fetchTeamRosterIds,
  fetchRosterIdsForTeams,
  fetchRosterEntriesForTeams,
  fetchAffiliates,
  fetchComplexAffiliates,
  fetchStandings,
  fetchLeagueStandings,
  fetchLeagueTeamStats,
} from '../src/api/team.js'

// A fetch stub keyed by exact URL match, so each test only has to describe the
// requests it actually expects; anything unlisted throws loudly instead of
// hanging, so a wiring mistake fails fast.
function stubFetch(routes) {
  const originalFetch = globalThis.fetch
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    const hit = routes[url]
    if (!hit) throw new Error(`unexpected fetch: ${url}`)
    // 404 (not one of statsapi.js's RETRYABLE_STATUS) so a failure fetches
    // exactly once instead of retrying with a delay.
    if (hit.fail) return { ok: false, status: hit.status ?? 404 }
    return { ok: true, status: 200, json: async () => hit.json }
  }
  return { calls, restore: () => { globalThis.fetch = originalFetch } }
}

// --------------------------------------------------------------------------
// fetchTeam
// --------------------------------------------------------------------------
test('fetchTeam is null with no teamId', async () => {
  assert.equal(await fetchTeam(null), null)
})

test('fetchTeam falls back to the live endpoint when the id isn\'t in the static snapshot', async () => {
  const { calls, restore } = stubFetch({
    '/data/teams.json': { json: { generatedAt: '2026-01-01', bySportId: { 1: [] } } },
    'https://statsapi.mlb.com/api/v1/teams/9999': {
      json: { teams: [{ id: 9999, name: 'Expansion Club' }] },
    },
  })
  try {
    const team = await fetchTeam(9999)
    assert.equal(team.name, 'Expansion Club')
    assert.ok(calls.some((u) => u.includes('/teams/9999')))
  } finally {
    restore()
  }
})

test('fetchTeam degrades to null when the live fallback also fails', async () => {
  const { restore } = stubFetch({
    '/data/teams.json': { json: { generatedAt: null, bySportId: {} } },
    'https://statsapi.mlb.com/api/v1/teams/12345': { fail: true },
  })
  try {
    assert.equal(await fetchTeam(12345), null)
  } finally {
    restore()
  }
})

// --------------------------------------------------------------------------
// fetchTeamRoster — hydrated roster + short-TTL session cache keyed by
// teamId:season:sportId:rosterType
// --------------------------------------------------------------------------
test('fetchTeamRoster is [] with no teamId or season', async () => {
  assert.deepEqual(await fetchTeamRoster(null, 2026), [])
  assert.deepEqual(await fetchTeamRoster(158, null), [])
})

test('fetchTeamRoster fetches once and reuses the cache for the same key', async () => {
  const url =
    '/api/v1/teams/158/roster?rosterType=active&hydrate=person(stats(type=season,group=[hitting,pitching,fielding],sportId=1,season=2026))'
  const { calls, restore } = stubFetch({
    [`https://statsapi.mlb.com${url}`]: { json: { roster: [{ person: { id: 1 } }] } },
  })
  try {
    const first = await fetchTeamRoster(158, 2026)
    const second = await fetchTeamRoster(158, 2026)
    assert.deepEqual(first, [{ person: { id: 1 } }])
    assert.equal(second, first)
    assert.equal(calls.length, 1)
  } finally {
    restore()
  }
})

test('fetchTeamRoster passes a MiLB club\'s own sportId rather than defaulting to MLB', async () => {
  const url =
    'https://statsapi.mlb.com/api/v1/teams/446/roster?rosterType=40Man&hydrate=person(stats(type=season,group=[hitting,pitching,fielding],sportId=11,season=2026))'
  const { restore } = stubFetch({ [url]: { json: { roster: [] } } })
  try {
    await fetchTeamRoster(446, 2026, { sportId: 11, rosterType: '40Man' })
  } finally {
    restore()
  }
})

test('fetchTeamRoster degrades to [] on failure and does not cache the failure', async () => {
  const url = 'https://statsapi.mlb.com/api/v1/teams/777/roster?rosterType=active&hydrate=person(stats(type=season,group=[hitting,pitching,fielding],sportId=1,season=2027))'
  const { calls, restore } = stubFetch({ [url]: { fail: true } })
  try {
    assert.deepEqual(await fetchTeamRoster(777, 2027), [])
    assert.deepEqual(await fetchTeamRoster(777, 2027), [])
    assert.equal(calls.length, 2) // failure isn't cached, so it's refetched
  } finally {
    restore()
  }
})

// --------------------------------------------------------------------------
// fetchTeamIL
// --------------------------------------------------------------------------
test('fetchTeamIL is [] with no teamId or season, and degrades on failure', async () => {
  assert.deepEqual(await fetchTeamIL(null, 2026), [])
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/158/roster?rosterType=40Man&season=2029': { fail: true },
  })
  try {
    assert.deepEqual(await fetchTeamIL(158, 2029), [])
  } finally {
    restore()
  }
})

test('fetchTeamIL returns the 40-man roster view', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/158/roster?rosterType=40Man&season=2026': {
      json: { roster: [{ person: { id: 2 }, status: { code: 'D10' } }] },
    },
  })
  try {
    const il = await fetchTeamIL(158, 2026)
    assert.equal(il[0].status.code, 'D10')
  } finally {
    restore()
  }
})

// --------------------------------------------------------------------------
// fetchTeamRosterEntries / fetchTeamRosterIds
// --------------------------------------------------------------------------
test('fetchTeamRosterEntries maps person id + primary position abbreviation, dropping entries with no person', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/158/roster?rosterType=active': {
      json: {
        roster: [
          { person: { id: 1 }, position: { abbreviation: 'SS' } },
          { person: { id: 2 } }, // no position -> ''
          { position: {} }, // no person -> dropped
        ],
      },
    },
  })
  try {
    assert.deepEqual(await fetchTeamRosterEntries(158), [
      { id: 1, position: 'SS' },
      { id: 2, position: '' },
    ])
  } finally {
    restore()
  }
})

test('fetchTeamRosterEntries is [] with no teamId', async () => {
  assert.deepEqual(await fetchTeamRosterEntries(null), [])
})

test('fetchTeamRosterIds derives ids from the shared entries cache and degrades to [] on failure', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/999/roster?rosterType=active': { fail: true },
  })
  try {
    assert.deepEqual(await fetchTeamRosterIds(999), [])
  } finally {
    restore()
  }
  const { restore: restore2 } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/158/roster?rosterType=40Man': {
      json: { roster: [{ person: { id: 5 }, position: { abbreviation: '1B' } }] },
    },
  })
  try {
    assert.deepEqual(await fetchTeamRosterIds(158, '40Man'), [5])
  } finally {
    restore2()
  }
})

// --------------------------------------------------------------------------
// fetchRosterIdsForTeams / fetchRosterEntriesForTeams — fan-out helpers
// --------------------------------------------------------------------------
test('fetchRosterIdsForTeams degrades per-team on a partial failure', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/501/roster?rosterType=active': {
      json: { roster: [{ person: { id: 10 } }] },
    },
    'https://statsapi.mlb.com/api/v1/teams/502/roster?rosterType=active': { fail: true },
  })
  try {
    const out = await fetchRosterIdsForTeams([501, 502])
    assert.deepEqual(out, { 501: [10], 502: [] })
  } finally {
    restore()
  }
})

test('fetchRosterEntriesForTeams degrades per-team, but rethrows when every team failed', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/601/roster?rosterType=active': {
      json: { roster: [{ person: { id: 11 }, position: { abbreviation: 'C' } }] },
    },
    'https://statsapi.mlb.com/api/v1/teams/602/roster?rosterType=active': { fail: true },
  })
  try {
    const out = await fetchRosterEntriesForTeams([601, 602])
    assert.deepEqual(out, { 601: [{ id: 11, position: 'C' }], 602: [] })
  } finally {
    restore()
  }

  const { restore: restore2 } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/701/roster?rosterType=active': { fail: true },
    'https://statsapi.mlb.com/api/v1/teams/702/roster?rosterType=active': { fail: true },
  })
  try {
    await assert.rejects(() => fetchRosterEntriesForTeams([701, 702]))
  } finally {
    restore2()
  }
})

// --------------------------------------------------------------------------
// fetchAffiliates
// --------------------------------------------------------------------------
test('fetchAffiliates is [] with no teamId or season', async () => {
  assert.deepEqual(await fetchAffiliates(null, 2026), [])
  assert.deepEqual(await fetchAffiliates(158, null), [])
})

// This one MUST run before any other fetchAffiliates test: fetchStaticAffiliates
// caches the parsed static file in a module-level singleton (like
// fetchStaticTeams/fetchWarData), so it's the only test allowed to determine
// what that cache holds for the rest of this suite.
test('fetchAffiliates reads the static snapshot when it covers the season, skipping the live call', async () => {
  const { calls, restore } = stubFetch({
    '/data/affiliates.json': {
      json: { season: 2026, byOrgId: { 158: [{ id: 341, name: 'Nashville Sounds' }] } },
    },
  })
  try {
    const affiliates = await fetchAffiliates(158, 2026)
    assert.deepEqual(affiliates, [{ id: 341, name: 'Nashville Sounds' }])
    assert.equal(calls.length, 1) // only the static file, no live fallback
  } finally {
    restore()
  }
})

// Every test below asks for a season other than 2026 (or a team the cached
// snapshot above doesn't cover), so the season check sends it to the live
// endpoint regardless of the now-cached static payload.
test('fetchAffiliates falls back to the live endpoint, filtering to full-season farm levels and sorting highest level first', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/affiliates?teamIds=8100&season=2099&hydrate=venue(location)': {
      json: {
        teams: [
          { id: 8100, sport: { id: 1 } }, // itself -> excluded
          { id: 8101, name: 'AA Club', sport: { id: 12 }, venue: { location: { city: 'Biloxi', state: 'MS' } } },
          { id: 8102, name: 'AAA Club', sport: { id: 11 }, locationName: 'Nashville' },
          { id: 8103, name: 'Complex Club', sport: { id: 16 } }, // ROK -> excluded here
        ],
      },
    },
  })
  try {
    const affiliates = await fetchAffiliates(8100, 2099)
    assert.deepEqual(affiliates.map((a) => a.id), [8102, 8101]) // AAA (11) before AA (12)
    assert.equal(affiliates[0].city, 'Nashville')
    assert.equal(affiliates[1].city, 'Biloxi')
  } finally {
    restore()
  }
})

test('fetchAffiliates degrades to [] when the live fallback fails', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/affiliates?teamIds=9100&season=2098&hydrate=venue(location)': { fail: true },
  })
  try {
    assert.deepEqual(await fetchAffiliates(9100, 2098), [])
  } finally {
    restore()
  }
})

// --------------------------------------------------------------------------
// fetchComplexAffiliates
// --------------------------------------------------------------------------
test('fetchComplexAffiliates is [] with no teamId/season, and keeps only ROK-level (sportId 16) clubs', async () => {
  assert.deepEqual(await fetchComplexAffiliates(null, 2026), [])
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/affiliates?teamIds=158&season=2026': {
      json: {
        teams: [
          { id: 158, sport: { id: 1 } },
          { id: 9001, name: 'ACL Brewers', sport: { id: 16 } },
          { id: 341, name: 'Nashville Sounds', sport: { id: 11 } },
        ],
      },
    },
  })
  try {
    const rok = await fetchComplexAffiliates(158, 2026)
    assert.deepEqual(rok, [{ id: 9001, name: 'ACL Brewers', sportId: 16 }])
  } finally {
    restore()
  }
})

test('fetchComplexAffiliates degrades to [] on failure', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/teams/affiliates?teamIds=999&season=2026': { fail: true },
  })
  try {
    assert.deepEqual(await fetchComplexAffiliates(999, 2026), [])
  } finally {
    restore()
  }
})

// --------------------------------------------------------------------------
// fetchStandings — dated responses are cached (immutable fact about a past
// day); a falsy date always refetches (today's still-moving standings).
// --------------------------------------------------------------------------
test('fetchStandings is [] with no leagueId or season', async () => {
  assert.deepEqual(await fetchStandings(null, 2026, '2026-06-01'), [])
})

test('fetchStandings caches a dated response but always refetches when date is falsy', async () => {
  const datedUrl = 'https://statsapi.mlb.com/api/v1/standings?leagueId=103&season=2026&standingsTypes=regularSeason&date=2026-06-01'
  const liveUrl = 'https://statsapi.mlb.com/api/v1/standings?leagueId=103&season=2026&standingsTypes=regularSeason'
  const { calls, restore } = stubFetch({
    [datedUrl]: { json: { records: [{ team: { id: 1 } }] } },
    [liveUrl]: { json: { records: [{ team: { id: 2 } }] } },
  })
  try {
    await fetchStandings(103, 2026, '2026-06-01')
    await fetchStandings(103, 2026, '2026-06-01') // cached, no second dated call
    await fetchStandings(103, 2026, null) // live: always fetched
    await fetchStandings(103, 2026, null)
    assert.equal(calls.filter((u) => u === datedUrl).length, 1)
    assert.equal(calls.filter((u) => u === liveUrl).length, 2)
  } finally {
    restore()
  }
})

test('fetchStandings folds in an optional hydrate param and degrades to [] on failure', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/standings?leagueId=104&season=2027&standingsTypes=regularSeason&date=2027-05-01&hydrate=division': { fail: true },
  })
  try {
    assert.deepEqual(await fetchStandings(104, 2027, '2027-05-01', 'division'), [])
  } finally {
    restore()
  }
})

// --------------------------------------------------------------------------
// fetchLeagueStandings — fans out AL (103) + NL (104) in parallel
// --------------------------------------------------------------------------
test('fetchLeagueStandings is [] with no season', async () => {
  assert.deepEqual(await fetchLeagueStandings(null, '2026-06-02'), [])
})

test('fetchLeagueStandings flattens both leagues, degrading per-league on failure', async () => {
  const { restore } = stubFetch({
    'https://statsapi.mlb.com/api/v1/standings?leagueId=103&season=2050&standingsTypes=regularSeason&date=2050-06-02&hydrate=division': {
      json: { records: [{ league: { id: 103 } }] },
    },
    'https://statsapi.mlb.com/api/v1/standings?leagueId=104&season=2050&standingsTypes=regularSeason&date=2050-06-02&hydrate=division': { fail: true },
  })
  try {
    const records = await fetchLeagueStandings(2050, '2050-06-02')
    assert.deepEqual(records, [{ league: { id: 103 } }])
  } finally {
    restore()
  }
})

// --------------------------------------------------------------------------
// fetchLeagueTeamStats — league-wide hitting+pitching totals, TTL-cached per
// season; a failed group isn't cached.
// --------------------------------------------------------------------------
test('fetchLeagueTeamStats is empty hitting/pitching arrays with no season', async () => {
  assert.deepEqual(await fetchLeagueTeamStats(null), { hitting: [], pitching: [] })
})

test('fetchLeagueTeamStats fetches both groups once and reuses the cache for the same season', async () => {
  const hittingUrl = 'https://statsapi.mlb.com/api/v1/teams/stats?season=2031&sportIds=1&group=hitting&stats=season'
  const pitchingUrl = 'https://statsapi.mlb.com/api/v1/teams/stats?season=2031&sportIds=1&group=pitching&stats=season'
  const { calls, restore } = stubFetch({
    [hittingUrl]: { json: { stats: [{ splits: [{ team: { id: 1 }, stat: { avg: '.300' } }] }] } },
    [pitchingUrl]: { json: { stats: [{ splits: [{ team: { id: 1 }, stat: { era: '3.50' } }] }] } },
  })
  try {
    const first = await fetchLeagueTeamStats(2031)
    assert.deepEqual(first.hitting, [{ teamId: 1, stat: { avg: '.300' } }])
    assert.deepEqual(first.pitching, [{ teamId: 1, stat: { era: '3.50' } }])
    const second = await fetchLeagueTeamStats(2031)
    assert.equal(second, first)
    assert.equal(calls.length, 2) // one per group, not refetched on the second call
  } finally {
    restore()
  }
})

test('fetchLeagueTeamStats does not cache a season where a group failed', async () => {
  const hittingUrl = 'https://statsapi.mlb.com/api/v1/teams/stats?season=2032&sportIds=1&group=hitting&stats=season'
  const pitchingUrl = 'https://statsapi.mlb.com/api/v1/teams/stats?season=2032&sportIds=1&group=pitching&stats=season'
  const { calls, restore } = stubFetch({
    [hittingUrl]: { fail: true },
    [pitchingUrl]: { json: { stats: [{ splits: [] }] } },
  })
  try {
    const first = await fetchLeagueTeamStats(2032)
    assert.deepEqual(first, { hitting: [], pitching: [] })
    await fetchLeagueTeamStats(2032) // refetched since the failed group wasn't cached
    assert.equal(calls.length, 4)
  } finally {
    restore()
  }
})
