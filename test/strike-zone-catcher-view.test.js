// The strike-zone modal is drawn from the catcher's side (Gary, 2026-10-28, #2687): the feed's pX draws as
// it comes, so a pitch toward first base (+pX) lands RIGHT of the plate's centre and a right-handed
// batter's box (third-base side) sits LEFT. zoneGeometry's sx keeps the pitcher's view (ADR-0077) for the
// other zone charts.
import test from 'node:test'
import assert from 'node:assert/strict'
import { EDGE, catcherX, sx } from '../src/lib/zone/zoneGeometry.js'

test('the catcher view draws first base to the right', () => {
  const centre = catcherX(0)
  assert.ok(catcherX(EDGE) > centre, 'the first-base edge is the right edge')
  assert.ok(catcherX(-EDGE) < centre, 'the third-base edge is the left edge')
})

test('the catcher view is the pitcher view turned round', () => {
  for (const px of [-1.2, -EDGE, 0, 0.3, EDGE, 1.4]) assert.equal(catcherX(px), sx(-px))
})

test("a righty stands left of the plate in his own stance's art, a lefty right of it", async () => {
  const { boxLeftOfPlate, stanceArt } = await import('../src/lib/zone/zoneGeometry.js')
  // Gary, 2026-10-28: the pitcher's-view code drew the OTHER stance's art, which read as the wrong hand.
  assert.equal(boxLeftOfPlate('R'), true)
  assert.equal(boxLeftOfPlate('L'), false)
  assert.equal(stanceArt('R'), 'right')
  assert.equal(stanceArt('L'), 'left')
})
