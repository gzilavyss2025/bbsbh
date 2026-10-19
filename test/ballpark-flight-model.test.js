import test from 'node:test'
import assert from 'node:assert/strict'
import { flightModel, simFlight } from '../src/lib/ballpark/flightModel.js'

test('start height 3 is the old fixed value; a lower start lands sooner', () => {
  const same = simFlight(100, 25, 0.1, 3)
  const old = simFlight(100, 25, 0.1)
  assert.deepEqual(same, old)
  assert.equal(old.pts[0][1], 3)
  assert.ok(simFlight(100, 25, 0.1, 0).T < old.T)
  const ball = { exitVelo: 100, launchAngle: 25, distance: 380 }
  assert.deepEqual(flightModel(ball, 0, 3), flightModel(ball, 0))
})
