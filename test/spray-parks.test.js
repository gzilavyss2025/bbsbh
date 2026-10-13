// The season spray store's park runs and the park view (#1859, slice 4).
//
// A season is many parks, so each batter entry keeps `g: [[count, venueId],
// …]` beside its rows: the next `count` rows were hit at that park. What is
// worth pinning:
//   1. The runs always cover the rows exactly, in the same order, through the
//      generator's fold, the season combine and the decoder. One run out of
//      step puts every later ball in the wrong park.
//   2. A ball with no park on record is never given one.
//   3. A park view groups by the WALL, not the venue: the 2022 and 2026
//      Comerica walls are two groups.
//   4. A park view's counts come from the balls hit there, not from the
//      season totals.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { aggregateGameSpray, foldGame, SCHEMA_VERSION } from '../scripts/gen-spray.mjs'
import { decodeSprayBalls, withSeasonRuns, sprayParks, parkSubview } from '../src/api/spray.js'
import { combineSprayEntries } from '../src/lib/seasons/combine.js'
import { CONFIGURATIONS } from '../src/lib/ballpark/layout/configurations.js'

const play = (x, eventType = 'single', hand = 'R', speed = 90) => ({
  about: { halfInning: 'top' },
  result: { eventType },
  matchup: { batter: { id: 7, fullName: 'A Batter' }, batSide: { code: 'R' }, pitcher: { id: 9 }, pitchHand: { code: hand } },
  playEvents: [{ hitData: { launchSpeed: speed, coordinates: { coordX: x, coordY: 100 } } }],
})
const feed = (plays) => ({
  gameData: { teams: { away: { id: 158 }, home: { id: 116 } }, players: {} },
  liveData: { plays: { allPlays: plays } },
})
const fold = (store, plays, date, venueId, gamePk = null) =>
  foldGame(store, aggregateGameSpray(feed(plays), 'mlb'), date, venueId, gamePk)

test('foldGame keeps one run per game, covering the rows exactly', () => {
  const store = {}
  fold(store, [play(100), play(110)], '2026-04-01', 2394, 801)
  fold(store, [play(120)], '2026-04-02', 2394, 802) // same park, next game: a new run
  fold(store, [play(130)], '2026-04-03', 32, 803) // a new park: a new run
  fold(store, [], '2026-04-04', 3, 804) // no ball in play: no run
  assert.deepEqual(store[7].g, [[2, 2394, 801], [1, 2394, 802], [1, 32, 803]])
  assert.equal(store[7].p.length, 4)
})

test('rows carried from before the runs get one run of unknown park', () => {
  const store = { 7: { n: 'A', t: 158, b: 'R', d: '2026-03-30', p: [[1, 1, 1, 0, 0, 0, 0, 1]], o: {} } }
  fold(store, [play(100)], '2026-04-01', 2394)
  assert.deepEqual(store[7].g, [[1, null], [1, 2394, null]])
})

test('the decoder gives each ball its park and season, in row order', () => {
  const store = {}
  fold(store, [play(100), play(110)], '2026-04-01', 2394)
  fold(store, [play(130)], '2026-04-03', 32)
  const balls = decodeSprayBalls(store[7], 2026)
  assert.deepEqual(balls.map((b) => [b.x, b.venueId, b.season]), [[100, 2394, 2026], [110, 2394, 2026], [130, 32, 2026]])
  // A ball outside every run has no park, never a guessed one.
  const short = decodeSprayBalls({ ...store[7], g: [[1, 2394]] }, 2026)
  assert.deepEqual(short.map((b) => b.venueId), [2394, null, null])
})

test('an All-seasons view keeps each ball with its own season', () => {
  const s2022 = { n: 'A', t: 116, b: 'R', p: [[1, 1, 90, 1, 0, 0, 0, 9]], g: [[1, 2394]], o: {} }
  const s2026 = { n: 'A', t: 116, b: 'R', p: [[2, 2, 90, 1, 0, 0, 0, 9]], g: [[1, 2394]], o: {} }
  const joined = combineSprayEntries([withSeasonRuns(s2022, 2022), withSeasonRuns(s2026, 2026)])
  assert.deepEqual(decodeSprayBalls(joined).map((b) => b.season), [2022, 2026])
  // A pre-run season joins as unknown park, still in step.
  const old = { n: 'A', t: 116, b: 'R', p: [[3, 3, 90, 1, 0, 0, 0, 9]], o: {} }
  const mixed = combineSprayEntries([withSeasonRuns(old, 2021), withSeasonRuns(s2026, 2026)])
  assert.deepEqual(decodeSprayBalls(mixed).map((b) => [b.venueId, b.season]), [[null, 2021], [2394, 2026]])
})

const ball = (venueId, season, over = {}) => ({
  x: 125, y: 100, exitVelo: 90, result: 'single', hand: 'R', side: 'R', level: 'mlb', pitcherId: 9, venueId, season, ...over,
})

test('the park view groups by wall: two Comerica walls are two groups', () => {
  const parks = sprayParks([ball(2394, 2022), ball(2394, 2022), ball(2394, 2026), ball(32, 2026)])
  const byKey = Object.fromEntries(parks.groups.map((g) => [g.key, g]))
  assert.equal(byKey['comericapark-2000'].n, 2)
  assert.equal(byKey['comericapark-2023'].n, 1)
  // Two walls of one park name their seasons; a lone park does not.
  assert.equal(byKey['comericapark-2000'].label, 'Comerica Park (2022)')
  assert.equal(byKey.americanfamilyfield.label, 'American Family Field')
  assert.equal(parks.groups[0].key, 'comericapark-2000', 'most balls first')
})

test('the coverage counts keep unknown and off-file balls out of every park', () => {
  const parks = sprayParks([ball(null, 2026), ball(2523, 2025), ball(32, 2026)])
  assert.equal(parks.unknown, 1, 'no park on record')
  assert.equal(parks.offFile, 1, 'a park with no layout (Steinbrenner Field, 2025)')
  assert.equal(parks.total, 3)
  assert.deepEqual(parks.groups.map((g) => g.n), [1])
})

test('a park view recomputes every count from the balls hit there', () => {
  const view = {
    name: 'A', levels: ['mlb'],
    balls: [
      ball(32, 2026, { result: 'hr', exitVelo: 104 }),
      ball(32, 2026, { result: 'out', hand: 'L' }),
      ball(3, 2026, { result: 'double' }),
    ],
    splits: [{ key: 'all', label: 'All', bip: 500, hits: 150, xbh: 50, hr: 20, hard: 200, thin: false }],
  }
  const group = sprayParks(view.balls).groups.find((g) => g.venueId === 32)
  const sub = parkSubview(view, group)
  assert.equal(sub.balls.length, 2)
  assert.deepEqual(
    sub.splits.map(({ key, bip, hits, xbh, hr, hard }) => [key, bip, hits, xbh, hr, hard]),
    [['all', 2, 1, 1, 1, 1], ['R', 1, 1, 1, 1, 1], ['L', 1, 0, 0, 0, 0]],
  )
  assert.equal(sub.park, group)
})

test('every ballpark configuration covers whole seasons (the store keeps no dates)', () => {
  // The spray store resolves a wall from venue and SEASON alone, which is only
  // right while no configuration starts or ends mid-season.
  for (const c of CONFIGURATIONS) {
    if (c.from != null) assert.match(c.from, /^\d{4}-01-01$/, c.id)
    if (c.to != null) assert.match(c.to, /^\d{4}-12-31$/, c.id)
  }
})

test('the committed store is either pre-run or fully covered', () => {
  const dir = new URL('../public/data/spray/', import.meta.url)
  for (const season of readdirSync(dir).filter((d) => /^\d{4}$/.test(d))) {
    for (const f of readdirSync(new URL(`${season}/`, dir)).filter((x) => /^\d\d\.json$/.test(x))) {
      const shard = JSON.parse(readFileSync(new URL(`${season}/${f}`, dir), 'utf8'))
      for (const part of ['bat', 'post']) {
        for (const [id, e] of Object.entries(shard[part] ?? {})) {
          if ((shard.v ?? 1) < SCHEMA_VERSION) {
            assert.equal(e.g, undefined, `${season}/${f} ${id}: a v1 bucket carries no runs`)
          } else {
            assert.equal(e.g.reduce((n, r) => n + r[0], 0), e.p.length, `${season}/${f} ${id}: runs cover rows`)
          }
        }
      }
    }
  }
})
