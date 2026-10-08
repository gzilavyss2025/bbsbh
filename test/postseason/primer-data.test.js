// The primer's data (ADR-0087, 2026-10-08 addendum): the record line the ribbon
// and the log share, the runs fold the live path needs, and how a nightly shard
// block and a live read become one list of finished games.
import assert from 'node:assert/strict'
import test from 'node:test'
import { recordAfterGame } from '../../src/lib/postseason/primer/recordAfter.js'
import { foldRunsByGame, loadSeriesStats } from '../../src/api/postseasonSeries.js'
import { planShard, primerData, seriesBlockFor } from '../../src/lib/postseason/primer/primerGames.js'

// ---- recordAfterGame ------------------------------------------------------

const club = (id, abbreviation) => ({ id, abbreviation })
const slots = [{ club: club(1, 'AAA') }, { club: club(2, 'BBB') }]
const wins = (...ids) => ids.map((winnerId, i) => ({ gamePk: 100 + i, winnerId }))

test('record after a game: tied, leading, and the clincher', () => {
  const s = { slots, games: wins(1, 2, 2, 2, 1, 2), decided: true, winner: club(2, 'BBB') }
  assert.equal(recordAfterGame(s, 0), 'AAA leads 1–0')
  assert.equal(recordAfterGame(s, 1), 'Series tied 1–1')
  assert.equal(recordAfterGame(s, 2), 'BBB leads 2–1')
  assert.equal(recordAfterGame(s, 4), 'BBB leads 3–2')
  assert.equal(recordAfterGame(s, 5), 'BBB won 4–2')
})

test('record after a game: an undecided series has no clincher', () => {
  const s = { slots, games: wins(1, 1, 1, 1), decided: false, winner: null }
  assert.equal(recordAfterGame(s, 3), 'AAA leads 4–0')
})

// ---- runsByGame -----------------------------------------------------------

const box = (awayId, awayRuns, homeId, homeRuns) => ({
  teams: {
    away: { team: { id: awayId }, teamStats: { batting: { runs: awayRuns } } },
    home: { team: { id: homeId }, teamStats: { batting: { runs: homeRuns } } },
  },
})

test('runs fold: one entry per game, keyed by gamePk, aligned with the box scores', () => {
  const games = [{ gamePk: 10 }, { gamePk: 11 }, { gamePk: 12 }]
  const out = foldRunsByGame(games, [box(119, 3, 158, 5), null, box(158, 0, 119, 2)])
  assert.deepEqual(out, {
    10: { awayId: 119, homeId: 158, runs: { away: 3, home: 5 } },
    12: { awayId: 158, homeId: 119, runs: { away: 0, home: 2 } },
  })
})

test('runs fold: a box score with no run count leaves no entry', () => {
  const noRuns = { teams: { away: { team: { id: 1 } }, home: { team: { id: 2 } } } }
  assert.deepEqual(foldRunsByGame([{ gamePk: 10 }], [noRuns]), {})
  assert.deepEqual(foldRunsByGame([], []), {})
})

// ---- shard plus live ------------------------------------------------------

const counted = [
  { gamePk: 10, gameNumber: 1, date: '2025-10-13' },
  { gamePk: 11, gameNumber: 2, date: '2025-10-14' },
]
const shardGame = (gamePk, n) => ({
  gamePk,
  n,
  date: `2025-10-${12 + n}`,
  awayId: 119,
  homeId: 158,
  venueId: 32,
  venueName: 'Shard Park',
  runs: { away: 1, home: 2 },
  wp: [50, 60],
})
const shardStats = { batting: {}, pitching: {}, rosters: {}, totals: {}, runsByGame: {} }
const block = (pks, extra = {}) => ({ id: 's', gamePks: pks, games: pks.map((pk, i) => shardGame(pk, i + 1)), stats: shardStats, ...extra })

const winProb = (...ys) => ys.map((y, i) => ({ homeTeamWinProbability: y, about: { inning: i + 1, isTopInning: true } }))
const liveLog = {
  stats: { ...shardStats, runsByGame: { 10: { awayId: 119, homeId: 158, runs: { away: 4, home: 6 } }, 11: { awayId: 158, homeId: 119, runs: { away: 0, home: 1 } } } },
  cardsByPk: { 10: { home: { id: 158 }, away: { id: 119 }, venue: { id: 32, name: 'Live Park' } }, 11: { home: { id: 119 }, away: { id: 158 }, venue: { id: 22, name: 'Live Park 2' } } },
  gameSignals: { 10: { winProb: winProb(55, 70, 90) }, 11: { winProb: winProb(40) } },
}

test('shard equals the counted games: shard source, no live read needed', () => {
  assert.equal(planShard(block([10, 11]), counted).needLive, false)
  const out = primerData(block([10, 11]), counted, null)
  assert.equal(out.source, 'shard')
  assert.deepEqual(out.games.map((g) => g.venueName), ['Shard Park', 'Shard Park'])
  assert.equal(out.stats, shardStats)
})

test('shard lacks a counted game: mixed, the live game fills it', () => {
  const b = block([10])
  assert.equal(planShard(b, counted).needLive, true)
  const out = primerData(b, counted, liveLog)
  assert.equal(out.source, 'mixed')
  assert.deepEqual(out.games.map((g) => [g.gamePk, g.venueName]), [[10, 'Shard Park'], [11, 'Live Park 2']])
  assert.equal(out.stats, liveLog.stats)
})

test('stats are trusted only when gamePks is exactly the counted set', () => {
  // gamePks lacks 11 although games carries it: the stats might cover a game we cannot name
  const loose = block([10, 11], { gamePks: [10] })
  assert.equal(planShard(loose, counted).needLive, true)
  assert.equal(primerData(loose, counted, liveLog).stats, liveLog.stats)
  // no gamePks at all: the stats cannot be tied to a game list, so the block is not used
  const nameless = block([10, 11], { gamePks: undefined })
  assert.equal(planShard(nameless, counted).usable, false)
  assert.equal(primerData(nameless, counted, liveLog).source, 'live')
})

test('a malformed block falls back to the live read and never throws', () => {
  for (const bad of [{ id: 's', gamePks: { 0: 10 }, games: [] }, { id: 's', gamePks: [10], games: [null] }, { id: 's', gamePks: [10], games: 'x' }, 7]) {
    assert.equal(planShard(bad, counted).usable, false)
    assert.equal(primerData(bad, counted, liveLog).source, 'live')
  }
})

test('source names what was used: a block with no counted game to give is live', () => {
  assert.equal(primerData(block([]), [], null).source, 'live')
  assert.equal(primerData(block([]), counted, liveLog).source, 'live')
})

test('shard has a game the bracket does not count: the whole shard is dropped', () => {
  const b = block([10, 11, 12]) // 12 is today's game, or one after
  assert.equal(planShard(b, counted).usable, false)
  const out = primerData(b, counted, liveLog)
  assert.equal(out.source, 'live')
  assert.ok(out.games.every((g) => g.venueName.startsWith('Live Park')))
  assert.equal(out.games.some((g) => g.gamePk === 12), false)
})

test('no shard: live source, the live log builds each game in the slice 1 shape', () => {
  assert.equal(planShard(null, counted).needLive, true)
  const out = primerData(null, counted, liveLog)
  assert.equal(out.source, 'live')
  assert.deepEqual(out.games[0], {
    gamePk: 10,
    n: 1,
    date: '2025-10-13',
    awayId: 119,
    homeId: 158,
    venueId: 32,
    venueName: 'Live Park',
    runs: { away: 4, home: 6 },
    wp: [55, 70, 90],
  })
})

test('live path before the log arrives, or with a game that has no box score: fewer games, never a crash', () => {
  assert.deepEqual(primerData(null, counted, null).games, [])
  const noBox = { ...liveLog, stats: { ...liveLog.stats, runsByGame: { 10: liveLog.stats.runsByGame[10] } } }
  assert.deepEqual(primerData(null, counted, noBox).games.map((g) => g.gamePk), [10])
})

test('wp is cut to 26 points and ignores entries with no home chance', () => {
  const long = winProb(...Array.from({ length: 80 }, (_, i) => i))
  long.push({ about: { inning: 9 } })
  const log = { ...liveLog, gameSignals: { 10: { winProb: long } } }
  const [g] = primerData(null, [counted[0]], log).games
  assert.equal(g.wp.length, 26)
  assert.equal(g.wp[0], 0)
  assert.equal(g.wp.at(-1), 79)
})

test('a series with no counted game needs no live read', () => {
  assert.equal(planShard(null, []).needLive, false)
  assert.equal(planShard(block([]), []).needLive, false)
  assert.deepEqual(primerData(null, [], null), { games: [], stats: null, source: 'live' })
})

test('seriesBlockFor reads the block off a game bundle and nothing else', () => {
  const b = block([10])
  assert.equal(seriesBlockFor({ series: b }, 's'), b)
  assert.equal(seriesBlockFor({ series: b }, 'other'), null)
  assert.equal(seriesBlockFor(null, 's'), null)
  assert.equal(seriesBlockFor({}, 's'), null)
})

// The stack of the series-block slice (a pure foldSeriesStats) and this slice
// (runsByGame) once left loadSeriesStats reading a `games` the fold did not have.
test('loadSeriesStats hands the live read its runs by game', async (t) => {
  const box = (awayRuns, homeRuns) => ({
    teams: {
      away: { team: { id: 119 }, teamStats: { batting: { runs: awayRuns } }, players: {}, batters: [], pitchers: [] },
      home: { team: { id: 158 }, teamStats: { batting: { runs: homeRuns } }, players: {}, batters: [], pitchers: [] },
    },
  })
  t.mock.method(globalThis, 'fetch', async (url) => ({
    ok: true,
    json: async () => (String(url).includes('/boxscore') ? box(4, 6) : {}),
  }))
  const stats = await loadSeriesStats([{ gamePk: 10 }])
  assert.deepEqual(stats.runsByGame[10], { awayId: 119, homeId: 158, runs: { away: 4, home: 6 } })
})
