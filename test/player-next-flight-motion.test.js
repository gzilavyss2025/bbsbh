import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FLY_S, HOLD_S, PRE_S, flyStep, landedLoop, startLoop, stepLoop, stillCam, swingCam, viewAt, wrapAngle,
} from '../src/screens/player/next/modules/arsenal/flightMotion.js'
import { makeCamera, orbitOf, project } from '../src/screens/player/next/modules/arsenal/flightView.js'

// The Pitch flight's motion (#2073, board PitchFlight.dc.html): the loop of phases and the camera swing.
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`)

test('the board values: 0.6 s at release, 1.1 s hold, 0.95 s swing', () => {
  assert.equal(PRE_S, 0.6)
  assert.equal(HOLD_S, 1.1)
  assert.equal(FLY_S, 0.95)
})

test('stepLoop waits at release, then flies', () => {
  const a = stepLoop(startLoop(true), 0.55, 0.4, 1)
  assert.equal(a.phase, 'pre')
  assert.equal(a.s, 0)
  const b = stepLoop(a, 0.1, 0.4, 1)
  assert.equal(b.phase, 'fly')
  assert.equal(b.s, 0)
})

test('stepLoop flies at the chosen speed and holds at the end', () => {
  const fly = { ...startLoop(true), phase: 'fly', s: 0.3 }
  const a = stepLoop(fly, 0.05, 0.4, 1 / 3)
  close(a.s, 0.3 + 0.05 / 3)
  close(a.prevS, 0.3)
  const b = stepLoop({ ...fly, s: 0.39 }, 0.05, 0.4, 1)
  assert.equal(b.phase, 'hold')
  assert.equal(b.s, 0.4)
  close(b.prevS, 0.39)
})

test('stepLoop holds 1.1 s, then starts again and says so once', () => {
  const hold = { ...startLoop(true), phase: 'hold', s: 0.4, prevS: 0.4 }
  const a = stepLoop(hold, 1.0, 0.4, 1)
  assert.equal(a.phase, 'hold')
  assert.equal(a.cycled, false)
  assert.equal(a.s, 0.4)
  const b = stepLoop(a, 0.2, 0.4, 1)
  assert.equal(b.phase, 'pre')
  assert.equal(b.s, 0)
  assert.equal(b.cycled, true)
  assert.equal(stepLoop(b, 0.01, 0.4, 1).cycled, false)
})

test('a paused loop does not move; the landed loop is paused at the end', () => {
  const paused = { ...startLoop(false), phase: 'fly', s: 0.2 }
  assert.equal(stepLoop(paused, 0.05, 0.4, 1), paused)
  const L = landedLoop()
  assert.equal(L.playing, false)
  assert.equal(L.phase, 'hold')
  assert.equal(Math.min(L.s, 0.42), 0.42)
})

test('wrapAngle keeps an angle in (-PI, PI]', () => {
  close(wrapAngle(3 * Math.PI / 2), -Math.PI / 2)
  close(wrapAngle(-3 * Math.PI / 2), Math.PI / 2)
  close(wrapAngle(0.5), 0.5)
})

test('viewAt: the two ends, and the yaw takes the short way round', () => {
  const a = { T: [0, 2, 30], yaw: 3, pitch: 0.2, dist: 40, fov: 27 }
  const b = { T: [0, 2.4, 1], yaw: -3, pitch: 0.1, dist: 65, fov: 13 }
  assert.deepEqual(viewAt(a, b, 0), a)
  const end = viewAt(a, b, 1)
  close(wrapAngle(end.yaw - b.yaw), 0)
  close(end.dist, 65)
  // Half way from 3 to -3 the short way is past PI, not through 0.
  assert.ok(viewAt(a, b, 0.5).yaw > 3)
})

test('flyStep: front-loaded on ease-out-quart, and exactly the target after 0.95 s', () => {
  const from = orbitOf('catcher')
  const to = orbitOf('park')
  const c = swingCam(stillCam(from), to)
  const half = flyStep(c, FLY_S / 2)
  // easeOutQuart(0.5) = 0.9375 of the way.
  close(half.view.dist, from.dist + (to.dist - from.dist) * 0.9375)
  const done = flyStep(half, FLY_S)
  assert.equal(done.tw, 1)
  assert.equal(done.view, to)
  assert.equal(flyStep(done, 0.1), done)
})

test('orbitOf: a pose as an orbit gives the same camera as the pose', () => {
  for (const name of ['catcher', 'mound', 'side', 'park']) {
    const a = makeCamera(name, 336, 300)
    const b = makeCamera(orbitOf(name), 336, 300)
    const pa = project(a, [0, 2.4, 1.417])
    const pb = project(b, [0, 2.4, 1.417])
    close(pa.x, pb.x, 1e-6)
    close(pa.y, pb.y, 1e-6)
  }
})
