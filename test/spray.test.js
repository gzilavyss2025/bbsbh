// Unit coverage for src/api/spray.js — the season spray map's data layer.
//
// The card is a picture, so almost everything that can be wrong about it is
// wrong ARITHMETIC that still draws. These tests pin the four rules that have
// no visual tell:
//
//   • THE SPLIT SUMS. "All" is vs RHP plus vs LHP and never a third stored
//     total, so a chip count can never disagree with the two beside it.
//   • THE DIRECTION MATH. Pull is a fact about the BATTER, not about left
//     field, so the same spray angle is "pull" for a right-handed hitter and
//     "oppo" for a left-handed one. A switch-hitter bats both ways in the same
//     season, which is why the side is recorded per ball in play and why the
//     All view refuses to draw a direction bar at all: two mirrored
//     distributions do not sum into one.
//   • HOME RUNS WITHOUT A LANDING POINT. They exist — rare, but real (one in a
//     ~1,400-ball sample of MLB feeds) — so the plotted diamonds can under-count
//     the season's home runs. The card counts from the stored TOTALS and prints
//     a footnote when the two disagree; a card that silently plotted 29 of 30
//     would be quietly wrong forever.
//   • THE FLOORS. One card floor (does this player get a spray map at all) and
//     one split floor (is this chip too thin to read), kept apart because they
//     answer different questions.
import test from 'node:test'
import assert from 'node:assert/strict'
import { HIT_COORD_ORIGIN } from '../src/lib/ballpark/hitProjection.js'
import { aggregateGameSpray, foldGame } from '../scripts/gen-spray.mjs'
import {
  MIN_SPRAY_BIP,
  MIN_SPLIT_BIP,
  MIX_MINORITY_MAX,
  decodeSprayBalls,
  directionCaption,
  directionMix,
  directionOf,
  hrNote,
  splitBalls,
  splitTotals,
  sprayAngle,
  sprayView,
} from '../src/api/spray.js'

// A coordinate `deg` degrees off dead centre, `units` out from the origin —
// the inverse of sprayAngle, so a test can name an angle instead of a pixel.
function coordAt(deg, units = 100) {
  const rad = (deg * Math.PI) / 180
  return [
    Math.round((HIT_COORD_ORIGIN.x + units * Math.sin(rad)) * 100) / 100,
    Math.round((HIT_COORD_ORIGIN.y - units * Math.cos(rad)) * 100) / 100,
  ]
}

// One stored ball in play: [coordX, coordY, launchSpeed, result, hand, side,
// level, pitcherId] — the shard's own row shape.
const row = (deg, { ev = 92.1, r = 0, h = 0, s = 0, l = 0, pid = 500001 } = {}) => {
  const [x, y] = coordAt(deg)
  return [x, y, ev, r, h, s, l, pid]
}

// A shard entry with `n` rows vs each hand and totals that agree with them.
function entryOf({ p = [], o = { R: [0, 0, 0, 0, 0], L: [0, 0, 0, 0, 0] }, ...rest } = {}) {
  return { n: 'Test Batter', t: 158, b: 'R', p, o, ...rest }
}

const shardOf = (id, entry) => ({ season: 2026, asOf: '2026-08-23T07:00:00.000Z', bat: { [id]: entry } })

// ---------------------------------------------------------------- angles ----

test('sprayAngle reads dead centre as zero and the two lines as ±45', () => {
  assert.equal(sprayAngle(...coordAt(0)), 0)
  assert.equal(Math.round(sprayAngle(...coordAt(-45))), -45)
  assert.equal(Math.round(sprayAngle(...coordAt(45))), 45)
})

test('sprayAngle signs left field negative and right field positive', () => {
  assert.ok(sprayAngle(...coordAt(-30)) < 0)
  assert.ok(sprayAngle(...coordAt(30)) > 0)
})

test('sprayAngle is null for a missing coordinate', () => {
  assert.equal(sprayAngle(null, 90), null)
  assert.equal(sprayAngle(90, null), null)
})

// ------------------------------------------------------------- direction ----

test('a right-handed batter pulls to left field and goes oppo to right', () => {
  assert.equal(directionOf(-30, 'R'), 'pull')
  assert.equal(directionOf(30, 'R'), 'oppo')
  assert.equal(directionOf(0, 'R'), 'center')
})

test('a left-handed batter mirrors it — the same angle flips meaning', () => {
  assert.equal(directionOf(-30, 'L'), 'oppo')
  assert.equal(directionOf(30, 'L'), 'pull')
  assert.equal(directionOf(0, 'L'), 'center')
})

test('the centre third is the ±15° band, inclusive at the line', () => {
  assert.equal(directionOf(-15, 'R'), 'center')
  assert.equal(directionOf(15, 'R'), 'center')
  assert.equal(directionOf(-15.1, 'R'), 'pull')
  assert.equal(directionOf(15.1, 'R'), 'oppo')
})

test('a ball hooked past the foul line is still pull, not a fourth bucket', () => {
  assert.equal(directionOf(-62, 'R'), 'pull')
  assert.equal(directionOf(62, 'L'), 'pull')
})

test('directionCaption names the pull side for the side the split was hit from', () => {
  assert.equal(directionCaption('R'), 'Bats right — pull side is left field.')
  assert.equal(directionCaption('L'), 'Bats left — pull side is right field.')
  assert.equal(directionCaption(null), null)
})

test('directionMix counts the three thirds for a one-sided sample', () => {
  const balls = decodeSprayBalls(
    entryOf({
      p: [row(-30), row(-40), row(0), row(10), row(35)],
    }),
  )
  assert.deepEqual(directionMix(balls), { side: 'R', pull: 2, center: 2, oppo: 1, n: 5 })
})

test('directionMix refuses a switch-hitter sample — two mirrored halves do not sum', () => {
  const balls = decodeSprayBalls(
    entryOf({
      p: [row(-30, { s: 0 }), row(30, { s: 1 }), row(0, { s: 1 })],
    }),
  )
  assert.equal(directionMix(balls), null)
})

// A REAL CASE, not a hypothetical. Ozzie Albies turned around for exactly ONE
// of his 240 balls in play against right-handers this season. Under a strict
// "every ball from the same side" rule that lone at-bat silenced the whole
// vs-RHP bar — a 239-ball distribution withheld over 0.4% of itself. The rule
// is a MAJORITY one instead: a side that holds almost nothing does not make a
// split two-sided, and its balls are simply left out of the count so the three
// thirds still describe one stance and still sum to the sample.
test('one turned-around at-bat does not silence a one-sided split', () => {
  const balls = decodeSprayBalls(
    entryOf({ p: [...Array(30).fill(0).map(() => row(-30, { s: 1 })), row(30, { s: 0 })] }),
  )
  const mix = directionMix(balls)
  assert.equal(mix.side, 'L')
  assert.equal(mix.n, 30, 'the odd ball out is excluded, not folded into the other stance')
  assert.equal(mix.oppo, 30)
})

test('directionMix still refuses once the minority side is a real share of the sample', () => {
  const balls = decodeSprayBalls(
    entryOf({
      p: [
        ...Array(20).fill(0).map(() => row(-30, { s: 1 })),
        ...Array(20).fill(0).map(() => row(30, { s: 0 })),
      ],
    }),
  )
  assert.equal(directionMix(balls), null)
})

test('the minority share is a tenth of the sample, and the line is exclusive', () => {
  const oneSided = (minor) =>
    decodeSprayBalls(
      entryOf({
        p: [
          ...Array(100 - minor).fill(0).map(() => row(-30, { s: 0 })),
          ...Array(minor).fill(0).map(() => row(-30, { s: 1 })),
        ],
      }),
    )
  assert.equal(directionMix(oneSided(Math.round(100 * MIX_MINORITY_MAX) - 1)).n, 91)
  assert.equal(directionMix(oneSided(Math.round(100 * MIX_MINORITY_MAX) + 1)), null)
})

test('directionMix is null with nothing to count', () => {
  assert.equal(directionMix([]), null)
})

// ---------------------------------------------------------------- decode ----

test('decodeSprayBalls names every stored column', () => {
  const [ball] = decodeSprayBalls(entryOf({ p: [[100.5, 80.25, 103.4, 4, 1, 1, 1, 543037]] }))
  assert.deepEqual(ball, {
    x: 100.5,
    y: 80.25,
    exitVelo: 103.4,
    result: 'hr',
    hand: 'L',
    side: 'L',
    level: 'aaa',
    pitcherId: 543037,
  })
})

test('decodeSprayBalls keeps a ball whose park tracked no exit velocity', () => {
  const [ball] = decodeSprayBalls(entryOf({ p: [[100.5, 80.25, null, 1, 0, 0, 1, 543037]] }))
  assert.equal(ball.exitVelo, null)
  assert.equal(ball.result, 'single')
})

test('decodeSprayBalls is an empty list for an entry with no plotted balls', () => {
  assert.deepEqual(decodeSprayBalls(entryOf()), [])
  assert.deepEqual(decodeSprayBalls(null), [])
})

// ----------------------------------------------------------------- split ----

test('splitBalls filters on the hand of the pitcher, and All keeps everything', () => {
  const balls = decodeSprayBalls(entryOf({ p: [row(0, { h: 0 }), row(0, { h: 1 }), row(0, { h: 0 })] }))
  assert.equal(splitBalls(balls, 'all').length, 3)
  assert.equal(splitBalls(balls, 'R').length, 2)
  assert.equal(splitBalls(balls, 'L').length, 1)
})

test('splitTotals reads the stored per-hand totals', () => {
  const entry = entryOf({ o: { R: [300, 90, 30, 12, 140], L: [100, 25, 8, 4, 41] } })
  assert.deepEqual(splitTotals(entry, 'R'), { bip: 300, hits: 90, xbh: 30, hr: 12, hard: 140 })
  assert.deepEqual(splitTotals(entry, 'L'), { bip: 100, hits: 25, xbh: 8, hr: 4, hard: 41 })
})

test('All is the two halves added, never a third stored number', () => {
  const entry = entryOf({ o: { R: [300, 90, 30, 12, 140], L: [100, 25, 8, 4, 41] } })
  assert.deepEqual(splitTotals(entry, 'all'), { bip: 400, hits: 115, xbh: 38, hr: 16, hard: 181 })
})

test('splitTotals answers zeroes for a hand the batter never faced', () => {
  const entry = entryOf({ o: { R: [300, 90, 30, 12, 140] } })
  assert.deepEqual(splitTotals(entry, 'L'), { bip: 0, hits: 0, xbh: 0, hr: 0, hard: 0 })
})

// -------------------------------------------------------- home-run footnote --

test('hrNote is silent when every home run carries a landing point', () => {
  assert.equal(hrNote(12, 12), null)
  assert.equal(hrNote(0, 0), null)
})

test('hrNote says how many of the season home runs could be plotted', () => {
  assert.equal(hrNote(11, 12), '11 of 12 HR had tracked landing points')
  assert.equal(hrNote(0, 1), '0 of 1 HR had tracked landing points')
})

test('hrNote never reports more plotted than the totals hold', () => {
  assert.equal(hrNote(13, 12), null)
})

// ------------------------------------------------------------------ view ----

const bigEntry = (extra = {}) =>
  entryOf({
    p: [
      row(-30, { r: 1 }),
      row(-20, { r: 4 }),
      row(10, { r: 0, h: 1 }),
      row(0, { r: 2, ev: 101.2 }),
    ],
    o: { R: [50, 20, 6, 3, 24], L: [12, 4, 1, 1, 5] },
    ...extra,
  })

test('sprayView stands down under the card floor', () => {
  const thin = entryOf({ p: [row(0)], o: { R: [MIN_SPRAY_BIP - 1, 3, 1, 0, 5] } })
  assert.equal(sprayView(shardOf(661388, thin), 661388), null)
})

test('sprayView renders at exactly the card floor', () => {
  const atFloor = entryOf({ p: [row(0)], o: { R: [MIN_SPRAY_BIP, 3, 1, 0, 5] } })
  assert.ok(sprayView(shardOf(661388, atFloor), 661388))
})

test('sprayView is null for a player with no shard entry at all', () => {
  assert.equal(sprayView(shardOf(661388, bigEntry()), 111111), null)
  assert.equal(sprayView(null, 661388), null)
  assert.equal(sprayView({ bat: {} }, 661388), null)
})

test('sprayView orders the chips All, vs RHP, vs LHP and counts each', () => {
  const view = sprayView(shardOf(661388, bigEntry()), 661388)
  assert.deepEqual(
    view.splits.map((s) => [s.key, s.label, s.bip]),
    [
      ['all', 'All', 62],
      ['R', 'vs RHP', 50],
      ['L', 'vs LHP', 12],
    ],
  )
})

test('a split under the split floor is marked thin, and All never is', () => {
  const view = sprayView(shardOf(661388, bigEntry()), 661388)
  const by = Object.fromEntries(view.splits.map((s) => [s.key, s.thin]))
  assert.equal(by.L, true, `${MIN_SPLIT_BIP} is the floor a 12-ball split falls under`)
  assert.equal(by.R, false)
  assert.equal(by.all, false)
})

test('sprayView carries the identity and the levels the balls were hit at', () => {
  const view = sprayView(shardOf(661388, bigEntry({ n: 'William Contreras', t: 158, b: 'S' })), 661388)
  assert.equal(view.name, 'William Contreras')
  assert.equal(view.teamId, 158)
  assert.equal(view.bats, 'S')
  assert.deepEqual(view.levels, ['mlb'])
})

test('sprayView names both levels when the season crossed them, majors first', () => {
  const view = sprayView(
    shardOf(661388, bigEntry({ p: [row(0, { l: 1 }), row(10, { l: 0 }), row(-5, { l: 1 })] })),
    661388,
  )
  assert.deepEqual(view.levels, ['mlb', 'aaa'])
})

test('sprayView decodes the balls once, for the chart to filter', () => {
  const view = sprayView(shardOf(661388, bigEntry()), 661388)
  assert.equal(view.balls.length, 4)
  assert.equal(splitBalls(view.balls, 'L').length, 1)
})

// ------------------------------------------------------------- the sweep ----
//
// The generator's two pure halves — one game's fold, and the merge that carries
// a season of them. They sit in this file rather than a second one so the
// stored row shape is asserted from both ends at once: the sweep writes the
// eight columns and decodeSprayBalls reads them, and a swapped pair would fail
// here instead of drawing a mirrored spray map nobody could tell was wrong.

const bipEvent = (coordX, coordY, launchSpeed) => ({
  hitData: { launchSpeed, coordinates: { coordX, coordY } },
})

const gamePlay = ({
  half = 'top',
  eventType = 'single',
  batter = 660271,
  batterName = 'Test Batter',
  side = 'R',
  pitcher = 500001,
  hand = 'R',
  events = [bipEvent(...coordAt(-30), 96.2)],
}) => ({
  about: { halfInning: half },
  result: { eventType },
  matchup: {
    batter: { id: batter, fullName: batterName },
    batSide: { code: side },
    pitcher: { id: pitcher },
    pitchHand: { code: hand },
  },
  playEvents: events,
})

const gameFeed = (plays, players = { ID660271: { batSide: { code: 'R' } } }) => ({
  gameData: { game: { pk: 800001, season: 2026 }, teams: { away: { id: 158 }, home: { id: 143 } }, players },
  liveData: { plays: { allPlays: plays } },
})

test('aggregateGameSpray records one row per tracked ball in play', () => {
  const agg = aggregateGameSpray(gameFeed([gamePlay({}), gamePlay({ eventType: 'home_run' })]), 'mlb')
  const one = agg.get(660271)
  assert.equal(one.rows.length, 2)
  assert.deepEqual(one.rows[0].slice(2), [96.2, 1, 0, 0, 0, 500001])
  assert.deepEqual(one.rows[1].slice(3), [4, 0, 0, 0, 500001])
})

test('aggregateGameSpray counts hits, extra bases, home runs and hard contact', () => {
  const agg = aggregateGameSpray(
    gameFeed([
      gamePlay({ eventType: 'single', events: [bipEvent(...coordAt(-30), 96.2)] }),
      gamePlay({ eventType: 'double', events: [bipEvent(...coordAt(-10), 104)] }),
      gamePlay({ eventType: 'home_run', events: [bipEvent(...coordAt(20), 108)] }),
      gamePlay({ eventType: 'field_out', events: [bipEvent(...coordAt(0), 71.4)] }),
    ]),
    'mlb',
  )
  assert.deepEqual(agg.get(660271).totals.R, [4, 3, 2, 1, 3])
})

test('aggregateGameSpray ignores a plate appearance that never put a ball in play', () => {
  const agg = aggregateGameSpray(
    gameFeed([
      gamePlay({ eventType: 'strikeout', events: [{ isPitch: true }] }),
      gamePlay({ eventType: 'walk', events: [{ isPitch: true }] }),
    ]),
    'mlb',
  )
  assert.equal(agg.size, 0)
})

test('a home run with no landing point counts in the totals and plots nothing', () => {
  const agg = aggregateGameSpray(
    gameFeed([gamePlay({ eventType: 'home_run', events: [{ hitData: { launchSpeed: 104.8 } }] })]),
    'mlb',
  )
  const one = agg.get(660271)
  assert.equal(one.rows.length, 0)
  assert.deepEqual(one.totals.R, [1, 1, 1, 1, 1])
})

test('aggregateGameSpray files the batter under the club that was batting', () => {
  const agg = aggregateGameSpray(
    gameFeed([gamePlay({ half: 'top' }), gamePlay({ half: 'bottom', batter: 543037, batterName: 'Home Bat' })]),
    'mlb',
  )
  assert.equal(agg.get(660271).teamId, 158, 'the away club bats in the top half')
  assert.equal(agg.get(543037).teamId, 143, 'the home club bats in the bottom half')
})

test('aggregateGameSpray records the side the batter actually used this time up', () => {
  const agg = aggregateGameSpray(
    gameFeed([gamePlay({ hand: 'R', side: 'L' }), gamePlay({ hand: 'L', side: 'R' })], {
      ID660271: { batSide: { code: 'S' } },
    }),
    'mlb',
  )
  const one = agg.get(660271)
  assert.equal(one.bats, 'S', 'his listed side is the switch-hitter S, not either half of it')
  assert.deepEqual(
    one.rows.map((r) => [r[4], r[5]]),
    [
      [0, 1],
      [1, 0],
    ],
  )
})

test('aggregateGameSpray tags the level it swept', () => {
  const agg = aggregateGameSpray(gameFeed([gamePlay({})]), 'aaa')
  assert.equal(agg.get(660271).rows[0][6], 1)
})

test('aggregateGameSpray takes the LAST tracked event on a play, the one the result describes', () => {
  const agg = aggregateGameSpray(
    gameFeed([gamePlay({ events: [bipEvent(...coordAt(-40), 70), bipEvent(...coordAt(20), 99.5)] })]),
    'mlb',
  )
  const one = agg.get(660271)
  assert.equal(one.rows.length, 1)
  assert.equal(one.rows[0][2], 99.5)
})

test('foldGame accumulates a second game onto the first', () => {
  const store = {}
  foldGame(store, aggregateGameSpray(gameFeed([gamePlay({})]), 'mlb'), '2026-04-01')
  foldGame(store, aggregateGameSpray(gameFeed([gamePlay({ eventType: 'home_run' })]), 'mlb'), '2026-04-02')
  assert.equal(store[660271].p.length, 2)
  assert.deepEqual(store[660271].o.R, [2, 2, 1, 1, 2])
})

test('foldGame keeps the club from the LATEST game, whatever order the sweep ran', () => {
  const store = {}
  foldGame(store, aggregateGameSpray(gameFeed([gamePlay({ half: 'bottom' })]), 'mlb'), '2026-08-01')
  foldGame(store, aggregateGameSpray(gameFeed([gamePlay({ half: 'top' })]), 'mlb'), '2026-04-01')
  assert.equal(store[660271].t, 143, 'the April game must not overwrite the August club')
  assert.equal(store[660271].d, '2026-08-01')
})

test('the sweep writes the columns decodeSprayBalls reads', () => {
  const store = {}
  foldGame(
    store,
    aggregateGameSpray(gameFeed([gamePlay({ eventType: 'triple', hand: 'L', side: 'L' })]), 'aaa'),
    '2026-05-05',
  )
  const [ball] = decodeSprayBalls(store[660271])
  assert.equal(ball.result, 'triple')
  assert.equal(ball.hand, 'L')
  assert.equal(ball.side, 'L')
  assert.equal(ball.level, 'aaa')
  assert.equal(ball.pitcherId, 500001)
})
