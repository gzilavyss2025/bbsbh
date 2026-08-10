import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  prospectRankById,
  orgProspectRankById,
  prospectBadge,
  countProspectsByTeam,
  orgProspectsForTeam,
  prospectAffiliateMap,
  resolveCurrentLevels,
} from '../src/api/prospects.js'

const SNAPSHOT = {
  generatedAt: '2026-08-01',
  players: [{ playerId: 111, rank: 10 }],
  orgProspects: [
    { playerId: 111, orgRank: 3, teamId: 112, team: 'Cubs' },
    { playerId: 222, orgRank: 16, teamId: 139, team: 'Rays' },
  ],
}

// --- prospectRankById / orgProspectRankById ---------------------------------

test('prospectRankById returns the Top 100 rank for a known playerId', () => {
  assert.equal(prospectRankById(SNAPSHOT.players, 111), 10)
})

test('prospectRankById returns null for an unranked player', () => {
  assert.equal(prospectRankById(SNAPSHOT.players, 999), null)
})

test('orgProspectRankById returns the farm-system rank for a known playerId', () => {
  assert.equal(orgProspectRankById(SNAPSHOT.orgProspects, 222), 16)
})

// --- prospectBadge -----------------------------------------------------------

test('prospectBadge resolves org rank + team when no currentOrgTeamId is passed', () => {
  assert.deepEqual(prospectBadge(SNAPSHOT, 222), {
    rank: null,
    orgRank: 16,
    orgTeamId: 139,
    orgTeamName: 'Rays',
  })
})

test('prospectBadge keeps the org badge when currentOrgTeamId matches the snapshot row', () => {
  assert.deepEqual(prospectBadge(SNAPSHOT, 222, 139), {
    rank: null,
    orgRank: 16,
    orgTeamId: 139,
    orgTeamName: 'Rays',
  })
})

test('prospectBadge suppresses a stale org badge when currentOrgTeamId disagrees with the snapshot row (trade since the last scrape)', () => {
  // player 222 was scraped under the Rays (139) but has since been traded —
  // his current parent org is now team 146.
  assert.deepEqual(prospectBadge(SNAPSHOT, 222, 146), {
    rank: null,
    orgRank: null,
    orgTeamId: null,
    orgTeamName: null,
  })
})

test('prospectBadge is unaffected by currentOrgTeamId for a player unranked in orgProspects', () => {
  assert.deepEqual(prospectBadge(SNAPSHOT, 999, 146), {
    rank: null,
    orgRank: null,
    orgTeamId: null,
    orgTeamName: null,
  })
})

test('prospectBadge degrades to all-null fields on a missing/empty snapshot', () => {
  assert.deepEqual(prospectBadge(null, 111, 112), {
    rank: null,
    orgRank: null,
    orgTeamId: null,
    orgTeamName: null,
  })
})

// --- countProspectsByTeam ----------------------------------------------------

test('countProspectsByTeam counts ranked players per roster', () => {
  const rosterIdsByTeam = { 112: [111, 999], 139: [222] }
  const prospectPlayerIds = new Set([111, 222])
  assert.deepEqual(countProspectsByTeam(rosterIdsByTeam, prospectPlayerIds), { 112: 1, 139: 1 })
})

// --- orgProspectsForTeam -----------------------------------------------------

test('orgProspectsForTeam filters to one org and sorts by rank', () => {
  const orgProspects = [
    { playerId: 1, orgRank: 2, teamId: 112 },
    { playerId: 2, orgRank: 1, teamId: 112 },
    { playerId: 3, orgRank: 1, teamId: 139 },
  ]
  assert.deepEqual(
    orgProspectsForTeam(orgProspects, 112).map((p) => p.playerId),
    [2, 1],
  )
})

// --- prospectAffiliateMap -----------------------------------------------------

test('prospectAffiliateMap flips team->ids into playerId->teamId', () => {
  const map = prospectAffiliateMap({ 501: [1, 2], 502: [3] })
  assert.equal(map.get(1), 501)
  assert.equal(map.get(3), 502)
  assert.equal(map.get(999), undefined)
})

// ---------------------------------------------------------------------------
// resolveCurrentLevels — the /prospects "Level" column's live-roster
// resolution, PLUS the "Line" column's MLB/MiLB split (both now share one
// fetch of every org's season stats, so every test below mocks a stats route
// per team even when a case only cares about the Level result). Regression
// coverage for the "ALL (2)" bug: the scraped Pipeline snapshot's levelRaw
// string is ambiguous for any prospect who's played at more than one level
// this season, which is most of the board, since a young prospect typically
// opens in a complex/rookie league before his first full-season assignment.
// The original resolution only walked full-season AAA/AA/A+/A affiliates
// (fetchAffiliates), so a player whose CURRENT level was complex/rookie ball
// never resolved and fell straight back to the raw "ALL (2)" string. Every
// test mocks globalThis.fetch and restores it via t.after, same fetch-stub
// convention as test/team.test.js.
// ---------------------------------------------------------------------------

const BASE = 'https://statsapi.mlb.com'
const season = new Date().getFullYear()

function stubFetch(routes) {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (url) => {
    const hit = routes[url]
    if (!hit) throw new Error(`unexpected fetch: ${url}`)
    if (hit.fail) return { ok: false, status: hit.status ?? 404 }
    return { ok: true, status: 200, json: async () => hit.json }
  }
  return { restore: () => { globalThis.fetch = originalFetch } }
}

const rosterUrl = (teamId, rosterType) => `${BASE}/api/v1/teams/${teamId}/roster?rosterType=${rosterType}`
const affiliatesUrl = (teamId) =>
  `${BASE}/api/v1/teams/affiliates?teamIds=${teamId}&season=${season}&hydrate=venue(location)`
const complexAffiliatesUrl = (teamId) => `${BASE}/api/v1/teams/affiliates?teamIds=${teamId}&season=${season}`
const statsUrl = (teamId, group) =>
  `${BASE}/api/v1/stats?stats=season&group=${group}&season=${season}&teamId=${teamId}&playerPool=all&limit=5000`
const rosterEntry = (playerId) => ({ person: { id: playerId }, position: { abbreviation: 'SS' } })
const emptyStats = () => ({ json: { stats: [{ splits: [] }] } })
const teamsJsonRoute = { json: { generatedAt: null, bySportId: {} } }

// A hitting split shaped like the season-stats endpoint's, for one player at
// one team/level — the raw unit resolveCurrentLevels partitions by
// `sport.id` and re-sums with sumHitting/sumPitching (statsLevels.js).
function hitSplit(playerId, teamId, sportId, { atBats, hits, homeRuns, rbi }) {
  return {
    player: { id: playerId },
    team: { id: teamId },
    sport: { id: sportId },
    position: { abbreviation: 'SS' },
    stat: { atBats, hits, homeRuns, rbi, baseOnBalls: 0, hitByPitch: 0, strikeOuts: 0, sacFlies: 0, totalBases: hits },
  }
}
function pitSplit(playerId, teamId, sportId, { outs, earnedRuns, strikeOuts }) {
  return {
    player: { id: playerId },
    team: { id: teamId },
    sport: { id: sportId },
    position: { abbreviation: 'RHP' },
    stat: { outs, earnedRuns, strikeOuts, baseOnBalls: 0, hits: 0, atBats: 0, numberOfPitches: 0 },
  }
}

// MUST run before any other resolveCurrentLevels test in this file:
// fetchAffiliates's static-snapshot read (src/api/team.js) is memoized at
// module scope for the whole process, same trap team.test.js's own
// fetchAffiliates coverage documents. Failing it here once is what sends
// every later test's fetchAffiliates call straight to the live per-org URL
// instead of expecting a second read of the static file.
test('resolveCurrentLevels resolves a complex/rookie-level prospect, not the raw "ALL (n)" string', async (t) => {
  const { restore } = stubFetch({
    '/data/affiliates.json': { fail: true },
    [affiliatesUrl(900001)]: { json: { teams: [] } },
    [complexAffiliatesUrl(900001)]: {
      json: { teams: [{ id: 900010, name: 'Org ACL', sport: { id: 16 } }] },
    },
    [rosterUrl(900001, '40Man')]: { json: { roster: [] } },
    [rosterUrl(900010, '40Man')]: { json: { roster: [rosterEntry(700001)] } },
    [statsUrl(900001, 'hitting')]: emptyStats(),
    [statsUrl(900001, 'pitching')]: emptyStats(),
    [statsUrl(900010, 'hitting')]: emptyStats(),
    [statsUrl(900010, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 700001, teamId: 900001, levelRaw: 'ALL (2)' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, 'ROK')
})

test('resolveCurrentLevels still resolves a full-season-affiliate prospect the way it did before the complex-affiliate fix', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900002)]: {
      json: { teams: [{ id: 900020, name: 'Org AAA', sport: { id: 11 }, locationName: 'Somewhere' }] },
    },
    [complexAffiliatesUrl(900002)]: { json: { teams: [] } },
    [rosterUrl(900002, '40Man')]: { json: { roster: [] } },
    [rosterUrl(900020, '40Man')]: { json: { roster: [rosterEntry(700002)] } },
    [statsUrl(900002, 'hitting')]: emptyStats(),
    [statsUrl(900002, 'pitching')]: emptyStats(),
    [statsUrl(900020, 'hitting')]: emptyStats(),
    [statsUrl(900020, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 700002, teamId: 900002, levelRaw: 'AAA' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, 'AAA')
})

test('resolveCurrentLevels gives a prospect nothing resolves a dash-worthy null, never the raw "ALL (n)" string', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900003)]: { json: { teams: [] } },
    [complexAffiliatesUrl(900003)]: { json: { teams: [] } },
    [rosterUrl(900003, '40Man')]: { json: { roster: [] } },
    [statsUrl(900003, 'hitting')]: emptyStats(),
    [statsUrl(900003, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 700003, teamId: 900003, levelRaw: 'ALL (3)' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, null)
  assert.deepEqual(resolved.lines, [])
})

test('resolveCurrentLevels keeps a non-"ALL" scraped level as-is when nothing resolves (it was never ambiguous)', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900004)]: { json: { teams: [] } },
    [complexAffiliatesUrl(900004)]: { json: { teams: [] } },
    [rosterUrl(900004, '40Man')]: { json: { roster: [] } },
    [statsUrl(900004, 'hitting')]: emptyStats(),
    [statsUrl(900004, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 700004, teamId: 900004, levelRaw: 'AA' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, 'AA')
})

test('resolveCurrentLevels degrades to the scraped statLine, unprefixed, when live stats resolve to nothing', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900009)]: { json: { teams: [] } },
    [complexAffiliatesUrl(900009)]: { json: { teams: [] } },
    [rosterUrl(900009, '40Man')]: { json: { roster: [] } },
    [statsUrl(900009, 'hitting')]: emptyStats(),
    [statsUrl(900009, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 700009, teamId: 900009, levelRaw: 'AA', statLine: '.250, 2 HR, 10 RBI' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.deepEqual(resolved.lines, ['.250, 2 HR, 10 RBI'])
})

// --- resolveCurrentLevels: the "Line" column's MLB/MiLB split --------------

test('resolveCurrentLevels shows a (MLB)/(MiLB) pair when a hitter currently in the majors has a line at both this season', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900005)]: {
      json: { teams: [{ id: 900050, name: 'Org AAA', sport: { id: 11 }, locationName: 'Somewhere' }] },
    },
    [complexAffiliatesUrl(900005)]: { json: { teams: [] } },
    [rosterUrl(900005, '40Man')]: { json: { roster: [rosterEntry(800001)] } },
    [rosterUrl(900050, '40Man')]: { json: { roster: [] } },
    [statsUrl(900005, 'hitting')]: {
      json: { stats: [{ splits: [hitSplit(800001, 900005, 1, { atBats: 100, hits: 30, homeRuns: 5, rbi: 20 })] }] },
    },
    [statsUrl(900005, 'pitching')]: emptyStats(),
    [statsUrl(900050, 'hitting')]: {
      json: { stats: [{ splits: [hitSplit(800001, 900050, 11, { atBats: 50, hits: 20, homeRuns: 3, rbi: 10 })] }] },
    },
    [statsUrl(900050, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 800001, teamId: 900005, levelRaw: 'ALL (2)', position: 'SS' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, 'MLB')
  assert.deepEqual(resolved.lines, ['(MLB) .300, 5 HR, 20 RBI', '(MiLB) .400, 3 HR, 10 RBI'])
})

test('resolveCurrentLevels drops the MLB line for a hitter who has since been optioned back to the minors', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900006)]: {
      json: { teams: [{ id: 900060, name: 'Org AAA', sport: { id: 11 }, locationName: 'Somewhere' }] },
    },
    [complexAffiliatesUrl(900006)]: { json: { teams: [] } },
    [rosterUrl(900006, '40Man')]: { json: { roster: [] } },
    [rosterUrl(900060, '40Man')]: { json: { roster: [rosterEntry(800002)] } },
    [statsUrl(900006, 'hitting')]: {
      json: { stats: [{ splits: [hitSplit(800002, 900006, 1, { atBats: 40, hits: 8, homeRuns: 1, rbi: 4 })] }] },
    },
    [statsUrl(900006, 'pitching')]: emptyStats(),
    [statsUrl(900060, 'hitting')]: {
      json: { stats: [{ splits: [hitSplit(800002, 900060, 11, { atBats: 200, hits: 60, homeRuns: 10, rbi: 40 })] }] },
    },
    [statsUrl(900060, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 800002, teamId: 900006, levelRaw: 'ALL (2)', position: 'SS' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, 'AAA')
  // A partial-season MLB cameo would otherwise print alongside his current
  // AAA line — dropped rather than shown, since he isn't in the majors now.
  assert.deepEqual(resolved.lines, ['.300, 10 HR, 40 RBI'])
})

test('resolveCurrentLevels prints a pitcher\'s (MLB)/(MiLB) split as IP/ERA/SO, not AVG/HR/RBI', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900007)]: {
      json: { teams: [{ id: 900070, name: 'Org AAA', sport: { id: 11 }, locationName: 'Somewhere' }] },
    },
    [complexAffiliatesUrl(900007)]: { json: { teams: [] } },
    [rosterUrl(900007, '40Man')]: { json: { roster: [rosterEntry(800003)] } },
    [rosterUrl(900070, '40Man')]: { json: { roster: [] } },
    [statsUrl(900007, 'hitting')]: emptyStats(),
    [statsUrl(900007, 'pitching')]: {
      json: { stats: [{ splits: [pitSplit(800003, 900007, 1, { outs: 60, earnedRuns: 10, strikeOuts: 25 })] }] },
    },
    [statsUrl(900070, 'hitting')]: emptyStats(),
    [statsUrl(900070, 'pitching')]: {
      json: { stats: [{ splits: [pitSplit(800003, 900070, 11, { outs: 90, earnedRuns: 12, strikeOuts: 40 })] }] },
    },
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 800003, teamId: 900007, levelRaw: 'ALL (2)', position: 'RHP' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, 'MLB')
  // 60 outs = 20.0 IP, ERA = 10*9/20 = 4.50; 90 outs = 30.0 IP, ERA = 12*9/30 = 3.60.
  assert.deepEqual(resolved.lines, ['(MLB) 20.0 IP, 4.50 ERA, 25 SO', '(MiLB) 30.0 IP, 3.60 ERA, 40 SO'])
})

test('resolveCurrentLevels prints one unprefixed line for a hitter with a season only in the minors', async (t) => {
  const { restore } = stubFetch({
    [affiliatesUrl(900008)]: {
      json: { teams: [{ id: 900080, name: 'Org AA', sport: { id: 12 }, locationName: 'Somewhere' }] },
    },
    [complexAffiliatesUrl(900008)]: { json: { teams: [] } },
    [rosterUrl(900008, '40Man')]: { json: { roster: [] } },
    [rosterUrl(900080, '40Man')]: { json: { roster: [rosterEntry(800004)] } },
    [statsUrl(900008, 'hitting')]: emptyStats(),
    [statsUrl(900008, 'pitching')]: emptyStats(),
    [statsUrl(900080, 'hitting')]: {
      json: { stats: [{ splits: [hitSplit(800004, 900080, 12, { atBats: 300, hits: 90, homeRuns: 15, rbi: 55 })] }] },
    },
    [statsUrl(900080, 'pitching')]: emptyStats(),
    '/data/teams.json': teamsJsonRoute,
  })
  t.after(restore)

  const players = [{ playerId: 800004, teamId: 900008, levelRaw: 'AA', position: 'OF' }]
  const [resolved] = await resolveCurrentLevels(players)
  assert.equal(resolved.levelLabel, 'AA')
  assert.deepEqual(resolved.lines, ['.300, 15 HR, 55 RBI'])
})
