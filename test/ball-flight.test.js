// Unit coverage for src/lib/ballpark/ballFlight.js — the batted ball's path
// from home plate to where it came down, drawn in the ballpark diagram's own
// SVG space.
//
// WHAT IS WORTH PINNING HERE. The module makes three claims a reader of the
// card is entitled to trust, and each is easy to break silently:
//
//   1. A ball on the ground draws a STRAIGHT line. A grounder's coordinate is
//      where a fielder reached it, so a bowed path would draw a hop it never
//      took. Two feeds report this two ways (a `trajectory` of 'ground_ball',
//      or a launch angle at or under the cutoff) and both must land flat.
//   2. The bow's depth is the ball's own apex height in feet — range × tan(angle)
//      / 4 — so a line drive bends less than a fly ball and a fly ball less than
//      a popup. A monotonic check is what catches a sign flip or a
//      degrees/radians slip that still "looks like an arc", and the exact number
//      is pinned because the bow is a measurement, not a flourish.
//   3. The bow rises UP THE FRAME. A ball down either line then bends back over
//      fair ground rather than ballooning past the foul line, and one popped up
//      behind the plate bends toward the field rather than off the paper.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ballFlightPath,
  bowSagitta,
  GROUND_BALL_MAX_ANGLE,
  MAX_BOW_FRACTION,
  MAX_BOW_FT,
} from '../src/lib/ballpark/ballFlight.js'
import { HOME } from '../src/lib/ballpark/ballparkGeometry.js'

// A point `ft` feet from home at `deg` off straightaway center (negative =
// toward left field), in diagram units — the same 1:1 feet-to-units mapping
// ballparkGeometry.js draws the park in.
function landing(deg, ft) {
  const rad = (deg * Math.PI) / 180
  return { x: HOME.x + ft * Math.sin(rad), y: HOME.y - ft * Math.cos(rad) }
}

// The control point of a quadratic `M x y Q cx cy ex ey`.
function control(d) {
  const m = d.match(/Q ([-\d.]+) ([-\d.]+)/)
  assert.ok(m, `expected a quadratic path, got ${d}`)
  return { x: Number(m[1]), y: Number(m[2]) }
}

test('a ground ball draws a straight line, by trajectory or by angle', () => {
  const spot = landing(-20, 90)
  const byTrajectory = ballFlightPath(spot, 24, 'ground_ball')
  assert.equal(byTrajectory.grounded, true)
  assert.match(byTrajectory.d, /^M \d+ \d+ L /)

  const byAngle = ballFlightPath(spot, GROUND_BALL_MAX_ANGLE, 'line_drive')
  assert.equal(byAngle.grounded, true)
  assert.match(byAngle.d, /^M \d+ \d+ L /)

  // A ball driven INTO the dirt reports a negative angle; it is on the ground
  // by the same rule, not bowed the other way.
  assert.equal(ballFlightPath(spot, -12, null).grounded, true)

  // A park that tracked the landing spot and nothing else still gets a path.
  assert.equal(ballFlightPath(spot, null, null).grounded, true)
})

test('the bow is the apex height, and both caps hold', () => {
  const chord = 300
  const liner = bowSagitta(chord, 15)
  const fly = bowSagitta(chord, 30)
  const high = bowSagitta(chord, 45)
  assert.ok(liner > 0 && liner < fly && fly < high, `${liner} < ${fly} < ${high}`)
  // A 300-foot fly at 30° peaks around 43 feet, and that is the depth of the
  // bow. Stated as the number, so a rewrite cannot quietly redefine it.
  assert.equal(Math.round(fly), 43)
  // The absolute cap: nothing peaks higher than this, so nothing bows off the
  // top of the drawing.
  assert.equal(bowSagitta(chord, 89), MAX_BOW_FT)
  // The share cap: a popup that came down forty feet from the plate really did
  // peak higher than that, but drawn to scale it would loop across the infield.
  assert.equal(bowSagitta(40, 80), 40 * MAX_BOW_FRACTION)
  assert.equal(bowSagitta(0, 30), 0)
})

test('the bow rises up the frame, which sends it back over fair ground', () => {
  const toLeft = ballFlightPath(landing(-40, 330), 28, 'fly_ball')
  const toRight = ballFlightPath(landing(40, 330), 28, 'fly_ball')
  const leftMidX = (HOME.x + landing(-40, 330).x) / 2
  const rightMidX = (HOME.x + landing(40, 330).x) / 2
  // Left field bends right of its own chord, right field bends left of its —
  // both back toward the middle of the park.
  assert.ok(control(toLeft.d).x > leftMidX, 'left-field ball should bow toward center')
  assert.ok(control(toRight.d).x < rightMidX, 'right-field ball should bow toward center')
  // And both bow the same DEPTH: the park is symmetric about center, so the
  // two mirror images may not differ in how lofted they read.
  assert.equal(
    Math.round(control(toLeft.d).x - leftMidX),
    Math.round(rightMidX - control(toRight.d).x),
  )
})

test('a ball to dead center still bows', () => {
  const straight = ballFlightPath(landing(0, 400), 32, 'fly_ball')
  assert.equal(straight.grounded, false)
  // There is no "toward center" for a ball already at center, so it takes the
  // right-hand perpendicular rather than collapsing to a flat line — the one
  // direction where the drawing hides the loft is the one that most needs it.
  assert.ok(control(straight.d).x > HOME.x)
})

test('the path starts at home plate and ends on the ball', () => {
  const spot = landing(-15, 260)
  const { d } = ballFlightPath(spot, 26, 'fly_ball')
  assert.ok(d.startsWith(`M ${HOME.x} ${HOME.y} `))
  assert.ok(d.endsWith(`${spot.x} ${spot.y}`))
})

test('a ball popped up behind the plate bows toward the field, not off the paper', () => {
  const behind = { x: HOME.x - 30, y: HOME.y + 35 }
  const { d, grounded } = ballFlightPath(behind, 70, 'popup')
  assert.equal(grounded, false)
  // Up the frame means a control point ABOVE home plate, so the curve reaches
  // back over the infield rather than down past the bottom of the viewBox.
  assert.ok(control(d).y < HOME.y, 'the bow should climb toward the field')
})
