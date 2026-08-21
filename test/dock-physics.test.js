import test from 'node:test'
import assert from 'node:assert/strict'

import {
  DECELERATION_RATE,
  HALF_FRACTION,
  MAX_SETTLE_MS,
  MIN_SETTLE_MS,
  SHEET_FRACTION,
  detentOffsets,
  nearestDetent,
  openness,
  projectMomentum,
  releaseDetent,
  rubberband,
  scrimAlpha,
  settleMs,
  velocityFrom,
} from '../src/components/transactions/dockPhysics.js'

// The wire dock's feel, asserted. Everything WireDock.jsx does with a pointer
// reduces to these functions, which is why they were pulled out of it: a sheet
// that lands on the wrong detent, resists an edge too hard, or throws when the
// finger had stopped is a bug you can otherwise only find by flicking a phone.
//
// The coordinate throughout: offset is translateY in px measured DOWN from
// fully open. 0 is the tallest detent; the rail is the largest number.

const VIEWPORT = 844 // an iPhone 14/15's CSS pixel height
const RAIL = 62

test('detentOffsets orders open to closed and pins the ends', () => {
  const [full, half, rail] = detentOffsets(VIEWPORT, RAIL)
  const sheet = Math.round(VIEWPORT * SHEET_FRACTION)
  assert.equal(full, 0, 'the tallest detent is the origin of the coordinate')
  assert.equal(rail, sheet - RAIL, 'at rest exactly the rail is left on screen')
  assert.equal(half, sheet - Math.round(VIEWPORT * HALF_FRACTION))
  assert.ok(full < half && half < rail, 'strictly ordered open -> closed')
})

test('detentOffsets degrades to two usable positions on a short viewport', () => {
  // A landscape phone, or a browser with the keyboard up: the half detent has
  // nowhere to go, and must collapse INTO a neighbour rather than end up below
  // the rail, which would make the sheet close when the reader opened it.
  const [full, half, rail] = detentOffsets(120, 100)
  assert.ok(full <= half && half <= rail, `expected ordering, got ${full}/${half}/${rail}`)
})

test('detentOffsets survives a viewport it cannot measure', () => {
  const detents = detentOffsets(0, 0)
  assert.deepEqual(detents, [0, 0, 0])
  assert.equal(nearestDetent(0, detents), 0, 'and still resolves a detent')
})

test('projectMomentum uses the exponential-decay curve, not v^2/2a', () => {
  // Apple's constant, from Designing Fluid Interfaces (WWDC 2018). At the
  // documented rate a 1000 px/s release projects ~499px forward — the textbook
  // form under-throws this by an order of magnitude at thumb velocities, which
  // is the whole reason the exact function is pinned here.
  assert.equal(Math.round(projectMomentum(1000, DECELERATION_RATE)), 499)
  assert.equal(projectMomentum(0), 0)
  assert.equal(projectMomentum(Number.NaN), 0)
  assert.ok(projectMomentum(-800) < 0, 'an upward flick projects upward')
})

test('projectMomentum is monotonic in velocity', () => {
  let previous = -Infinity
  for (const v of [0, 100, 250, 500, 900, 1800]) {
    const projected = projectMomentum(v)
    assert.ok(projected > previous, `${v} px/s should throw further than the last`)
    previous = projected
  }
})

test('rubberband resists progressively and never exceeds the pull', () => {
  const dimension = 700
  let previous = 0
  for (const overshoot of [10, 40, 120, 400, 1200]) {
    const moved = rubberband(overshoot, dimension)
    assert.ok(moved > previous, 'further pull still moves the sheet a little further')
    assert.ok(moved < overshoot, 'but always less than 1:1 — that is the resistance')
    previous = moved
  }
  // Asymptotic: even an absurd pull cannot travel a full dimension.
  assert.ok(rubberband(100000, dimension) < dimension)
})

test('rubberband is symmetric and safe at the degenerate edges', () => {
  assert.equal(rubberband(50, 700), -rubberband(-50, 700))
  assert.equal(rubberband(0, 700), 0)
  assert.equal(rubberband(50, 0), 0)
})

test('nearestDetent resolves a tie toward the more open detent', () => {
  // The forgiving direction: an ambiguous drag that opens costs one tap to
  // undo, while one that closes has thrown away what the reader reached for.
  assert.equal(nearestDetent(50, [0, 100, 200]), 0)
  assert.equal(nearestDetent(150, [0, 100, 200]), 1)
  assert.equal(nearestDetent(199, [0, 100, 200]), 2)
})

test('releaseDetent lands on where the flick is GOING, not where it ended', () => {
  const detents = detentOffsets(VIEWPORT, RAIL)
  const [, half, rail] = detents
  // Barely off the rail, but flicked up hard. Snapping from the release point
  // would put it straight back on the rail; projecting the momentum opens it.
  const nudged = rail - 20
  assert.equal(nearestDetent(nudged, detents), 2, 'the release point IS nearest the rail')
  assert.equal(releaseDetent(nudged, -900, detents, { from: 2 }), 1, 'the flick still opens it')
  assert.ok(half < rail)
})

test('releaseDetent will not skip a detent however hard the flick', () => {
  const detents = detentOffsets(VIEWPORT, RAIL)
  // The tallest detent covers the slate, and covering the page the reader came
  // for is not something a gesture may do by accident. A second drag gets there.
  assert.equal(releaseDetent(detents[2], -9000, detents, { from: 2 }), 1)
  assert.equal(releaseDetent(detents[1], -9000, detents, { from: 1 }), 0)
  // And the same in the closing direction.
  assert.equal(releaseDetent(detents[0], 9000, detents, { from: 0 }), 1)
})

test('releaseDetent honours a released-at-rest drag', () => {
  const detents = detentOffsets(VIEWPORT, RAIL)
  // Dragged most of the way to half and let go without a throw: it commits,
  // because position decides when there is no velocity to project.
  const nearlyHalf = detents[1] + 30
  assert.equal(releaseDetent(nearlyHalf, 0, detents, { from: 2 }), 1)
  // Barely moved and let go: it goes back.
  assert.equal(releaseDetent(detents[2] - 12, 0, detents, { from: 2 }), 2)
})

test('releaseDetent clamps a flick past either end to that end', () => {
  const detents = detentOffsets(VIEWPORT, RAIL)
  assert.equal(releaseDetent(-400, -4000, detents, { from: 0 }), 0)
  assert.equal(releaseDetent(detents[2] + 400, 4000, detents, { from: 2 }), 2)
})

test('settleMs scales with distance and clamps at both ends', () => {
  assert.equal(settleMs(0), MIN_SETTLE_MS, 'a zero-distance settle is still not instant')
  assert.equal(settleMs(4), MIN_SETTLE_MS)
  assert.equal(settleMs(-4), MIN_SETTLE_MS, 'direction does not change the duration')
  assert.equal(settleMs(100000), MAX_SETTLE_MS, 'nothing is ever slow enough to read as lag')
  const mid = settleMs(300)
  assert.ok(mid > MIN_SETTLE_MS && mid < MAX_SETTLE_MS)
  assert.ok(settleMs(500) > settleMs(200), 'a longer throw takes longer')
})

test('velocityFrom reads the tail of the gesture, not its average', () => {
  // A drag that raced and then STOPPED before release has ended at rest. An
  // average over the whole gesture is exactly how a sheet acquires a throw its
  // reader never gave it.
  const raced = [
    { y: 0, t: 0 },
    { y: 300, t: 100 },
    { y: 400, t: 200 },
    { y: 402, t: 260 },
    { y: 402, t: 300 },
  ]
  assert.ok(Math.abs(velocityFrom(raced)) < 60, `expected ~rest, got ${velocityFrom(raced)}`)

  const throwing = [
    { y: 0, t: 0 },
    { y: 10, t: 200 },
    { y: 60, t: 260 },
    { y: 140, t: 300 },
  ]
  assert.ok(velocityFrom(throwing) > 400, 'a real flick reads as a real flick')
})

test('velocityFrom is safe on degenerate sample histories', () => {
  assert.equal(velocityFrom(null), 0)
  assert.equal(velocityFrom([]), 0)
  assert.equal(velocityFrom([{ y: 5, t: 5 }]), 0)
  assert.equal(velocityFrom([{ y: 0, t: 7 }, { y: 40, t: 7 }]), 0, 'no time passed, no velocity')
})

test('openness runs 0 at the rail to 1 at the tallest detent', () => {
  const detents = detentOffsets(VIEWPORT, RAIL)
  assert.equal(openness(detents[2], detents), 0)
  assert.equal(openness(detents[0], detents), 1)
  assert.ok(openness(detents[1], detents) > 0 && openness(detents[1], detents) < 1)
  assert.equal(openness(detents[2] + 500, detents), 0, 'clamped below the rail')
})

test('the scrim stays clear until the sheet passes the working height', () => {
  const detents = detentOffsets(VIEWPORT, RAIL)
  // A dock at its working height sits BESIDE the slate. Dimming the games
  // there would break the flow the dock exists to preserve, so the fade starts
  // only once the sheet has effectively become the page.
  assert.equal(scrimAlpha(detents[2], detents), 0, 'rail')
  assert.equal(scrimAlpha(detents[1], detents), 0, 'half')
  assert.ok(scrimAlpha(detents[0], detents) > 0.3, 'full')
  const between = (detents[0] + detents[1]) / 2
  assert.ok(scrimAlpha(between, detents) > 0 && scrimAlpha(between, detents) < 0.34)
})
