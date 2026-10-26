// The chase camera's data (#2603): the tier of a revealed ball, and its
// time-stamped path. The hitData below is copied verbatim from the live feeds
// on 2026-10-26:
//  - Tier A, MLB, gamePk 824716 (SEA @ BOS, 2026-09-01; docs/test-games.md,
//    "Ball flight side view"): ab13 a 382-ft home run, ab33 the double off the
//    Monster, ab45 a popup.
//  - Tier B, AA gamePk 818937 and High-A gamePk 819070 (2026-07-10): trajectory,
//    location and coordinates, no exit velocity, angle or distance.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { ballTier, flightPath } from '../src/lib/gameday/flightPath.js'

const MLB_HR = { launchSpeed: 102.6, launchAngle: 30.0, totalDistance: 382.0, trajectory: 'fly_ball', hardness: 'medium', location: '7', coordinates: { coordX: 25.84, coordY: 80.04 } }
const MLB_DOUBLE = { launchSpeed: 98.0, launchAngle: 29.0, totalDistance: 331.0, trajectory: 'fly_ball', hardness: 'medium', location: '7', coordinates: { coordX: 62.9, coordY: 108.18 } }
const MLB_POPUP = { launchSpeed: 82.6, launchAngle: 77.0, totalDistance: 61.0, trajectory: 'popup', hardness: 'medium', location: '5', coordinates: { coordX: 113.3, coordY: 188.17 } }
const AA_GROUNDER = { trajectory: 'ground_ball', hardness: 'medium', location: '6', coordinates: { coordX: 112.97, coordY: 159.18 } }
const AA_LINER = { trajectory: 'line_drive', hardness: 'medium', location: '7', coordinates: { coordX: 66.96, coordY: 133.17 } }
const HIGH_A_HR = { trajectory: 'fly_ball', hardness: 'medium', location: '8', coordinates: { coordX: 131.08, coordY: 32.14 } }
const HIGH_A_GROUNDER = { trajectory: 'ground_ball', hardness: 'medium', location: '4', coordinates: { coordX: 147.78, coordY: 156.51 } }

test('the tier: A measured, B drawn, C none', () => {
  assert.deepEqual(ballTier(MLB_HR), { tier: 'A', tag: 'measured' })
  assert.deepEqual(ballTier(AA_LINER), { tier: 'B', tag: 'drawn' })
  const noCoord = { ...MLB_HR, coordinates: undefined }
  assert.deepEqual(ballTier(noCoord), { tier: 'C', tag: null })
  // A coordinate with no class to assume a launch from.
  assert.deepEqual(ballTier({ coordinates: AA_LINER.coordinates }), { tier: 'C', tag: null })
  assert.equal(flightPath(noCoord), null)
})

test('a missing location or missing hitData does not throw', () => {
  const { location, ...noLoc } = AA_GROUNDER
  assert.equal(flightPath(noLoc).location, null)
  assert.deepEqual(ballTier(undefined), { tier: 'C', tag: null })
  assert.equal(flightPath(null), null)
})

// Where the feed puts the ball, in feet from home plate (+x right field, +y center).
const coordFeet = (h) => ({
  x: (h.coordinates.coordX - 125.42) * 2.51,
  y: (198.27 - h.coordinates.coordY) * 2.51,
})

test('every path lands within 3 ft of the hit coordinate', () => {
  for (const h of [MLB_HR, MLB_DOUBLE, MLB_POPUP, AA_GROUNDER, AA_LINER, HIGH_A_HR, HIGH_A_GROUNDER]) {
    const end = flightPath(h).points.at(-1)
    const want = coordFeet(h)
    assert.ok(Math.hypot(end.x - want.x, end.y - want.y) <= 3, `${h.trajectory} ${JSON.stringify(h.coordinates)}`)
    assert.ok(end.z <= 0.5)
  }
})

test('the path starts at the bat and moves forward in time', () => {
  const p = flightPath(MLB_HR)
  assert.equal(p.points[0].t, 0)
  assert.ok(Math.abs(p.points.at(-1).t - p.T) < 1e-9)
  for (let i = 1; i < p.points.length; i++) assert.ok(p.points[i].t > p.points[i - 1].t)
})

test('hang time is plausible for each class', () => {
  const within = (h, lo, hi) => {
    const { T } = flightPath(h)
    assert.ok(T >= lo && T <= hi, `${h.trajectory}: T = ${T.toFixed(2)} s, want ${lo}-${hi}`)
  }
  within(MLB_HR, 4, 6.5)
  within(MLB_DOUBLE, 3.5, 6)
  within(MLB_POPUP, 4, 8)
  within(HIGH_A_HR, 4, 7.5)
  within(AA_LINER, 1, 3.5)
  within(AA_GROUNDER, 1, 3.7)
  within(HIGH_A_GROUNDER, 1, 3.7)
})

test('a fly ball rises; a ground ball stays low', () => {
  const apex = (h) => Math.max(...flightPath(h).points.map((q) => q.z))
  assert.ok(apex(MLB_HR) > 50)
  assert.ok(apex(MLB_POPUP) > 80)
  assert.ok(apex(AA_GROUNDER) < 5)
})

test('every tracked ball in a real game lands on its coordinate (gamePk 823169)', () => {
  const feed = JSON.parse(readFileSync(new URL('./fixtures/game-823169.gameday.json', import.meta.url), 'utf8'))
  let n = 0
  for (const p of feed.liveData.plays.allPlays) {
    for (const e of p.playEvents) {
      if (!e.hitData?.coordinates) continue
      const path = flightPath(e.hitData)
      if (!path) continue
      const end = path.points.at(-1)
      const want = coordFeet(e.hitData)
      assert.ok(Math.hypot(end.x - want.x, end.y - want.y) <= 3)
      n += 1
    }
  }
  assert.ok(n > 40)
})

test('the module imports none of the old visual pieces', () => {
  const src = readFileSync(new URL('../src/lib/gameday/flightPath.js', import.meta.url), 'utf8')
  for (const old of ['pitcherCard/', 'camera.js', 'batted.js', 'contactTimeline.js', 'SideView', 'sideWall']) {
    assert.equal(src.includes(`from '../${old}`) || new RegExp(`import[^\\n]*${old}`).test(src), false, old)
  }
})
