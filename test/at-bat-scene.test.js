// The at-bat replay's model (lib/pitcherCard/atBat.js) and the pitch fields that
// feed it (api/playbyplay/pitchInfo.js). The flight itself is pinned in
// test/scout-scene.test.js; this file pins what is new: the feed's own field
// names, one scene entry per tracked pitch, and the degrade where tracking is
// missing.
import assert from 'node:assert/strict'
import test from 'node:test'
import { pitchCardInfo } from '../src/api/playbyplay/pitchInfo.js'
import { atBatScenePitches, atBatZone } from '../src/lib/pitcherCard/atBat.js'
import { PLATE_FRONT, realFlight } from '../src/lib/pitcherCard/camera.js'
import { SCENE_W, sceneFrame } from '../src/lib/pitcherCard/scene.js'

// Two pitches shaped like gamePk 823035's feed (a 94 mph four-seamer, then a
// slider), trimmed to the fields the model reads. The coordinates are a real
// pitch's: vY0 negative, aY positive, y0 = 50.
const coordinates = {
  aY: 26.476211952049187,
  aZ: -17.875655001019663,
  aX: 1.4033894060270726,
  pX: 0.507355815176722,
  pZ: 2.1053459741273115,
  vX0: 5.666658549198144,
  vY0: -137.86463730758706,
  vZ0: -7.412987927682499,
  x0: -1.655764495943,
  y0: 50.00068728156319,
  z0: 6.0047495983373125,
}

const event = (pitchNumber, over = {}) => ({
  isPitch: true,
  pitchNumber,
  details: { call: { code: 'C', description: 'Called Strike' }, type: { code: 'FF', description: 'Four-Seam Fastball' } },
  pitchData: { startSpeed: 94.2, strikeZoneTop: 3.4, strikeZoneBottom: 1.6, extension: 6.2, coordinates },
  ...over,
})

const card = (events) => pitchCardInfo({}, { playEvents: events })

test('pitchCardInfo carries the feed trajectory under the names realFlight reads', () => {
  const [p] = card([event(1)]).pitchDetails
  assert.equal(p.vx0, coordinates.vX0)
  assert.equal(p.vy0, coordinates.vY0)
  assert.equal(p.vz0, coordinates.vZ0)
  assert.equal(p.ax, coordinates.aX)
  assert.equal(p.ay, coordinates.aY)
  assert.equal(p.az, coordinates.aZ)
  assert.equal(p.typeCode, 'FF')
  assert.ok(Math.abs(p.releaseY - 54.3) < 1e-9, 'release is 60.5 ft minus extension')
})

test('a pitch with no tracking keeps null trajectory fields and no release', () => {
  const [p] = card([event(1, { pitchData: { startSpeed: 90 } })]).pitchDetails
  for (const k of ['vx0', 'vy0', 'vz0', 'ax', 'ay', 'az', 'releaseY']) assert.equal(p[k], null, k)
})

test('the feed trajectory ends where the tracking put the pitch', () => {
  const [p] = card([event(1)]).pitchDetails
  const f = realFlight({ ...p, release: [0, p.releaseY, 0] })
  const [x, y, z] = f.at(1)
  assert.ok(Math.abs(x - coordinates.pX) < 0.01, 'plate x')
  assert.ok(Math.abs(y - PLATE_FRONT) < 0.01, 'plate y')
  assert.ok(Math.abs(z - coordinates.pZ) < 0.01, 'plate z')
})

test('one scene entry per tracked pitch, in order, each with its own key', () => {
  const { pitchDetails } = card([event(1), event(2), event(3)])
  const scene = atBatScenePitches(pitchDetails)
  assert.equal(scene.length, 3)
  assert.deepEqual(scene.map((p) => p.no), [1, 2, 3])
  // Two fastballs in one at-bat must not share a React key.
  assert.equal(new Set(scene.map((p) => p.code)).size, 3)
  assert.equal(scene[0].name, '1 · Four-Seam Fastball')
  assert.equal(scene[0].mph, '94.2')
  assert.equal(scene[0].family, 'fastball')
  assert.equal(scene[0].call, 'Called Strike')
  assert.equal(scene[0].pts.length, 41)
})

test('an untracked pitch is left out and an untracked at-bat draws nothing', () => {
  const dead = event(2, { pitchData: { startSpeed: 90 } })
  assert.deepEqual(atBatScenePitches(card([event(1), dead]).pitchDetails).map((p) => p.no), [1])
  assert.deepEqual(atBatScenePitches(card([dead]).pitchDetails), [])
  assert.deepEqual(atBatScenePitches(null), [])
})

test('a missing extension still draws, from the card’s own release', () => {
  const noExt = event(1, { pitchData: { startSpeed: 94.2, coordinates } })
  assert.equal(atBatScenePitches(card([noExt]).pitchDetails).length, 1)
})

test('every point of every flight lands inside the scene', () => {
  for (const p of atBatScenePitches(card([event(1), event(2)]).pitchDetails)) {
    for (const [x] of p.pts) assert.ok(x > 0 && x < SCENE_W, `x ${x}`)
  }
})

test('the scene plays each pitch of the at-bat in turn', () => {
  const scene = atBatScenePitches(card([event(1), event(2), event(3)]).pitchDetails)
  const seen = new Set()
  for (let t = 0; t < 30; t += 0.25) seen.add(sceneFrame(scene, t).idx)
  assert.deepEqual([...seen].sort(), [0, 1, 2])
})

test('the zone is the median of the at-bat’s own, or undefined without one', () => {
  const zoned = [{ szTop: 3.4, szBottom: 1.6 }, { szTop: 3.6, szBottom: 1.8 }, { szTop: 3.5, szBottom: 1.7 }]
  assert.deepEqual(atBatZone(zoned), [1.7, 3.5])
  assert.equal(atBatZone([{ szTop: null, szBottom: null }]), undefined)
  assert.equal(atBatZone(undefined), undefined)
})
