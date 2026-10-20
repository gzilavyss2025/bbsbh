// Unit coverage for the side view in src/lib/ballpark/ballFlight.js (#1875):
// a batted ball's height against its distance from the plate, with the park's
// wall on the ball's own line.
//
// WHAT IS WORTH PINNING HERE.
//   1. The wall stands where the plan view draws it (the same outline, the same
//      ray) at the height heightAt gives, and a height label prints only at a
//      measured point.
//   2. THE DRAWING AGREES WITH THE RESULT: a home run clears the wall, and a ball
//      that stayed in the park ends at the wall, under its top.
//   3. The peak is not the no-drag tan/4 guess, which is far too low for a real
//      fly ball: two Statcast-measured home runs pin the model's peak.
//   4. A ground ball is flat, and a ball with no angle or no distance has no
//      side view at all (the card hides its toggle).
//
// The real balls are from gamePk 824716, SEA @ BOS at Fenway, 2026-09-01, read
// through selectPlayBattedBall (the card's own selector); the comment on each
// gives its atBatIndex.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ballBearing,
  elevationArc,
  hasElevationArc,
  heightOnArc,
  HOME_RUN_CLEAR_FT,
  wallOnLine,
} from '../src/lib/ballpark/ballFlight.js'
import { wallDistanceAt } from '../src/lib/ballpark/ballparkGeometry.js'
import { measuredHeightAt } from '../src/lib/ballpark/layout/fenceShape.js'
import { fenceDistanceAt } from '../src/lib/ballpark/layout/fenceAudit.js'
import { resolveBallparkLayout } from '../src/lib/ballpark/layout/resolveLayout.js'

const FENWAY = resolveBallparkLayout({ venueId: 3, gameDate: '2026-09-01' })

// atBatIndex 13: Arozarena homers over the Monster, to left field.
const MONSTER_HR = { hit: true, homeRun: true, exitVelo: 102.6, launchAngle: 30, distance: 382, trajectory: 'fly_ball', x: 60.1, y: 208.2 }
// atBatIndex 33: Raleigh doubles to left field. Statcast's distance (331) is
// past the wall (313), but the ball stayed in: it came off the Monster.
const MONSTER_DOUBLE = { hit: true, homeRun: false, exitVelo: 98, launchAngle: 29, distance: 331, trajectory: 'fly_ball', x: 153.1, y: 278.9 }
// atBatIndex 45: Rodríguez pops out to third, 77 degrees.
const POPUP = { hit: false, homeRun: false, exitVelo: 82.6, launchAngle: 77, distance: 61, trajectory: 'popup', x: 279.6, y: 479.6 }

test('hasElevationArc: needs a launch angle and a distance', () => {
  assert.equal(hasElevationArc(MONSTER_HR), true)
  assert.equal(hasElevationArc({ ...MONSTER_HR, launchAngle: null }), false)
  assert.equal(hasElevationArc({ ...MONSTER_HR, distance: null }), false)
  assert.equal(hasElevationArc({ ...MONSTER_HR, distance: 0 }), false)
  assert.equal(hasElevationArc(null), false)
  assert.equal(elevationArc({ ...MONSTER_HR, launchAngle: null }, FENWAY), null)
})

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
  assert.equal(wall.ft, 309.4)
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

test('a home run always clears the wall', () => {
  const arc = elevationArc(MONSTER_HR, FENWAY)
  assert.equal(arc.atWall, false)
  assert.deepEqual(arc.pts.at(-1), [382, 0])
  assert.ok(heightOnArc(arc.pts, arc.wall.ft) >= arc.wall.height + HOME_RUN_CLEAR_FT - 0.2)
  // One the model would put INTO the wall: lifted to clear it.
  const low = { ...MONSTER_HR, exitVelo: 100, launchAngle: 22, distance: 340 }
  const raw = elevationArc(low, null)
  assert.ok(heightOnArc(raw.pts, 309.4) < 37.3)
  const lifted = elevationArc(low, FENWAY)
  assert.ok(heightOnArc(lifted.pts, lifted.wall.ft) >= lifted.wall.height + HOME_RUN_CLEAR_FT - 0.2)
})

test('a ball that stayed in ends at the wall, under its top', () => {
  const arc = elevationArc(MONSTER_DOUBLE, FENWAY)
  assert.equal(arc.atWall, true)
  const [x, z] = arc.pts.at(-1)
  assert.equal(x, arc.wall.ft)
  assert.ok(z > 0 && z <= arc.wall.height)
  assert.ok(arc.pts.every(([px]) => px <= arc.wall.ft))
  // A fly that would have cleared it is held to the top: the feed says it stayed in.
  const high = elevationArc({ ...MONSTER_DOUBLE, launchAngle: 34, exitVelo: 104, distance: 360 }, FENWAY)
  assert.ok(high.pts.at(-1)[1] <= high.wall.height + 0.05)
})

test('the peak agrees with two Statcast-measured home runs (Nathan, "A Tale of Two Dingers")', () => {
  // 471 ft at 26.1 degrees, 107.3 mph: measured peak 97 ft. tan/4 says 58.
  const long = elevationArc({ exitVelo: 107.3, launchAngle: 26.1, distance: 471, trajectory: 'fly_ball' })
  assert.ok(Math.abs(long.peak.z - 97) < 10, `peak ${long.peak.z}`)
  // 400 ft at 22.8 degrees, 110.8 mph: measured peak 63 ft. tan/4 says 42.
  const short = elevationArc({ exitVelo: 110.8, launchAngle: 22.8, distance: 400, trajectory: 'fly_ball' })
  assert.ok(Math.abs(short.peak.z - 63) < 10, `peak ${short.peak.z}`)
  assert.equal(long.modelled, true)
  // The landing is the measured distance, exactly.
  assert.deepEqual(long.pts.at(-1), [471, 0])
})

test('a popup towers over a line drive; with no speed the arc is the tan/4 parabola', () => {
  const pop = elevationArc(POPUP, FENWAY)
  const liner = elevationArc({ exitVelo: 104, launchAngle: 14, distance: 260, trajectory: 'line_drive' })
  assert.ok(pop.peak.z > 120)
  assert.ok(liner.peak.z < 30)
  // A foul popup is off the wall's ray: no wall.
  assert.equal(pop.wall, null)
  const plain = elevationArc({ exitVelo: null, launchAngle: 30, distance: 300, trajectory: 'fly_ball' })
  assert.equal(plain.modelled, false)
  assert.ok(Math.abs(plain.peak.z - (300 * Math.tan(Math.PI / 6)) / 4) < 0.2)
  assert.equal(plain.peak.x, 150)
})

test('a ground ball draws flat, by trajectory or by angle', () => {
  const byTraj = elevationArc({ exitVelo: 101, launchAngle: 14, distance: 120, trajectory: 'ground_ball' }, FENWAY)
  assert.equal(byTraj.grounded, true)
  assert.equal(byTraj.peak, null)
  assert.deepEqual(byTraj.pts, [[0, 0], [120, 0]])
  const byAngle = elevationArc({ exitVelo: 95, launchAngle: 4, distance: 90, trajectory: null })
  assert.equal(byAngle.grounded, true)
})

// ---- Code-review fixes: a result rule bends the DESCENT only, never the peak ----

const LF = { x: 60.1, y: 208.2 } // Fenway, about -40 degrees: the Monster
const CF = { x: 310, y: 105 } // straightaway center

const monotonic = (pts) => pts.every(([x], i) => i === 0 || x >= pts[i - 1][0])

test('a home run reaching the wall low keeps its own peak (no 342 ft blow-up)', () => {
  const ball = { ...LF, hit: true, homeRun: true, exitVelo: 95, launchAngle: 22, distance: 318, trajectory: 'fly_ball' }
  const free = elevationArc({ ...ball, x: null, y: null })
  const arc = elevationArc(ball, FENWAY)
  assert.ok(heightOnArc(arc.pts, arc.wall.ft) >= arc.wall.height + HOME_RUN_CLEAR_FT - 0.2)
  // The bend may lift the descent into a new, later top, but never by a factor:
  // the old whole-arc scale printed 342 ft here, against the model's 41 ft.
  assert.ok(arc.peak.z < free.peak.z * 1.5, `peak ${arc.peak.z}`)
  // Everything up to the free arc's peak is untouched.
  const upTo = free.pts.filter(([x]) => x <= free.peak.x)
  assert.deepEqual(arc.pts.slice(0, upTo.length), upTo)
  assert.deepEqual(arc.pts.at(-1), [318, 0])
})

test('a ball caught at the wall keeps its peak and meets the wall under its top', () => {
  const ball = { ...CF, hit: false, homeRun: false, exitVelo: 104, launchAngle: 28, distance: 425, trajectory: 'fly_ball' }
  const free = elevationArc({ ...ball, x: null, y: null })
  const arc = elevationArc(ball, FENWAY)
  assert.equal(arc.atWall, true)
  assert.deepEqual(arc.peak, free.peak)
  const [x, z] = arc.pts.at(-1)
  assert.equal(x, arc.wall.ft)
  assert.ok(z <= arc.wall.height + 0.05)
})

test('a home run that lands short of the drawn wall draws no wall', () => {
  const arc = elevationArc({ ...LF, hit: true, homeRun: true, exitVelo: 95, launchAngle: 28, distance: 302, trajectory: 'fly_ball' }, FENWAY)
  assert.equal(arc.wall, null)
  assert.deepEqual(arc.pts.at(-1), [302, 0])
})

test('the arc never runs past its landing and back', () => {
  for (let la = 12; la <= 70; la += 2) {
    for (const [ev, dist] of [[95, 300], [105, 410], [80, 150]]) {
      const arc = elevationArc({ exitVelo: ev, launchAngle: la, distance: dist, trajectory: 'fly_ball' })
      assert.ok(monotonic(arc.pts), `la ${la} ev ${ev}`)
      assert.deepEqual(arc.pts.at(-1), [dist, 0])
    }
  }
})
