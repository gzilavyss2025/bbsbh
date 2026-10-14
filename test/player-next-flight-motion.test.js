import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { ruleBody, stripComments } from './helpers/css.js'
import {
  DRAG_PITCH, DRAG_YAW, FLY_S, HOLD_S, KEY_TURN, PITCH_MAX, PITCH_MIN, PRE_S,
  dragTurn, flyStep, isDragStart, isPlainKey, landedLoop, needsFrame, seekLoop, setPlayingLoop, startLoop, stepLoop, stillCam, swingCam, turnView, viewAt, wrapAngle,
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

test('the board turn rates and limits', () => {
  assert.equal(DRAG_YAW, 0.0085)
  assert.equal(DRAG_PITCH, 0.006)
  assert.equal(PITCH_MIN, 0.02)
  assert.equal(PITCH_MAX, 1.53)
  assert.deepEqual(KEY_TURN.ArrowLeft, [0.08, 0])
  assert.deepEqual(KEY_TURN.ArrowRight, [-0.08, 0])
  assert.deepEqual(KEY_TURN.ArrowUp, [0, -0.06])
  assert.deepEqual(KEY_TURN.ArrowDown, [0, 0.06])
})

test('dragTurn: right turns the yaw down, down turns the pitch up', () => {
  const [yaw, pitch] = dragTurn(100, 50)
  close(yaw, -0.85)
  close(pitch, 0.3)
})

test('turnView: holds the pitch inside its limits and ends a swing', () => {
  const swing = swingCam(stillCam(orbitOf('catcher')), orbitOf('park'))
  const a = turnView(swing, 0.5, 10)
  assert.equal(a.tw, 1)
  assert.equal(a.view.pitch, PITCH_MAX)
  close(a.view.yaw, orbitOf('catcher').yaw + 0.5)
  assert.equal(turnView(a, 0, -10).view.pitch, PITCH_MIN)
  // The side pose sits at pitch 0: a turn lifts it to the floor.
  assert.equal(turnView(stillCam(orbitOf('side')), 0, 0).view.pitch, PITCH_MIN)
  // Ended means a step does not move it.
  assert.equal(flyStep(a, 0.1), a)
})

test('the stage takes a drag: grab cursor, vertical scroll kept, the house focus ring', () => {
  const css = stripComments(readFileSync(new URL('../src/styles/player-next/pitcher/arsenal.css', import.meta.url), 'utf8'))
  const turn = ruleBody(css, '.flight__turn')
  assert.ok(turn, '.flight__turn exists')
  assert.match(turn, /cursor:\s*grab;/)
  assert.match(turn, /touch-action:\s*pan-y;/)
  assert.match(ruleBody(css, '.flight__turn--drag') ?? '', /cursor:\s*grabbing;/)
  assert.match(ruleBody(css, '.flight__turn:focus-visible') ?? '', /outline:\s*var\(--bw-heavy\) solid var\(--focus-ring\);/)
})

// A loop paused on the step where the hold ended still says `cycled`.
const cycledPaused = { ...startLoop(false), cycled: true }

test('setPlayingLoop and seekLoop clear cycled, so a paused loop does not fire onCycle every frame', () => {
  assert.equal(setPlayingLoop(cycledPaused, false).cycled, false)
  assert.equal(setPlayingLoop(cycledPaused, true).playing, true)
  const sought = seekLoop(cycledPaused, 0.2)
  assert.equal(sought.cycled, false)
  assert.equal(sought.s, 0.2)
  assert.equal(sought.playing, false)
  assert.equal(sought.phase, 'fly')
})

test('needsFrame: only while on screen and something moves', () => {
  const still = stillCam(orbitOf('catcher'))
  const swing = swingCam(still, orbitOf('park'))
  assert.equal(needsFrame(true, startLoop(true), still), true)
  assert.equal(needsFrame(true, startLoop(false), swing), true)
  assert.equal(needsFrame(true, startLoop(false), still), false)
  assert.equal(needsFrame(false, startLoop(true), swing), false)
})

test('isDragStart: only the primary button of the primary pointer starts a drag', () => {
  assert.equal(isDragStart({ button: 0, isPrimary: true }), true)
  assert.equal(isDragStart({ button: 2, isPrimary: true }), false, 'a right-click opens the context menu')
  assert.equal(isDragStart({ button: 0, isPrimary: false }), false, 'a second finger must not take the drag')
})

test('isPlainKey: a modified arrow is left to the browser (Alt+Left is Back)', () => {
  assert.equal(isPlainKey({ altKey: false, metaKey: false, ctrlKey: false, shiftKey: false }), true)
  for (const k of ['altKey', 'metaKey', 'ctrlKey', 'shiftKey']) {
    assert.equal(isPlainKey({ altKey: false, metaKey: false, ctrlKey: false, shiftKey: false, [k]: true }), false, k)
  }
})
