import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HOME_RUN, advanceTime, clampTime, momentAt, stepTime } from '../src/screens/gameday/next/cutscene/ballpark/choreography.js'
import { drawBallpark, WIDTH, HEIGHT } from '../src/screens/gameday/next/cutscene/ballpark/drawBallpark.js'
import { materialFor } from '../src/screens/gameday/next/cutscene/ballpark/materials.js'
import { BALLPARK_SCENES } from '../src/screens/gameday/next/cutscene/ballpark/scenes.js'
import { ballAt } from '../src/screens/gameday/next/cutscene/ballpark/flight.js'
import { isolateFrames } from '../src/screens/gameday/next/cutscene/ballpark/atlas.js'

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

test('brown fielding leather stays leather when club trim changes', () => {
  for (const rgb of [[109, 55, 20], [191, 118, 48], [153, 92, 38]]) assert.equal(materialFor(...rgb), null, `leather ${rgb}`)
  assert.equal(materialFor(211, 166, 52), 'trim')
  assert.equal(materialFor(22, 38, 75), 'equipment')
  assert.equal(materialFor(224, 211, 190), null)
  assert.equal(materialFor(105, 188, 234), null, 'bright cool rim light is not equipment')
})

test('each role has its own finite valid track, artwork and review points', () => {
  const scenes = Object.values(BALLPARK_SCENES)
  assert.equal(new Set(scenes.map((s) => s.character.url)).size, 3)
  for (const { track, character, review } of scenes) {
    assert.equal(track.frames[0].at, 0)
    for (const [i, f] of track.frames.entries()) {
      assert.ok(f.frame >= 0 && f.frame < character.rows * character.columns)
      assert.ok(f.at < track.duration)
      if (i) assert.ok(f.at > track.frames[i - 1].at)
      assert.equal(momentAt(f.at, track).frame, f.frame)
    }
    assert.ok(review.every((t) => t >= 0 && t <= track.duration))
    assert.equal(momentAt(99, track).frame, track.frames.at(-1).frame)
    assert.equal(momentAt(99, track).ended, true)
  }
  assert.ok(BALLPARK_SCENES.strikeout.track.duration < HOME_RUN.duration)
})

test('the illustrative ball reaches the glove at the catch beat and stays caught', () => {
  const { track } = BALLPARK_SCENES.catch, f = track.flight
  assert.equal(ballAt(-0.1, f), null)
  assert.deepEqual(ballAt(0, f), { x: f.from[0], y: f.from[1] })
  const near = ballAt(f.catchAt - 0.00001, f)
  assert.ok(Math.abs(near.x - f.to[0]) < 0.001)
  assert.ok(Math.abs(near.y - f.to[1]) < 0.001)
  assert.equal(momentAt(f.catchAt, track).beat, 'Catch')
  assert.equal(ballAt(f.catchAt, f), null)
  assert.equal(ballAt(100, f), null)
  assert.equal(ballAt(0.1, HOME_RUN.flight), null)
})

test('atlas preparation removes neighboring-cell fragments without cropping the pose', () => {
  const width = 8, height = 8, data = new Uint8ClampedArray(width * height * 4)
  const dot = (x, y) => { data[(y * width + x) * 4 + 3] = 255 }
  for (let y = 2; y <= 6; y++) for (let x = 2; x <= 5; x++) dot(x, y)
  dot(0, 0); dot(1, 0) // previous row's shoe, disconnected at the cell edge
  const result = isolateFrames({ width, height, data }, 1, 1)
  assert.equal(result.data[3], 0, 'the neighboring shoe is not part of this pose')
  assert.equal(result.data[(2 * width + 2) * 4 + 3], 255)
  assert.equal(result.data[(6 * width + 5) * 4 + 3], 255, 'keep the whole body, not a fixed inset crop')
})

test('atlas isolation respects cell boundaries and rejects fractional grids', () => {
  const width = 8, height = 4, data = new Uint8ClampedArray(width * height * 4)
  for (const [x, y] of [[1, 1], [1, 2], [2, 1], [2, 2], [5, 1], [5, 2]]) data[(y * width + x) * 4 + 3] = 255
  isolateFrames({ width, height, data }, 2, 1)
  assert.equal(data[(1 * width + 1) * 4 + 3], 255)
  assert.equal(data[(1 * width + 5) * 4 + 3], 255, 'smaller character in second cell survives')
  assert.throws(() => isolateFrames({ width, height, data }, 3, 1), /whole cells/)
})
