// The strike-zone modal is drawn from the catcher's side (Gary, 2026-10-28, #2687): the feed's pX draws as
// it comes, so a pitch toward first base (+pX) lands RIGHT of the plate's centre and a right-handed
// batter's box (third-base side) sits LEFT. Every zone chart now shares that view (ADR-0124).
import test from 'node:test'
import assert from 'node:assert/strict'
import { EDGE, catcherX } from '../src/lib/zone/zoneGeometry.js'

test('the catcher view draws first base to the right', () => {
  const centre = catcherX(0)
  assert.ok(catcherX(EDGE) > centre, 'the first-base edge is the right edge')
  assert.ok(catcherX(-EDGE) < centre, 'the third-base edge is the left edge')
})

test("a righty stands left of the plate in his own stance's art, a lefty right of it", async () => {
  const { boxLeftOfPlate, stanceArt } = await import('../src/lib/zone/zoneGeometry.js')
  // Gary, 2026-10-28: the pitcher's-view code drew the OTHER stance's art, which read as the wrong hand.
  assert.equal(boxLeftOfPlate('R'), true)
  assert.equal(boxLeftOfPlate('L'), false)
  assert.equal(stanceArt('R'), 'right')
  assert.equal(stanceArt('L'), 'left')
})
