// A MAKEUP GAME UNDER THE SAME gamePk (ADR-0069). A game postponed and played on
// a later date keeps its gamePk, and the schedule then answers with TWO records
// for it: the first date's `Postponed` one (Final, no score) and the played
// date's `Final` one, with the score. Captured live 2026-10-13 for gamePk 824134
// (MIL at KC): 2026-04-03 Postponed, rescheduleDate 2026-04-04T23:10Z; then
// 2026-04-04 Final 2–8, game 2 of a doubleheader, rescheduledFrom 2026-04-03.
// Brice Turang (668930) has three such games in 2026: 824134, 823062, 823357.
//
// fetchSchedule kept the FIRST record per gamePk, so the Postponed one won and
// the gate dropped the game: no score in the Game log, no row on Box Lines. The
// played record must win, and every spoiler gate must still hold.
import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import { fetchBoxLines, fetchFinalScores } from '../src/api/boxlines/fetch.js'

const teams = (away, home) => ({
  away: { ...(away == null ? {} : { score: away }), team: { id: 158, abbreviation: 'MIL' } },
  home: { ...(home == null ? {} : { score: home }), team: { id: 118, abbreviation: 'KC' } },
})
const venue = { id: 7, name: 'Kauffman Stadium', fieldInfo: { turfType: 'Grass' } }

// The two records for one gamePk, as statsapi returns them (trimmed by
// fetch.js's own `fields=`): the postponed date first, the played date second.
function makeup(gamePk, { from, to }) {
  return [
    {
      date: from,
      games: [
        {
          gamePk,
          officialDate: to,
          rescheduleDate: `${to}T23:10:00Z`,
          gameNumber: 1,
          dayNight: 'night',
          status: { abstractGameState: 'Final', detailedState: 'Postponed' },
          teams: teams(null, null),
          venue,
        },
      ],
    },
    {
      date: to,
      games: [
        {
          gamePk,
          officialDate: to,
          rescheduledFrom: `${from}T23:45:00Z`,
          gameNumber: 2,
          dayNight: 'night',
          status: { abstractGameState: 'Final', detailedState: 'Final' },
          teams: teams(2, 8),
          venue,
        },
      ],
    },
  ]
}

// His hitting split for that game: the game log dates it the day it was PLAYED.
const split = (date, gamePk, gameNumber = 2) => ({
  date,
  gameType: 'R',
  isHome: false,
  isWin: false,
  team: { id: 158 },
  league: { id: 104 },
  opponent: { id: 118, teamName: 'Royals' },
  game: { gamePk, gameNumber },
  positionsPlayed: [{ abbreviation: '2B' }],
  stat: { hits: 1, atBats: 4 },
})

// statsapi, stubbed: the seasons call, the game log and the schedule. `dates` is
// the schedule's answer; every gamePk asked for is recorded.
function stub({ dates, splits = [] }) {
  const asked = []
  const m = mock.method(globalThis, 'fetch', async (url) => {
    const u = String(url)
    let body
    if (u.includes('/schedule')) {
      asked.push(...u.match(/gamePks=([\d,]+)/)[1].split(',').map(Number))
      body = { dates }
    } else if (u.includes('stats=yearByYear')) body = { stats: [{ splits: [{ season: '2026' }] }] }
    else if (u.includes('stats=gameLog')) body = { stats: [{ splits }] }
    else if (u.includes('/linescore')) body = { teams: { away: {}, home: {} } }
    else throw new Error(`unexpected ${u}`)
    return { ok: true, status: 200, json: async () => body }
  })
  return { asked, restore: () => m.mock.restore() }
}

test('fetchFinalScores: a makeup under the same gamePk reads the score of the game as played', async () => {
  const api = stub({ dates: makeup(824134, { from: '2026-04-03', to: '2026-04-04' }) })
  try {
    const scores = await fetchFinalScores([split('2026-04-04', 824134)], 'hitting', null, '2026-10-13')
    const r = scores.get(824134)
    assert.ok(r, 'the makeup has a score')
    assert.deepEqual([r.date, r.won, r.runs, r.oppRuns], ['2026-04-04', false, 2, 8])
    // The played record, not the postponed one: game 2 of that day's doubleheader.
    assert.equal(r.gameNumber, 2)
    assert.equal(r.boxScorePath, '/04042026/milkc-2/boxscore')
  } finally {
    api.restore()
  }
})

test('fetchFinalScores: a makeup played TODAY shows its score once Final (ADR-0117)', async () => {
  const api = stub({ dates: makeup(900001, { from: '2026-10-12', to: '2026-10-13' }) })
  try {
    const scores = await fetchFinalScores([split('2026-10-13', 900001)], 'hitting', null)
    assert.deepEqual(api.asked, [900001])
    assert.equal(scores.size, 1)
  } finally {
    api.restore()
  }
})

test("fetchFinalScores: a makeup played today shows its score even when the split keeps the postponed day", async () => {
  // Not what statsapi does today (the split moves to the played day).
  // With no cutoff the played record is read as played.
  const api = stub({ dates: makeup(900002, { from: '2026-10-12', to: '2026-10-13' }) })
  try {
    const scores = await fetchFinalScores([split('2026-10-12', 900002)], 'hitting', null)
    assert.equal(scores.size, 1)
  } finally {
    api.restore()
  }
})

test('fetchFinalScores: a suspended game, two scored records, shows its score with no cutoff', async () => {
  // gamePk 777861's shape (live 2026-10-13): both records Final and scored;
  // only the first carries resumeDate. With no cutoff it is read as finished.
  const rec = (date, extra) => ({
    date,
    games: [{ gamePk: 900003, officialDate: '2026-10-11', gameNumber: 1, status: { abstractGameState: 'Final', detailedState: 'Final' }, teams: teams(5, 6), venue, ...extra }],
  })
  const api = stub({
    dates: [rec('2026-10-11', { resumeDate: '2026-10-13T17:10:00Z' }), rec('2026-10-13', { resumedFrom: '2026-10-11T23:40:00Z' })],
  })
  try {
    const scores = await fetchFinalScores([split('2026-10-11', 900003, 1)], 'hitting', null)
    assert.equal(scores.size, 1)
  } finally {
    api.restore()
  }
})

test('Box Lines: the makeup is a row with the played date, game number and score', async () => {
  const api = stub({ dates: makeup(824134, { from: '2026-04-03', to: '2026-04-04' }), splits: [split('2026-04-04', 824134)] })
  try {
    const rows = await fetchBoxLines({ personId: 668930, group: 'hitting', cutoff: '2026-04-05' })
    assert.deepEqual(
      rows.map((r) => [r.gamePk, r.date, r.gameNumber, r.runs, r.oppRuns, r.won]),
      [[824134, '2026-04-04', 2, 2, 8, false]],
    )
  } finally {
    api.restore()
  }
})

test('Box Lines: on the day the makeup is played, it has no row', async () => {
  // Scored on the lineup page for 2026-04-04: the makeup is that day's game,
  // so the gate keeps it out though the schedule now has its score.
  const api = stub({ dates: makeup(824134, { from: '2026-04-03', to: '2026-04-04' }), splits: [split('2026-04-04', 824134)] })
  try {
    const rows = await fetchBoxLines({ personId: 668931, group: 'hitting', cutoff: '2026-04-04' })
    assert.deepEqual(rows, [])
  } finally {
    api.restore()
  }
})
