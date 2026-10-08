// The nightly "series" block in a callouts shard (seriesBlock.js): the
// finished games of an LCS or World Series heading into the slate date, and
// their stats in loadSeriesStats's shape. Every test hands the builder data
// for EVERY game of the series, today's and later ones included, so a leak
// shows up as a gamePk or a planted stat in the output.
//   2025 World Series: G1 813027 … G6 813025 (10-31), G7 813024 (11-01)
//   2008 World Series Game 5 (243847): suspended 10-27, resumed 10-29
//   2022 ALDS CLE-NYY Game 2 (715752): postponed 10-13 to 10-14
import assert from 'node:assert/strict'
import test from 'node:test'
import { bracket2025, results, skeleton } from './fixtures.js'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { foldSeriesStats } from '../../src/api/postseasonSeries.js'
import { seriesBlockFor } from '../../src/api/callouts.js'
import { seriesBlock } from '../../src/lib/postseason/primer/seriesBlock.js'

const WS_2025 = [813027, 813026, 813032, 813023, 813022, 813025, 813024]

// One game's raw reads. Each game gets its own hitter (id = gamePk) with
// homeRuns = gamePk % 100, so a leaked game's player shows in the leaders.
function gameData(gamePk, awayId = 119, homeId = 141) {
  const side = (id, runs, player) => ({
    team: { id },
    teamStats: { batting: { runs, hits: runs, atBats: 30 }, pitching: { outs: 27, earnedRuns: runs } },
    players: player
      ? { [`ID${player}`]: { person: { id: player, fullName: `P${player}` }, stats: { batting: { atBats: 4, homeRuns: player % 100 } } } }
      : {},
  })
  return {
    box: { teams: { away: side(awayId, 3, gamePk), home: side(homeId, 2, null) } },
    feed: {
      gameData: { teams: { away: { id: awayId }, home: { id: homeId } }, venue: { id: 14, name: 'Rogers Centre' } },
      liveData: { plays: { allPlays: [] } },
    },
    winProb: Array.from({ length: 80 }, (_, i) => ({ about: { inning: 1 + Math.floor(i / 9) }, homeTeamWinProbability: 50 - i / 2 })),
  }
}
const dataFor = (pks) => Object.fromEntries(pks.map((pk) => [pk, gameData(pk)]))

test('World Series Game 7: the block holds Games 1 to 6 only', () => {
  const block = seriesBlock(bracket2025('2025-11-01'), 813024, dataFor(WS_2025))
  assert.deepEqual(block.gamePks, WS_2025.slice(0, 6))
  assert.deepEqual(block.games.map((g) => g.n), [1, 2, 3, 4, 5, 6])
  assert.ok(!JSON.stringify(block).includes('813024'), 'nothing from the day’s own game')
})

test('each game has the slice 1 shape, and the stats are loadSeriesStats’s', () => {
  const data = dataFor(WS_2025)
  const block = seriesBlock(bracket2025('2025-11-01'), 813024, data)
  assert.deepEqual(block.games[0], {
    gamePk: 813027, n: 1, date: '2025-10-24', awayId: 119, homeId: 141,
    venueId: 14, venueName: 'Rogers Centre', runs: { away: 3, home: 2 },
    wp: block.games[0].wp,
  })
  const wp = block.games[0].wp
  assert.equal(wp.length, 26)
  assert.equal(wp[0], 50)
  assert.equal(wp.at(-1), Math.round(50 - 79 / 2))
  const pks = WS_2025.slice(0, 6)
  const { batting, pitching, totals } = foldSeriesStats(pks.map((pk) => data[pk].box), pks.map((pk) => data[pk].feed))
  assert.deepEqual(block.stats, { batting, pitching, totals })
})

test('sentinel: a game on the slate date and a later game never count', () => {
  const block = seriesBlock(bracket2025('2025-10-31'), 813025, dataFor(WS_2025))
  assert.deepEqual(block.gamePks, WS_2025.slice(0, 5))
  const json = JSON.stringify(block)
  for (const pk of [813025, 813024]) assert.ok(!json.includes(String(pk)), `no ${pk}`)
  assert.ok(!block.stats.batting.homeRuns.some((e) => e.id === 813025 || e.id === 813024))
})

test('sentinel: a live bracket that counts today’s game still gets no today in the block', () => {
  const live = deriveBracket(skeleton(2025), results(2025), '2025-11-01', { live: true })
  assert.ok(live.worldSeries.games.some((g) => g.gamePk === 813024))
  assert.deepEqual(seriesBlock(live, 813024, dataFor(WS_2025)).gamePks, WS_2025.slice(0, 6))
})

test('sentinel: a suspended game counts on its resume date, not its officialDate', () => {
  const ws2008 = [243843, 243844, 243845, 243846, 243847]
  const b = (cutoff) => deriveBracket(skeleton(2008), results(2008), cutoff)
  assert.deepEqual(seriesBlock(b('2008-10-27'), 243847, dataFor(ws2008)).gamePks, ws2008.slice(0, 4))
  // Resumed and finished on 10-29: still the slate date, so still not counted.
  assert.deepEqual(seriesBlock(b('2008-10-29'), 243847, dataFor(ws2008)).gamePks, ws2008.slice(0, 4))
})

// The only real postponed postseason games on file are a Division Series.
// Relabeled as the season's World Series, the rows and results stay real.
test('sentinel: a postponed game counts only once it went Final, on its new date', () => {
  const pks = [715753, 715752, 715751, 715750, 715749]
  const asWs = (rows) => rows.filter((r) => pks.includes(r.gamePk)).map((r) => ({ ...r, gameType: 'W' }))
  const b = (cutoff) => deriveBracket(asWs(skeleton(2022)), results(2022), cutoff)
  // 10-13, the postponed date: Game 2 is not on the slate, so it has no block.
  assert.equal(seriesBlock(b('2022-10-13'), 715752, dataFor(pks)), null)
  assert.deepEqual(seriesBlock(b('2022-10-14'), 715752, dataFor(pks)).gamePks, [715753])
  assert.deepEqual(seriesBlock(b('2022-10-15'), 715751, dataFor(pks)).gamePks, [715753, 715752])
})

test('sentinel: a doubleheader counts neither game of the day', () => {
  const moved = (rows) => rows.map((r) => (r.gamePk === 813024 ? { ...r, officialDate: '2025-10-31' } : r))
  const b = deriveBracket(moved(skeleton(2025)), moved(results(2025)), '2025-10-31')
  for (const pk of [813025, 813024]) assert.deepEqual(seriesBlock(b, pk, dataFor(WS_2025)).gamePks, WS_2025.slice(0, 5))
})

test('no block for a Division Series game, an unknown game, or a counted game with no data', () => {
  const ds = bracket2025('2025-10-08')
  const dsPk = ds.series.find((s) => s.round === 'division' && s.playsOnCutoff).cutoffGame.gamePk
  assert.equal(seriesBlock(ds, dsPk, {}), null)
  assert.equal(seriesBlock(bracket2025('2025-11-01'), 999999, dataFor(WS_2025)), null)
  assert.equal(seriesBlock(bracket2025('2025-11-01'), 813024, dataFor(WS_2025.slice(1))), null)
})

test('Game 1: an empty block, not a missing one', () => {
  const block = seriesBlock(bracket2025('2025-10-24'), 813027, dataFor(WS_2025))
  assert.deepEqual([block.gamePks, block.games, block.stats.totals], [[], [], {}])
})

test('seriesBlockFor reads the block, or null for any other bundle', () => {
  const block = seriesBlock(bracket2025('2025-11-01'), 813024, dataFor(WS_2025))
  assert.equal(seriesBlockFor({ gamePk: 813024, series: block }), block)
  assert.equal(seriesBlockFor({ gamePk: 1 }), null)
  assert.equal(seriesBlockFor(null), null)
})
