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

// A pitch with no contact point has beats of { totalMs } only: no side path to draw (it was NaN geometry).
import { readFileSync } from 'node:fs'
import { pitchCardInfo } from '../src/api/playbyplay/pitchInfo.js'
import { atBatScenePitches, markHomeRun } from '../src/lib/pitcherCard/atBat.js'
import { pitchBeats } from '../src/lib/pitcherCard/contactTimeline.js'
import { sidePathFor } from '../src/lib/pitcherCard/contactDraw.js'
import { SLOW } from '../src/lib/pitcherCard/scene.js'

const game = JSON.parse(readFileSync(new URL('./fixtures/contact-replay/game-849810.trimmed.json', import.meta.url), 'utf8'))
const homer = game.liveData.plays.allPlays.find((p) => p.about.atBatIndex === 15) // at-bat 16, the 428 ft home run
const { pitchDetails } = pitchCardInfo(game, homer)
const scene = atBatScenePitches(pitchDetails, 'hitter', 'L')

test('sidePathFor: a ball in play with a contact point has a path; without one it has none', () => {
  const inPlay = scene.find((p) => p.swing === 'inplay')
  assert.ok(sidePathFor(inPlay, pitchBeats(inPlay, SLOW)))
  const noContact = { ...inPlay, contact: null }
  assert.equal(sidePathFor(noContact, pitchBeats(noContact, SLOW)), null)
  const whiff = scene.find((p) => p.swing === 'whiff')
  assert.equal(sidePathFor(whiff, pitchBeats(whiff, SLOW)), null)
})

test('markHomeRun: the ring flag goes on the last pitch only when it is the at-bat\'s last pitch', () => {
  const marked = markHomeRun(scene, pitchDetails)
  assert.equal(marked.at(-1).hr, true)
  assert.ok(marked.slice(0, -1).every((p) => !p.hr))
  const lastDropped = markHomeRun(scene.slice(0, -1), pitchDetails) // the final pitch had no tracking
  assert.ok(lastDropped.every((p) => !p.hr))
})
