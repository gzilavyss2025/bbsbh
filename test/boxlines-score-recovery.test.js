// A GAME PLAYED UNDER A STUCK "POSTPONED" SCHEDULE ROW (#1031, ADR-0069).
//
// Some games MLB left at `Postponed` were played: rained out, replayed the SAME
// DAY under the SAME gamePk, and the schedule row never updated. It still
// reports `abstractGameState: 'Final'` with no score, so Box Lines' gate drops
// it — and a door on the Game lines card then counts a game its own sheet never
// shows. Scherzer's Postseason door said 33 over a sheet of 31.
//
// The fix does NOT loosen the gate. `scorelessGamePks` (rows.js) names exactly
// the games the gate turned away FOR WANT OF A SCORE, fetch.js reads each one's
// own linescore, and `recoveredScores` hands the answer back. So this file pins
// two things that must stay true together:
//
//   • a played-but-stuck game becomes a row, with the right club's runs first;
//   • nothing else does — not a game at or after the cutoff, not a game the
//     schedule does not call Final, and not a game whose linescore is empty
//     too, which is what a game that was really never played looks like.
//
// The second half is the whole safety argument, so most of the cases below are
// about what the recovery must NOT be able to do.
import assert from 'node:assert/strict'
import test from 'node:test'
import { boxLineRows, scorelessGamePks } from '../src/api/boxlines/rows.js'
import { fetchBoxLines } from '../src/api/boxlines/fetch.js'

// A hitting game-log split, trimmed to what rows.js reads.
function split(date, gamePk, extra = {}) {
  return {
    date,
    gameType: 'R',
    isHome: false,
    isWin: true,
    team: { id: 158 },
    opponent: { id: 112 },
    game: { gamePk, gameNumber: 1 },
    positionsPlayed: [{ abbreviation: 'LF' }],
    stat: { hits: 2, atBats: 4, doubles: 1, triples: 0, homeRuns: 0, rbi: 1, baseOnBalls: 0, stolenBases: 0, strikeOuts: 1 },
    ...extra,
  }
}

// A scored schedule record: his club away, 4–6.
function scored(gamePk, officialDate) {
  return {
    gamePk,
    officialDate,
    gameNumber: 1,
    dayNight: 'day',
    status: { abstractGameState: 'Final' },
    venue: { id: 17, name: 'Wrigley Field' },
    teams: {
      away: { score: 4, team: { id: 158, abbreviation: 'MIL' } },
      home: { score: 6, team: { id: 112, abbreviation: 'CHC' } },
    },
  }
}

// The stuck one, as statsapi really answers for gamePk 776691 (2025-08-19):
// Final, Postponed, Rain, and no `score` on either side.
function stuck(gamePk, officialDate, extra = {}) {
  return {
    gamePk,
    officialDate,
    gameNumber: 1,
    dayNight: 'day',
    status: { abstractGameState: 'Final', detailedState: 'Postponed', reason: 'Rain' },
    venue: { id: 17, name: 'Wrigley Field' },
    teams: {
      away: { team: { id: 158, abbreviation: 'MIL' } },
      home: { team: { id: 112, abbreviation: 'CHC' } },
    },
    ...extra,
  }
}

const CUTOFF = '2026-09-01'

// ---------------------------------------------------------------------------
// scorelessGamePks — which games may be asked about at all
// ---------------------------------------------------------------------------

test('scorelessGamePks names only the games dropped for want of a score', () => {
  const pks = scorelessGamePks({
    splits: [split('2025-08-19', 776691), split('2025-08-20', 776692)],
    schedule: [stuck(776691, '2025-08-19'), scored(776692, '2025-08-20')],
    cutoff: CUTOFF,
  })
  assert.deepEqual(pks, [776691])
})

test('scorelessGamePks never names a game at or after the cutoff', () => {
  // The recovery runs on the same gate as the rows, so a game the cutoff
  // rejects is not merely dropped later — it is never fetched.
  const pks = scorelessGamePks({
    splits: [split(CUTOFF, 1), split('2026-09-02', 2)],
    schedule: [stuck(1, CUTOFF), stuck(2, '2026-09-02')],
    cutoff: CUTOFF,
  })
  assert.deepEqual(pks, [])
})

test('scorelessGamePks never names a game the schedule does not call Final', () => {
  const live = stuck(1, '2025-08-19', { status: { abstractGameState: 'Live' } })
  assert.deepEqual(scorelessGamePks({ splits: [split('2025-08-19', 1)], schedule: [live], cutoff: CUTOFF }), [])
})

test('scorelessGamePks dedupes a gamePk the log reports twice', () => {
  const pks = scorelessGamePks({
    splits: [split('2025-08-19', 776691), split('2025-08-19', 776691)],
    schedule: [stuck(776691, '2025-08-19')],
    cutoff: CUTOFF,
  })
  assert.deepEqual(pks, [776691])
})

// ---------------------------------------------------------------------------
// boxLineRows — what a recovered score may and may not do
// ---------------------------------------------------------------------------

test('a recovered score puts a played-but-stuck game back on the sheet', () => {
  const rows = boxLineRows({
    splits: [split('2025-08-19', 776691)],
    schedule: [stuck(776691, '2025-08-19')],
    group: 'hitting',
    cutoff: CUTOFF,
    recoveredScores: new Map([[776691, { away: 4, home: 6 }]]),
  })
  assert.equal(rows.length, 1)
  // He is the away club, so his runs come first and he lost.
  assert.equal(rows[0].runs, 4)
  assert.equal(rows[0].oppRuns, 6)
  assert.equal(rows[0].won, false)
  assert.equal(rows[0].boxScorePath, '/08192025/milchc/boxscore')
})

test('a recovered score reads off the right side when his club is home', () => {
  const g = stuck(776691, '2025-08-19')
  g.teams.away.team = { id: 112, abbreviation: 'CHC' }
  g.teams.home.team = { id: 158, abbreviation: 'MIL' }
  const rows = boxLineRows({
    splits: [split('2025-08-19', 776691)],
    schedule: [g],
    group: 'hitting',
    cutoff: CUTOFF,
    recoveredScores: new Map([[776691, { away: 4, home: 6 }]]),
  })
  assert.equal(rows[0].runs, 6)
  assert.equal(rows[0].oppRuns, 4)
  assert.equal(rows[0].won, true)
  assert.equal(rows[0].home, true)
})

test('a recovered shutout is a score, not a miss', () => {
  // `??` and not `||`: gamePk 777459 really did end 7–0, and 0 is a score.
  const rows = boxLineRows({
    splits: [split('2025-08-18', 777459)],
    schedule: [stuck(777459, '2025-08-18')],
    group: 'hitting',
    cutoff: CUTOFF,
    recoveredScores: new Map([[777459, { away: 7, home: 0 }]]),
  })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].runs, 7)
  assert.equal(rows[0].oppRuns, 0)
})

test('a stuck game the recovery could not score still has no row', () => {
  // What a game that was really never played looks like: its own linescore
  // carries no runs either, so it is absent from the map and stays dropped.
  for (const recoveredScores of [null, new Map(), new Map([[999, { away: 1, home: 2 }]])]) {
    const rows = boxLineRows({
      splits: [split('2025-08-19', 776691)],
      schedule: [stuck(776691, '2025-08-19')],
      group: 'hitting',
      cutoff: CUTOFF,
      recoveredScores,
    })
    assert.deepEqual(rows, [])
  }
})

test('a recovered score cannot resurrect a game at or after the cutoff', () => {
  const rows = boxLineRows({
    splits: [split(CUTOFF, 1), split('2026-09-02', 2)],
    schedule: [stuck(1, CUTOFF), stuck(2, '2026-09-02')],
    group: 'hitting',
    cutoff: CUTOFF,
    recoveredScores: new Map([
      [1, { away: 4, home: 6 }],
      [2, { away: 4, home: 6 }],
    ]),
  })
  assert.deepEqual(rows, [])
})

test('a recovered score cannot resurrect a game the schedule does not call Final', () => {
  const live = stuck(1, '2025-08-19', { status: { abstractGameState: 'Live' } })
  const rows = boxLineRows({
    splits: [split('2025-08-19', 1)],
    schedule: [live],
    group: 'hitting',
    cutoff: CUTOFF,
    recoveredScores: new Map([[1, { away: 4, home: 6 }]]),
  })
  assert.deepEqual(rows, [])
})

test('the schedule record still wins where it has a score of its own', () => {
  const rows = boxLineRows({
    splits: [split('2025-08-20', 776692)],
    schedule: [scored(776692, '2025-08-20')],
    group: 'hitting',
    cutoff: CUTOFF,
    recoveredScores: new Map([[776692, { away: 99, home: 99 }]]),
  })
  assert.equal(rows[0].runs, 4)
  assert.equal(rows[0].oppRuns, 6)
})

// ---------------------------------------------------------------------------
// fetch.js — the pass itself, over a stubbed statsapi
//
// `getJson` calls the global `fetch`, so the whole join runs offline here. Each
// case uses its own personId because fetch.js memoizes a join per person.
// ---------------------------------------------------------------------------

// `games` is gamePk -> schedule record; `linescores` is gamePk -> the body its
// own linescore call answers with (or a thrown 404 when absent from the map).
function stubApi({ personId, splits, games, linescores = {} }) {
  const calls = []
  const previous = globalThis.fetch
  globalThis.fetch = async (url) => {
    const path = String(url).replace('https://statsapi.mlb.com', '')
    calls.push(path)
    const ok = (json) => ({ ok: true, status: 200, json: async () => json })
    if (path.includes('stats=yearByYear')) return ok({ stats: [{ splits: [{ season: '2025' }] }] })
    if (path.includes('stats=gameLog')) return ok({ stats: [{ splits }] })
    if (path.startsWith('/api/v1/schedule')) {
      const asked = new Set(
        (path.match(/gamePks=([\d,]+)/)?.[1] ?? '').split(',').map(Number),
      )
      return ok({ dates: [{ games: Object.values(games).filter((g) => asked.has(g.gamePk)) }] })
    }
    const pk = Number(path.match(/\/game\/(\d+)\/linescore/)?.[1])
    if (pk) {
      if (!(pk in linescores)) return { ok: false, status: 404, json: async () => ({}) }
      return ok(linescores[pk])
    }
    throw new Error(`unstubbed ${path}`)
  }
  return {
    calls,
    personId,
    restore() {
      globalThis.fetch = previous
    },
  }
}

const linescoreCalls = (calls) => calls.filter((p) => p.includes('/linescore'))

test('fetchBoxLines recovers the stuck row from the game it belongs to', async () => {
  const api = stubApi({
    personId: 900001,
    splits: [split('2025-08-19', 776691), split('2025-08-20', 776692)],
    games: { 776691: stuck(776691, '2025-08-19'), 776692: scored(776692, '2025-08-20') },
    linescores: { 776691: { teams: { away: { runs: 4 }, home: { runs: 6 } } } },
  })
  try {
    const rows = await fetchBoxLines({ personId: api.personId, group: 'hitting', cutoff: CUTOFF })
    assert.deepEqual(
      rows.map((r) => r.gamePk),
      [776692, 776691],
    )
    assert.equal(rows.find((r) => r.gamePk === 776691).runs, 4)
    // Exactly one, for the one row that wanted a score.
    assert.deepEqual(linescoreCalls(api.calls), ['/api/v1/game/776691/linescore?fields=teams,home,away,runs'])
  } finally {
    api.restore()
  }
})

test('a linescore with no runs leaves the row dropped — a game never played', async () => {
  const api = stubApi({
    personId: 900002,
    splits: [split('2025-08-19', 776691)],
    games: { 776691: stuck(776691, '2025-08-19') },
    linescores: { 776691: { teams: { away: {}, home: {} } } },
  })
  try {
    assert.deepEqual(await fetchBoxLines({ personId: api.personId, group: 'hitting', cutoff: CUTOFF }), [])
  } finally {
    api.restore()
  }
})

test('a linescore call that fails leaves the row dropped, and the sheet standing', async () => {
  const api = stubApi({
    personId: 900003,
    splits: [split('2025-08-19', 776691), split('2025-08-20', 776692)],
    games: { 776691: stuck(776691, '2025-08-19'), 776692: scored(776692, '2025-08-20') },
    // 776691 absent, so its call 404s.
  })
  try {
    const rows = await fetchBoxLines({ personId: api.personId, group: 'hitting', cutoff: CUTOFF })
    assert.deepEqual(
      rows.map((r) => r.gamePk),
      [776692],
    )
  } finally {
    api.restore()
  }
})

test('past the cap nothing is asked, and the rows stay dropped as they are today', async () => {
  // 151 stuck rows is the source having gone wrong, not a career: the worst
  // real one measured is 69 (Cabrera, 2,797 games). The cap is what keeps a
  // broken schedule endpoint from costing a request per game.
  const splits = []
  const games = {}
  const linescores = {}
  for (let i = 0; i < 151; i += 1) {
    const pk = 700000 + i
    splits.push(split('2025-08-19', pk))
    games[pk] = stuck(pk, '2025-08-19')
    linescores[pk] = { teams: { away: { runs: 4 }, home: { runs: 6 } } }
  }
  const api = stubApi({ personId: 900004, splits, games, linescores })
  try {
    assert.deepEqual(await fetchBoxLines({ personId: api.personId, group: 'hitting', cutoff: CUTOFF }), [])
    assert.deepEqual(linescoreCalls(api.calls), [])
  } finally {
    api.restore()
  }
})

test('the recovery rides in the memoized join, so a second door costs nothing', async () => {
  const api = stubApi({
    personId: 900005,
    splits: [split('2025-08-19', 776691)],
    games: { 776691: stuck(776691, '2025-08-19') },
    linescores: { 776691: { teams: { away: { runs: 4 }, home: { runs: 6 } } } },
  })
  try {
    const first = await fetchBoxLines({ personId: api.personId, group: 'hitting', cutoff: CUTOFF })
    const after = api.calls.length
    const second = await fetchBoxLines({
      personId: api.personId,
      group: 'hitting',
      cutoff: CUTOFF,
      facet: { kind: 'side', home: false },
    })
    assert.equal(first.length, 1)
    assert.equal(second.length, 1)
    assert.equal(api.calls.length, after)
  } finally {
    api.restore()
  }
})
