// The pitch-flight physics, lifted out of pitcherCard/camera.js (#2602) so the
// Gameday stage can import it without the old cameras. Pinned on one real
// tracked pitch; test/scout-scene.test.js holds the camera.js re-export.
import assert from 'node:assert/strict'
import test from 'node:test'
import { PLATE_FRONT, realFlight } from '../src/lib/pitch/pitchFlight.js'
import * as camera from '../src/lib/pitcherCard/camera.js'

// gamePk 849817, atBatIndex 20, the last pitch of the at-bat: a sinker that
// became a double (2026-10-18). Feed names (vX0, pX, ...) as headToHead.js
// `pitchOf` lowercases them, release y from the 60.5 ft mound rule.
const FEED = {
  vX0: -5.669204587237753, vY0: -134.29157507320176, vZ0: -2.654419101367463,
  aX: 17.724332275449065, aY: 33.303999366376765, aZ: -25.890897894124993,
  pX: 0.8578442345186538, pZ: 2.710969878423366,
  extension: 6.473762860778882, plateTime: 0.41032712243248515,
}
const PITCH = {
  vx0: FEED.vX0, vy0: FEED.vY0, vz0: FEED.vZ0,
  ax: FEED.aX, ay: FEED.aY, az: FEED.aZ,
  px: FEED.pX, pz: FEED.pZ,
  release: [0, 60.5 - FEED.extension, 0],
}

test('the flight ends exactly at the measured plate crossing', () => {
  const [x, y, z] = realFlight(PITCH).at(1)
  assert.ok(Math.abs(x - FEED.pX) < 0.001, `x ${x}`)
  assert.ok(Math.abs(z - FEED.pZ) < 0.001, `z ${z}`)
  assert.ok(Math.abs(y - PLATE_FRONT) < 0.001, `y ${y}`)
})

test('the flight time matches the feed’s plateTime', () => {
  const { T } = realFlight(PITCH)
  assert.ok(Math.abs(T - FEED.plateTime) < 0.002, `T ${T} vs ${FEED.plateTime}`)
})

test('the flight starts at the release point', () => {
  const [, y] = realFlight(PITCH).at(0)
  assert.ok(Math.abs(y - (60.5 - FEED.extension)) < 1e-9, `y ${y}`)
})

test('a missing field returns null', () => {
  assert.equal(realFlight({ ...PITCH, vy0: null }), null)
  assert.equal(realFlight({ ...PITCH, release: undefined }), null)
  assert.equal(realFlight(null), null)
})

test('camera.js re-exports the same two, so its importers keep working', () => {
  assert.equal(camera.realFlight, realFlight)
  assert.equal(camera.PLATE_FRONT, PLATE_FRONT)
})
