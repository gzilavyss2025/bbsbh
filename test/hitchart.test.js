// Unit coverage for src/api/hitchart.js — the reveal-only hit chart's data
// layer: the Gameday-coordinate → ballpark-diagram projection, and the walk
// that turns a feed into one entry per batted ball.
//
// THE CAPTURED FIXTURE. `test/fixtures/hitdata-823427.trimmed.json` is a
// field-trimmed snapshot of gamePk 823427 (2026-08-17, Marlins at Phillies,
// Citizens Bank Park), captured the way docs/testing.md describes the suite's
// other captured feed: real bytes, pruned to the paths the code under test
// actually reads. It keeps `gamePk`, `gameData.venue.name`,
// `gameData.teams.away/home` {id, name, abbreviation}, and
// `liveData.plays.allPlays` — and of those plays, only the 62 that carry a
// batted ball, each pruned to `about` {inning, halfInning}, `result` {event,
// eventType, description}, `matchup.batter` {id, fullName}, `runners[]`
// {details.runner.id, movement, credits} and the `playEvents[]` entries
// holding `hitData`. The runners and their fielding credits are kept
// deliberately: they are what `scorebookCode` reads, so the dot's notation is
// pinned against the same rows the play-by-play feed would see. Every one of
// the 62 balls has coordinates, 61 carry an exit velocity, 27 of those are
// hard hit, and exactly one is a home run.
//
// The suite's OTHER captured feed, `game-823035.trimmed.json`, cannot pin the
// projection: it holds 58 `hitData` blocks and not one `coordinates` pair, its
// trimmer having kept only launchSpeed and totalDistance. That makes it the
// right fixture for the opposite half of the contract — hitData present,
// coordinates absent, chart empty — which is exactly how a MiLB park behaves.
//
// THE SCALE PIN. HIT_COORD_FT_PER_UNIT is empirical: MLB documents neither the
// coordinate origin nor its units, so the only honest check is that a plotted
// ball still sits the distance from home that the feed itself reports for it.
// The sample is every caught fly ball (trajectory `fly_ball`/`popup`,
// eventType `field_out`) carrying a `totalDistance` across three real games —
// gamePk 823427's nine read straight off the fixture, plus gamePks 823589 and
// 824320's thirty-one as coordinate tuples below, since those two games are
// needed for breadth and for nothing else. Forty balls, captured whole,
// nothing dropped. Without this test a feed change that moved the origin or
// the scale would slide every dot on the chart and fail nothing.
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { buildFeed } from './fixtures/mini-game.js'
import { HOME, VIEWBOX } from '../src/lib/ballpark/ballparkGeometry.js'
import { scorebookCode } from '../src/api/playbyplay/scorebookCode.js'
import {
  HARD_HIT_MPH,
  HIT_COORD_ORIGIN,
  HIT_COORD_FT_PER_UNIT,
  hitCoordToSvg,
  selectBattedBalls,
} from '../src/api/hitchart.js'

const FEED = JSON.parse(
  readFileSync(new URL('./fixtures/hitdata-823427.trimmed.json', import.meta.url), 'utf8'),
)
const COORDLESS_FEED = JSON.parse(
  readFileSync(new URL('./fixtures/game-823035.trimmed.json', import.meta.url), 'utf8'),
)

const MIA = 146
const PHI = 143

// gamePk 823427's own caught fly balls, read off the fixture rather than
// copied out of it.
const FIXTURE_FLIES = FEED.liveData.plays.allPlays.flatMap((p) =>
  p.result.eventType !== 'field_out'
    ? []
    : p.playEvents
        .map((e) => e.hitData)
        .filter((h) => (h.trajectory === 'fly_ball' || h.trajectory === 'popup') && h.totalDistance != null)
        .map((h) => [823427, h.trajectory, h.coordinates.coordX, h.coordinates.coordY, h.totalDistance]),
)

// The same sample from two more games, as [gamePk, trajectory, coordX, coordY,
// totalDistance]. Only the coordinates matter here, so these two games ride as
// tuples instead of a second and third captured feed.
const MORE_FLIES = [
  [823589, 'fly_ball', 78.23, 69.19, 344],
  [823589, 'fly_ball', 191.77, 79.71, 338],
  [823589, 'popup', 154.73, 128.31, 195],
  [823589, 'fly_ball', 147.11, 56.16, 359],
  [823589, 'fly_ball', 71.82, 131.89, 217],
  [823589, 'popup', 157.65, 154.12, 142],
  [823589, 'fly_ball', 158.18, 109.55, 240],
  [823589, 'fly_ball', 206.51, 114.99, 288],
  [823589, 'fly_ball', 168.14, 68.1, 342],
  [823589, 'fly_ball', 205.3, 84.98, 343],
  [823589, 'popup', 146.24, 152.19, 132],
  [823589, 'popup', 150.29, 192.22, 40],
  [824320, 'popup', 83.91, 185.63, 106],
  [824320, 'fly_ball', 133.14, 38.94, 397],
  [824320, 'fly_ball', 138.45, 66.67, 331],
  [824320, 'fly_ball', 136.1, 131.41, 216],
  [824320, 'fly_ball', 74.1, 115.57, 247],
  [824320, 'popup', 81.96, 181.57, 119],
  [824320, 'fly_ball', 121.79, 53.37, 362],
  [824320, 'fly_ball', 77.07, 127.53, 218],
  [824320, 'fly_ball', 180.57, 80.86, 324],
  [824320, 'fly_ball', 65.87, 61.64, 371],
  [824320, 'popup', 160.14, 174.94, 108],
  [824320, 'fly_ball', 49.15, 115.46, 282],
  [824320, 'fly_ball', 37.7, 108.61, 312],
  [824320, 'fly_ball', 93.11, 80.79, 306],
  [824320, 'fly_ball', 131.7, 67.7, 328],
  [824320, 'fly_ball', 160.29, 95.67, 273],
  [824320, 'fly_ball', 87.79, 42.67, 398],
  [824320, 'fly_ball', 176.05, 88.38, 303],
  [824320, 'fly_ball', 181.71, 106.58, 248],
]

const CAUGHT_FLIES = [...FIXTURE_FLIES, ...MORE_FLIES]

// Feet from home plate to a plotted point — the diagram maps feet 1:1 to SVG
// units, so this is a plain distance in the drawing's own space.
const plottedFeet = (p) => Math.hypot(p.x - HOME.x, p.y - HOME.y)

// A ball off the fixture, by the man who hit it and the inning he hit it in.
const ball = (balls, batter, inning) => balls.find((b) => b.batter === batter && b.inning === inning)

// --------------------------------------------------------------------------
// hitCoordToSvg — the projection
// --------------------------------------------------------------------------
test('hitCoordToSvg puts the coordinate origin exactly on home plate', () => {
  assert.deepEqual(hitCoordToSvg(HIT_COORD_ORIGIN.x, HIT_COORD_ORIGIN.y), { x: HOME.x, y: HOME.y })
})

test('hitCoordToSvg lands a known coordinate where the geometry says it should', () => {
  // Luis Arraez's 329-foot fly to center, bottom of the 1st. Slightly right of
  // the origin (133.76 > 125.42) and well up the screen toward center.
  const p = hitCoordToSvg(133.76, 79.01)
  assert.deepEqual(p, { x: 330.9, y: 205.7 })
  assert.ok(p.x > HOME.x, 'a coordX right of the origin plots right of home')
  assert.ok(p.y < HOME.y, 'a ball hit toward center plots UP the screen')
})

test('hitCoordToSvg returns null when either coordinate is missing', () => {
  assert.equal(hitCoordToSvg(null, 79.01), null)
  assert.equal(hitCoordToSvg(133.76, null), null)
  assert.equal(hitCoordToSvg(null, null), null)
  assert.equal(hitCoordToSvg(undefined, undefined), null)
})

// --------------------------------------------------------------------------
// THE SCALE PIN. Two assertions, one tight and one broad, because the
// population is not uniform: a deep fly ball is measured cleanly, while a short
// foul popup lands almost on top of the origin, where a few pixels of
// coordinate jitter swamp the ratio.
// --------------------------------------------------------------------------
test('every deep caught fly ball plots within 12% of the distance the feed reports', () => {
  const deep = CAUGHT_FLIES.filter(([, traj, , , d]) => traj === 'fly_ball' && d >= 250)
  assert.ok(deep.length >= 20, `expected a real sample of deep flies, got ${deep.length}`)
  for (const [pk, traj, x, y, d] of deep) {
    const err = Math.abs(plottedFeet(hitCoordToSvg(x, y)) - d) / d
    assert.ok(err <= 0.12, `gamePk ${pk} ${traj} (${x}, ${y}): ${d} ft plots ${err.toFixed(3)} off`)
  }
})

test('the median caught fly ball plots within 5% of the distance the feed reports', () => {
  assert.equal(FIXTURE_FLIES.length, 9)
  const errs = CAUGHT_FLIES.map(([, , x, y, d]) => Math.abs(plottedFeet(hitCoordToSvg(x, y)) - d) / d)
    .sort((a, b) => a - b)
  assert.equal(errs.length, 40)
  const median = errs[Math.floor(errs.length / 2)]
  assert.ok(median <= 0.05, `median error ${median.toFixed(3)} — the origin or the scale moved`)
  assert.equal(HIT_COORD_FT_PER_UNIT, 2.51)
})

test('every captured ball plots inside the diagram viewBox', () => {
  const points = [
    ...CAUGHT_FLIES.map(([, , x, y]) => hitCoordToSvg(x, y)),
    ...selectBattedBalls(FEED),
  ]
  assert.equal(points.length, 102)
  for (const p of points) {
    assert.ok(p.x >= 0 && p.x <= VIEWBOX.w, `x ${p.x} outside 0..${VIEWBOX.w}`)
    assert.ok(p.y >= 0 && p.y <= VIEWBOX.h, `y ${p.y} outside 0..${VIEWBOX.h}`)
  }
})

// --------------------------------------------------------------------------
// selectBattedBalls
// --------------------------------------------------------------------------
test('selectBattedBalls returns one entry per batted ball, each with its own id', () => {
  const balls = selectBattedBalls(FEED)
  assert.equal(balls.length, 62)
  assert.equal(new Set(balls.map((b) => b.id)).size, 62)
  // Every entry actually plots — a ball with no point is dropped, not carried
  // with a null coordinate.
  assert.ok(balls.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y)))
})

test('selectBattedBalls carries the Statcast fields and the plotted point', () => {
  const hr = selectBattedBalls(FEED).find((b) => b.homeRun)
  assert.equal(hr.batter, 'Brian Navarreto')
  assert.equal(hr.exitVelo, 103.4)
  assert.equal(hr.launchAngle, 23)
  assert.equal(hr.distance, 368)
  assert.equal(hr.trajectory, 'fly_ball')
  assert.equal(hr.inning, 8)
  assert.equal(hr.half, 'top')
  assert.deepEqual({ x: hr.x, y: hr.y }, hitCoordToSvg(27.07, 86.68))
  // Exactly one ball in the game has no exit velocity on record — carried as
  // null rather than dropped, since where it landed is still known.
  const balls = selectBattedBalls(FEED)
  assert.equal(balls.filter((b) => b.exitVelo == null).length, 1)
})

test('hits and home runs classify off the eventType', () => {
  const balls = selectBattedBalls(FEED)
  assert.equal(balls.filter((b) => b.hit).length, 25)
  assert.equal(balls.filter((b) => b.homeRun).length, 1)
  assert.equal(ball(balls, 'Bryce Harper', 1).hit, true) // single
  assert.equal(ball(balls, 'Bryce Harper', 1).homeRun, false)
  assert.equal(ball(balls, 'Luis Arraez', 1).hit, false) // flied out
  assert.equal(ball(balls, 'J.T. Realmuto', 2).hit, false) // reached on a force out
  // A home run is a hit too — the two flags are not exclusive.
  assert.equal(ball(balls, 'Brian Navarreto', 8).hit, true)
  assert.equal(ball(balls, 'Brian Navarreto', 8).homeRun, true)
})

test("code and codeKind are the app's own scorebook denotation, not a second spelling", () => {
  const balls = selectBattedBalls(FEED)
  assert.equal(ball(balls, 'Esteury Ruiz', 1).code, '6-3') // grounds out, SS to 1B
  assert.equal(ball(balls, 'Esteury Ruiz', 1).codeKind, 'out')
  assert.equal(ball(balls, 'Bryce Harper', 1).code, '1B')
  assert.equal(ball(balls, 'Bryce Harper', 1).codeKind, 'hit')
  assert.equal(ball(balls, 'Luis Arraez', 1).code, 'F8') // flies out to center
  assert.equal(ball(balls, 'J.T. Realmuto', 2).code, 'FC') // grounds into a force out
  assert.equal(ball(balls, 'J.T. Realmuto', 2).codeKind, 'reach')
  assert.equal(ball(balls, 'Brian Navarreto', 6).code, '4-3')
  assert.equal(ball(balls, 'Brian Navarreto', 6).exitVelo, 107.7)
  assert.equal(ball(balls, 'Brian Navarreto', 8).code, 'HR')
  assert.equal(ball(balls, 'Brian Navarreto', 8).exitVelo, 103.4)

  // The trimmed runners/credits are complete enough for the real thing: every
  // one of the 62 balls gets a mark, and each is exactly what scorebookCode
  // returns for that same play read the same way.
  assert.equal(balls.filter((b) => !b.code).length, 0)
  const plays = FEED.liveData.plays.allPlays
  for (let i = 0; i < plays.length; i++) {
    const p = plays[i]
    const batterId = p.matchup.batter.id
    const batterRunner =
      p.runners.find((r) => r.details.runner.id === batterId && r.movement.start == null) ??
      p.runners.find((r) => r.details.runner.id === batterId)
    assert.equal(balls[i].code, scorebookCode(p, batterRunner).code)
  }
  // Not one flat answer repeated — the sample really does span the notation.
  assert.ok(new Set(balls.map((b) => b.code)).size >= 20)
})

test('teamId and isHome name the BATTING club', () => {
  const balls = selectBattedBalls(FEED)
  for (const b of balls) {
    assert.equal(b.teamId, b.half === 'bottom' ? PHI : MIA)
    assert.equal(b.isHome, b.half === 'bottom')
  }
  assert.equal(selectBattedBalls(FEED, { teamId: MIA }).length, 30)
  assert.equal(selectBattedBalls(FEED, { teamId: PHI }).length, 32)
  assert.ok(selectBattedBalls(FEED, { teamId: PHI }).every((b) => b.isHome))
  assert.equal(selectBattedBalls(FEED, { teamId: 999 }).length, 0)
})

test('throughHalfIndex clamps the chart to the halves the reader has opened', () => {
  // top 1st = 0, bottom 1st = 1, top 8th = 14.
  assert.equal(selectBattedBalls(FEED, { throughHalfIndex: -1 }).length, 0)
  assert.equal(selectBattedBalls(FEED, { throughHalfIndex: 0 }).length, 2)
  assert.equal(selectBattedBalls(FEED, { throughHalfIndex: 1 }).length, 5)
  assert.equal(selectBattedBalls(FEED, { throughHalfIndex: 3 }).length, 12)
  assert.equal(selectBattedBalls(FEED, { throughHalfIndex: 17 }).length, 62)
  // The 8th-inning home run is the one a premature chart would leak.
  assert.ok(!selectBattedBalls(FEED, { throughHalfIndex: 13 }).some((b) => b.homeRun))
  assert.ok(selectBattedBalls(FEED, { throughHalfIndex: 14 }).some((b) => b.homeRun))
  // Both filters compose.
  assert.equal(selectBattedBalls(FEED, { teamId: MIA, throughHalfIndex: 1 }).length, 2)
})

test('a feed with no hit coordinates charts nothing instead of crashing', () => {
  // game-823035.trimmed.json carries 58 hitData blocks and not one coordinate
  // pair — the same shape most MiLB parks send.
  assert.equal(selectBattedBalls(COORDLESS_FEED).length, 0)
  // The hand-built mini feed carries no hitData at all.
  assert.equal(selectBattedBalls(buildFeed()).length, 0)
  // And the degenerate inputs every selector here has to survive.
  assert.deepEqual(selectBattedBalls(null), [])
  assert.deepEqual(selectBattedBalls(undefined), [])
  assert.deepEqual(selectBattedBalls({}), [])
  assert.deepEqual(selectBattedBalls({ liveData: { plays: { allPlays: [{}] } } }), [])
})

test('a batted ball with no Statcast detail still plots, with nulls', () => {
  // A park that tracked where the ball landed and nothing else. Hand-built:
  // no real game in the sample degrades this far, and the point is that the
  // chart survives one that does.
  const bare = {
    gameData: { teams: { away: { id: MIA }, home: { id: PHI } } },
    liveData: {
      plays: {
        allPlays: [
          {
            about: { inning: 3, halfInning: 'top' },
            result: {
              eventType: 'double',
              description: 'A Batter doubles on a line drive to left fielder B Fielder.',
            },
            matchup: { batter: { id: 1, fullName: 'A Batter' } },
            runners: [
              {
                details: { runner: { id: 1 } },
                movement: { start: null, end: '2B', isOut: false, outNumber: null },
                credits: [],
              },
            ],
            playEvents: [{ hitData: { coordinates: { coordX: 60.5, coordY: 90.25 } } }],
          },
        ],
      },
    },
  }
  const [b] = selectBattedBalls(bare)
  assert.equal(b.exitVelo, null)
  assert.equal(b.launchAngle, null)
  assert.equal(b.distance, null)
  assert.equal(b.trajectory, null)
  assert.equal(b.hit, true)
  assert.equal(b.code, '2B')
  assert.deepEqual({ x: b.x, y: b.y }, hitCoordToSvg(60.5, 90.25))
})

test("HARD_HIT_MPH is Statcast's own 95 mph line", () => {
  assert.equal(HARD_HIT_MPH, 95)
  const balls = selectBattedBalls(FEED)
  assert.equal(balls.filter((b) => b.exitVelo != null && b.exitVelo >= HARD_HIT_MPH).length, 27)
  assert.equal(ball(balls, 'Brian Navarreto', 6).exitVelo >= HARD_HIT_MPH, true)
  assert.equal(ball(balls, 'Luis Arraez', 1).exitVelo >= HARD_HIT_MPH, false)
})
