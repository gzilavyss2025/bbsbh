// The player page's Postseason stats card: one row per October a player reached, newest
// first, plus a career line. The register above it (careerRegister.js) is regular
// season only, so without this card a player's October never shows in a table.
//
// Shapes below are real `stats=yearByYear&gameType=P` rows (Aaron Judge, checked live
// 2026-10-05): one row per postseason year, every round folded together, each row's
// own gameType 'P'. The career line is `stats=career&gameType=P`.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchPostseasonRegister, postseasonRegisterView } from '../src/api/player/postseasonRegister.js'

const hit = (season, teamId, stat) => ({
  season: String(season),
  gameType: 'P',
  team: { id: teamId, name: `Club ${teamId}` },
  stat: { gamesPlayed: 5, atBats: 20, avg: '.250', homeRuns: 1, rbi: 3, ...stat },
})

const YBY = [hit(2022, 147, { gamesPlayed: 9, avg: '.139' }), hit(2025, 147, { gamesPlayed: 7, avg: '.500' })]
const CAREER = { gamesPlayed: 65, atBats: 220, avg: '.236', homeRuns: 17, rbi: 40 }

test('rows run newest season first, in the hitter register columns', () => {
  const v = postseasonRegisterView({ yby: YBY, career: CAREER, group: 'hitting' })
  assert.deepEqual(v.columns, ['G', 'AB', 'AVG', 'HR', 'RBI'])
  assert.deepEqual(v.rows.map((r) => r.year), [2025, 2022])
  assert.deepEqual(v.rows[0].cells, [7, 20, '.500', 1, 3])
})

test('the footer is the career postseason line from the API', () => {
  const v = postseasonRegisterView({ yby: YBY, career: CAREER, group: 'hitting' })
  assert.equal(v.totals.length, 1)
  assert.equal(v.totals[0].label, 'Postseason')
  assert.deepEqual(v.totals[0].cells, [65, 220, '.236', 17, 40])
})

test('a pitcher gets the pitching columns, W–L by default', () => {
  const p = {
    season: '2025', gameType: 'P', team: { id: 116, name: 'Detroit Tigers' },
    stat: { gamesPlayed: 2, gamesStarted: 2, wins: 1, losses: 0, saves: 0, era: '1.50', inningsPitched: '12.0', strikeOuts: 15, baseOnBalls: 2, whip: '0.75' },
  }
  const v = postseasonRegisterView({ yby: [p], career: p.stat, group: 'pitching' })
  assert.deepEqual(v.columns, ['G', 'GS', 'W–L', 'ERA', 'IP', 'K', 'BB', 'WHIP'])
  assert.deepEqual(v.rows[0].cells, [2, 2, '1–0', '1.50', '12.0', 15, 2, '0.75'])
})

test('a player with no postseason has no card', () => {
  assert.equal(postseasonRegisterView({ yby: [], career: null, group: 'hitting' }), null)
  assert.equal(postseasonRegisterView({ yby: null, career: null, group: 'hitting' }), null)
})

test('one season with one row has no footer to restate it', () => {
  const v = postseasonRegisterView({ yby: [YBY[0]], career: YBY[0].stat, group: 'hitting' })
  assert.equal(v.rows.length, 1)
  assert.deepEqual(v.totals, [])
})

test('a dated page drops that season and later, and foots the rows it keeps', () => {
  const rows = [hit(2020, 147, { gamesPlayed: 4 }), ...YBY]
  const v = postseasonRegisterView({ yby: rows, career: CAREER, group: 'hitting', asOf: '2025-09-20' })
  assert.deepEqual(v.rows.map((r) => r.year), [2022, 2020])
  // the API career line (65 G) still includes 2025, so it must not be the footer
  assert.equal(v.totals[0].cells[0], 13)
})

test('a dated page with one season left has no footer', () => {
  const v = postseasonRegisterView({ yby: YBY, career: CAREER, group: 'hitting', asOf: '2025-09-20' })
  assert.deepEqual(v.rows.map((r) => r.year), [2022])
  assert.deepEqual(v.totals, [])
})

test('a traded-in-October player gets a row per club for the year', () => {
  const v = postseasonRegisterView({
    yby: [hit(2024, 111, { gamesPlayed: 2 }), hit(2024, 222, { gamesPlayed: 4 })],
    career: CAREER,
    group: 'hitting',
  })
  assert.deepEqual(v.rows.map((r) => [r.year, r.teamIds]), [[2024, [111]], [2024, [222]]])
})

test('it asks for gameType=P at the MLB level, year by year and career', async () => {
  const calls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => ({ stats: [{ splits: [] }] }) }
  })
  try {
    await fetchPostseasonRegister(592450, 'hitting')
  } finally {
    fetchMock.mock.restore()
  }
  assert.equal(calls.length, 2)
  assert.ok(calls.some((u) => /stats=yearByYear/.test(u) && /gameType=P/.test(u)))
  assert.ok(calls.some((u) => /stats=career/.test(u) && /gameType=P/.test(u)))
  assert.ok(calls.every((u) => /group=hitting/.test(u) && !/sportId=/.test(u)))
})

test('a player who never debuted asks nothing', async () => {
  const calls = []
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    calls.push(String(url))
    return { ok: true, status: 200, json: async () => ({ stats: [] }) }
  })
  try {
    const out = await fetchPostseasonRegister(1, 'hitting', { hasDebuted: false })
    assert.equal(out, null)
  } finally {
    fetchMock.mock.restore()
  }
  assert.deepEqual(calls, [])
})
