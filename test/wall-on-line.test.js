// Unit coverage for the wall on a ball's line in src/lib/ballpark/ballFlight.js:
// the wall stands where the plan view draws it (the same outline, the same ray)
// at the height heightAt gives, and a height label prints only at a measured point.
//
// The real balls are from gamePk 824716, SEA @ BOS at Fenway, 2026-09-01, read
// through selectPlayBattedBall (the card's own selector); the comment on each
// gives its atBatIndex.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ballBearing,
  wallOnLine,
} from '../src/lib/ballpark/ballFlight.js'
import { wallDistanceAt } from '../src/lib/ballpark/ballparkGeometry.js'
import { measuredHeightAt } from '../src/lib/ballpark/layout/fenceShape.js'
import { fenceDistanceAt } from '../src/lib/ballpark/layout/fenceAudit.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'

const FENWAY = resolveBallparkLayout({ venueId: 3, gameDate: '2026-09-01' })

// atBatIndex 13: Arozarena homers over the Monster, to left field.
const MONSTER_HR = { hit: true, homeRun: true, exitVelo: 102.6, launchAngle: 30, distance: 382, trajectory: 'fly_ball', x: 60.1, y: 208.2 }

test('ballBearing: 0 at straightaway center, negative toward left field', () => {
  assert.equal(ballBearing({ x: 310, y: 105 }), 0)
  assert.ok(Math.abs(ballBearing({ x: 10, y: 205 }) + 45) < 1e-9)
  assert.ok(Math.abs(ballBearing({ x: 610, y: 205 }) - 45) < 1e-9)
})

test('the wall stands on the plan view\'s own outline, at heightAt\'s height', () => {
  const deg = ballBearing(MONSTER_HR)
  const wall = wallOnLine(FENWAY, deg)
  // The same ray through the same outline the top-down drawing inks.
  assert.ok(Math.abs(wall.ft - fenceDistanceAt(FENWAY.geometry.fence, deg)) < 0.1)
  assert.equal(wall.ft, 309.1)
  assert.equal(wall.height, 37.3)
  // -40 degrees is between Savant's measured points (-45 and -18): no label.
  assert.equal(wall.label, null)
})

test('a height label prints only at a measured point', () => {
  const h = FENWAY.measurements.measured.height
  assert.equal(measuredHeightAt(0, h), 17.2) // cf
  assert.equal(measuredHeightAt(-45, h), 37.3) // lf
  assert.equal(measuredHeightAt(19, h), 4) // rc, inside the 2 degree window
  assert.equal(measuredHeightAt(-30, h), null)
  assert.equal(wallOnLine(FENWAY, 0).label, 17.2)
  // Three posted heights only (no gaps): the gaps are not measured points.
  assert.equal(measuredHeightAt(-18, { lf: 10, cf: 8, rf: 12 }), null)
  assert.equal(measuredHeightAt(45, { lf: 10, cf: 8, rf: 12 }), 12)
})

test('no heights, no wall; no fence trace falls back to the posted outline the plan view draws', () => {
  assert.equal(wallOnLine({ measurements: { measured: null, wall: null }, geometry: { fence: null } }, 0), null)
  assert.equal(wallOnLine(null, 0), null)
  // Kansas City has Savant heights but no Gameday trace (fields.js fence: null).
  const kc = resolveBallparkLayout({ venueId: 7, gameDate: '2026-09-01' })
  assert.equal(kc.geometry.fence, null)
  const wall = wallOnLine(kc, 0)
  assert.equal(wall.ft, Math.round(wallDistanceAt(kc, 0) * 10) / 10)
  assert.ok(wall.ft > 380 && wall.ft < 420)
  assert.equal(wall.height, 8)
})

