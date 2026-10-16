import test from 'node:test'
import assert from 'node:assert/strict'
import { postseasonDoor } from '../src/screens/team/data/shared.js'

test('postseasonDoor links the club view and keeps ?d=', () => {
  assert.equal(postseasonDoor(158, null, 1), '/postseason-records?view=teams&team=158')
  assert.equal(postseasonDoor(158, '2026-10-01', 1), '/postseason-records?d=2026-10-01&view=teams&team=158')
})
test('postseasonDoor is absent below MLB', () => {
  assert.equal(postseasonDoor(500, null, 11), null)
})
