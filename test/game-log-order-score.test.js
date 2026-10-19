// The Stats tab's game log (#1914, #1915): doubleheader order, the league on a
// postseason round, and the final score joined on gamePk behind the cutoff.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { gameLogView } from '../src/api/person/gameLog.js'
import { seriesAbbr } from '../src/api/boxlines/rows.js'
import { fetchFinalScores } from '../src/api/boxlines/fetch.js'

const row = (date, gamePk, gameNumber = 1, extra = {}) => ({
  date,
  gameType: 'R',
  isHome: true,
  team: { id: 158 },
  league: { id: 104 },
  opponent: { id: 112, teamName: 'Cubs' },
  game: { gamePk, gameNumber },
  stat: { hits: 1, atBats: 4 },
  ...extra,
})

test('gameLogView: a doubleheader reads game 2 above game 1, whatever the gamePks say', () => {
  // Turang 2026-07-11: game 1 is 823357, game 2 is 823356 (the lower gamePk).
  const splits = [row('2026-07-10', 1), row('2026-07-11', 823357, 1), row('2026-07-11', 823356, 2)]
  for (const input of [splits, [...splits].reverse()]) {
    assert.deepEqual(gameLogView(input, 'hitting', null, 8).rows.map((r) => r.gamePk), [823356, 823357, 1])
  }
})

test('gameLogView: one date, one game number, the higher gamePk first', () => {
  for (const input of [[row('2026-07-11', 5), row('2026-07-11', 9)], [row('2026-07-11', 9), row('2026-07-11', 5)]]) {
    assert.deepEqual(gameLogView(input, 'hitting', null, 8).rows.map((r) => r.gamePk), [9, 5])
  }
})

test('seriesAbbr: a league puts AL or NL before the round; the World Series stays WS', () => {
  assert.equal(seriesAbbr('F', 'AL'), 'ALWC')
  assert.equal(seriesAbbr('D', 'NL'), 'NLDS')
  assert.equal(seriesAbbr('L', 'NL'), 'NLCS')
  assert.equal(seriesAbbr('W', 'AL'), 'WS')
  assert.equal(seriesAbbr('R', 'NL'), '')
  assert.equal(seriesAbbr('D'), 'DS')
})

test('gameLogView: a postseason row names its league from the split', () => {
  const view = gameLogView(
    [row('2026-10-05', 1, 1, { gameType: 'D' }), row('2026-10-12', 2, 1, { gameType: 'L', league: { id: 103 } })],
    'hitting',
    null,
    8,
  )
  assert.deepEqual(view.rows.map((r) => r.series), ['ALCS', 'NLDS'])
})

test('gameLogView: a row joins its final score on gamePk; no scores, no score', () => {
  const scores = new Map([[1, { won: true, runs: 5, oppRuns: 3 }]])
  const [scored, bare] = gameLogView([row('2026-05-23', 1), row('2026-05-22', 2)], 'hitting', null, 8, { scores }).rows
  assert.deepEqual([scored.result, scored.runs, scored.oppRuns], ['W', 5, 3])
  assert.deepEqual([bare.result, bare.runs, bare.oppRuns], [null, null, null])
  assert.equal(gameLogView([row('2026-05-23', 1)], 'hitting', null, 8).rows[0].result, null)
})

test('gameLogView: a tied final reads T, not L', () => {
  const scores = new Map([[1, { won: false, runs: 1, oppRuns: 1 }]])
  assert.equal(gameLogView([row('2016-09-29', 1)], 'hitting', null, 8, { scores }).rows[0].result, 'T')
})

test("gameLogView: a pitcher's row wears his own decision, and a no-decision wears none", () => {
  const scores = new Map([[1, { won: true, runs: 7, oppRuns: 4 }], [2, { won: true, runs: 3, oppRuns: 2 }], [3, { won: false, runs: 2, oppRuns: 5 }]])
  const arm = (date, pk, stat) => row(date, pk, 1, { stat: { gamesStarted: 1, inningsPitched: '5.0', ...stat } })
  const rows = gameLogView(
    [arm('2026-09-03', 1, {}), arm('2026-09-02', 2, { saves: 1 }), arm('2026-09-01', 3, { losses: 1 })],
    'pitching', null, 6, { scores },
  ).rows
  assert.deepEqual(rows.map((r) => [r.result, r.runs, r.oppRuns]), [[null, 7, 4], ['SV', 3, 2], ['L', 2, 5]])
})

// The schedule, stubbed: every gamePk asked for comes back Final, MIL home 6-2.
function stubSchedule(extra = {}) {
  const asked = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    const pks = (String(url).match(/gamePks=([\d,]+)/)?.[1] ?? '').split(',').map(Number)
    asked.push(...pks)
    const games = pks.map((gamePk) => ({
      gamePk,
      status: { abstractGameState: 'Final' },
      teams: { away: { score: 2, team: { id: 112 } }, home: { score: 6, team: { id: 158 } } },
      ...extra[gamePk],
    }))
    return { ok: true, status: 200, json: async () => ({ dates: [{ games }] }) }
  })
  return { asked, restore: () => m.mock.restore() }
}

test('fetchFinalScores: no score is asked for at or after the cutoff, a same-day game 1 included', async () => {
  const api = stubSchedule()
  try {
    const splits = [row('2026-05-22', 101), row('2026-05-23', 102, 1), row('2026-05-23', 103, 2), row('2026-05-24', 104)]
    const scores = await fetchFinalScores(splits, 'hitting', '2026-05-23')
    assert.deepEqual(api.asked, [101])
    assert.deepEqual([...scores.keys()], [101])
    assert.deepEqual([scores.get(101).won, scores.get(101).runs, scores.get(101).oppRuns], [true, 6, 2])
  } finally {
    api.restore()
  }
})

test('fetchFinalScores: nothing before the cutoff asks nothing', async () => {
  const api = stubSchedule()
  try {
    const scores = await fetchFinalScores([row('2026-05-23', 102)], 'pitching', '2026-05-23')
    assert.deepEqual(api.asked, [])
    assert.equal(scores.size, 0)
  } finally {
    api.restore()
  }
})

test("fetchFinalScores: with no cutoff, today's games are asked for and show their score once Final (ADR-0117)", async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-13T20:00:00Z') }) // 13:00 Pacific on 2026-10-13: the day the rows are dated
  const api = stubSchedule()
  try {
    const splits = [row('2026-10-12', 201), row('2026-10-13', 202, 1), row('2026-10-13', 203, 2)]
    const scores = await fetchFinalScores(splits, 'hitting', null)
    assert.deepEqual(api.asked, [201, 202, 203])
    assert.deepEqual([...scores.keys()].sort(), [201, 202, 203])
    const view = gameLogView(splits, 'hitting', null, 8, { scores }).rows
    assert.deepEqual(view.map((r) => [r.gamePk, r.result, r.runs]), [[203, 'W', 6], [202, 'W', 6], [201, 'W', 6]])
  } finally {
    api.restore()
    mock.timers.reset()
  }
})

test('fetchFinalScores: a suspended game that ends today shows its score, though its split keeps the first day', async () => {
  mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-13T20:00:00Z') }) // 13:00 Pacific on 2026-10-13: the day the rows are dated
  // Shaped like gamePk 777861: suspended 2025-05-19, finished 2025-05-21. The
  // split and officialDate keep 05-19; only the schedule's resumeDate says 05-21.
  const api = stubSchedule({
    301: { officialDate: '2026-10-11', resumeDate: '2026-10-13T17:10:00Z' },
    302: { officialDate: '2026-10-10', resumeDate: '2026-10-12T17:10:00Z' },
  })
  try {
    const scores = await fetchFinalScores([row('2026-10-11', 301), row('2026-10-10', 302)], 'hitting', null)
    assert.deepEqual([...scores.keys()].sort(), [301, 302])
  } finally {
    api.restore()
    mock.timers.reset()
  }
})

test('fetchFinalScores: a ?d= cutoff still turns its day and later days away', async () => {
  const api = stubSchedule()
  try {
    await fetchFinalScores([row('2026-05-22', 101), row('2026-06-01', 105)], 'hitting', '2026-05-23')
    assert.deepEqual(api.asked, [101])
  } finally {
    api.restore()
  }
})
