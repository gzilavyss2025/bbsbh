import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOME_RUN, advanceTime, clampTime, momentAt, stepTime } from '../src/screens/gameday/next/cutscene/ballpark/choreography.js'
import { drawBallpark, WIDTH, HEIGHT } from '../src/screens/gameday/next/cutscene/ballpark/drawBallpark.js'

test('authored action hits its boundaries, holds the final pose and never cycles', () => {
  const q = HOME_RUN
  for (const [i, frame] of q.frames.entries()) {
    assert.equal(momentAt(frame.at).frame, frame.frame)
    if (i > 0) assert.equal(momentAt(frame.at - 0.001).frame, q.frames[i - 1].frame)
  }
  assert.equal(momentAt(-1).frame, 0)
  assert.equal(momentAt(0.719).caption, false)
  assert.equal(momentAt(0.72).caption, true)
  assert.equal(momentAt(q.duration).ended, true)
  assert.equal(momentAt(999).frame, q.frames.at(-1).frame)
  assert.equal(momentAt(999).t, q.duration)
  assert.equal(clampTime(NaN), 0)
  assert.equal(clampTime(Infinity), 0)
})

test('pose stepping from a scrubbed time lands on actual adjacent poses', () => {
  assert.equal(stepTime(0.63, 1), 0.68)
  assert.equal(stepTime(0.63, -1), 0.46)
  assert.equal(stepTime(0, -1), 0)
  assert.equal(stepTime(99, 1), HOME_RUN.frames.at(-1).at)
  assert.equal(advanceTime(0.5, 0.2, 0.25), 0.55)
  assert.equal(advanceTime(2.7, 10), HOME_RUN.duration)
  assert.equal(advanceTime(1, -0.1), 1)
})

test('a different event can supply independent choreography without changing the clock', () => {
  const track = { duration: 1.5, captionAt: 0.2, frames: [{ at: 0, frame: 3, beat: 'Catch' }, { at: 0.4, frame: 5, beat: 'Show glove' }] }
  assert.equal(momentAt(0, track).frame, 3)
  assert.equal(momentAt(0.4, track).beat, 'Show glove')
  assert.equal(momentAt(10, track).t, 1.5)
  assert.equal(stepTime(0.2, 1, track), 0.4)
})

test('renderer selects isolated atlas cells; a still fixes camera motion', () => {
  const calls = [], art = { atlas: { width: 1448, height: 1086 }, stadium: {} }
  const g = { clearRect: (...a) => calls.push(a), drawImage: (...a) => calls.push(a) }
  drawBallpark(g, art, 0.86, { still: true })
  assert.equal(g.imageSmoothingEnabled, false)
  assert.deepEqual(calls[0], [0, 0, WIDTH, HEIGHT])
  assert.equal(calls[2][0], art.atlas)
  assert.equal(calls[2][1], 3 * 362)
  assert.equal(calls[2][2], 362)
  const stillCamera = calls[1]
  calls.length = 0
  drawBallpark(g, art, 2.8, { still: true })
  assert.deepEqual(calls[1], stillCamera)
})
