// The side view's two label rules (docs/contact-replay.md §7.1), pure: lib/pitcherCard/contactDraw.js.
import assert from 'node:assert/strict'
import test from 'node:test'
import { sideViewPath } from '../src/lib/pitcherCard/batted.js'
import { apexLabel, distanceLabel } from '../src/lib/pitcherCard/contactDraw.js'

test('apexLabel: an apex in the top 46 units puts the label under the arc, right of the drop', () => {
  const pop = sideViewPath({ exitVelo: 95, launchAngle: 60, distance: 200 }).apex
  assert.ok(pop.y < 46)
  const under = apexLabel(pop.x, pop.y, pop.ft)
  assert.equal(under.anchor, 'start')
  assert.equal(under.x, pop.x + 5)
  assert.equal(under.y, pop.y + 16)
  const low = apexLabel(100, 60, 29)
  assert.deepEqual([low.anchor, low.x, low.y, low.text], ['middle', 100, 55, 'apex ≈ 29 ft · drawn'])
})

test('distanceLabel: past 370 ft the label takes the axis row and the 400 ft tick label hides', () => {
  const homer = distanceLabel(428) // at-bat 16, gamePk 849810
  assert.deepEqual([homer.anchor, homer.x, homer.y, homer.hideTick400, homer.text], ['end', 332, 96, true, '428 ft'])
  const mid = distanceLabel(312)
  assert.deepEqual([mid.anchor, mid.y, mid.hideTick400, mid.text], ['middle', 66, false, '312 ft'])
  assert.equal(distanceLabel(370).hideTick400, false)
})
