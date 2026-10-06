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
import { REPLAY_H, SCENE_W, sceneFrame, stage } from '../src/lib/pitcherCard/scene.js'

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

// THE REPLAY'S GROUND (G2). The camera is scene.js `proj`: 6 ft behind the
// plate's point, 4 ft up. These pins were measured by running that camera.
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) < tol, `${what}: ${a} vs ${b}`)

// The y of the dirt's far edge where it crosses screen x `sx`: the top of the
// polygon, interpolated between its two points either side of `sx`.
function edgeY(dirt, sx) {
  let best = Infinity
  for (let i = 0; i < dirt.length; i++) {
    const [a, b] = [dirt[i], dirt[(i + 1) % dirt.length]]
    if ((a[0] - sx) * (b[0] - sx) > 0 || a[0] === b[0]) continue
    best = Math.min(best, a[1] + ((b[1] - a[1]) * (sx - a[0])) / (b[0] - a[0]))
  }
  return best
}

test('the dirt is the projected 13-ft plate circle, not a flat ellipse', () => {
  const { dirt } = stage()
  near(edgeY(dirt, SCENE_W / 2), 109.2, 0.5, 'far edge at the frame centre')
  near(edgeY(dirt, 0), 119.5, 0.5, 'far edge at the frame’s left edge')
  near(edgeY(dirt, SCENE_W), 119.5, 0.5, 'far edge at the frame’s right edge')
  // Every point is finite: the circle's near half is behind the camera and is
  // left out rather than projected through it.
  for (const [x, y] of dirt) assert.ok(Number.isFinite(x) && Number.isFinite(y))
})

test('the plate lies on the ground under the zone, and the frame holds it', () => {
  const { plate, front } = stage()
  near(plate[0][1], 247.1, 0.5, 'front edge')
  near(plate[3][1], 299.3, 0.5, 'point')
  assert.equal(plate[3][0], SCENE_W / 2)
  assert.ok(plate[3][1] < REPLAY_H - 8, 'room under the point')
  near(REPLAY_H, 312, 1, 'replay height')
  // The front edge is as wide as the zone's front face.
  near(plate[0][0], front.x, 1e-9, 'left corner')
  near(plate[1][0], front.x + front.w, 1e-9, 'right corner')
})

test('both batter’s boxes sit beside the plate, mirrored', () => {
  const { boxes, plate } = stage()
  assert.equal(boxes.length, 2)
  const [l, r] = boxes
  for (let i = 0; i < 4; i++) near(l[i][0] + r[i][0], SCENE_W, 1e-9, 'mirror')
  // The inner line clears the plate on each side.
  assert.ok(Math.max(l[0][0], l[3][0]) < plate[0][0] && Math.min(r[0][0], r[3][0]) > plate[1][0])
})

test('two drop lines stand the zone on the plate', () => {
  const { drops, front, plate } = stage([1.7, 3.4])
  assert.equal(drops.length, 2)
  drops.forEach(([top, foot], i) => {
    assert.equal(top[0], foot[0], 'plumb')
    near(top[1], front.y + front.h, 1e-9, 'from the zone’s bottom')
    near(foot[0], plate[i][0], 1e-9, 'to the plate’s front corner x')
    near(foot[1], plate[i][1], 1e-9, 'to the plate’s front corner y')
  })
})

test('every pitch of a real at-bat ends inside the replay frame', () => {
  for (const p of atBatScenePitches(card([event(1), event(2)]).pitchDetails)) {
    for (const [x, y, d] of p.pts) assert.ok(x - d / 2 > 0 && x + d / 2 < SCENE_W && y + d / 2 < REPLAY_H, `${x},${y}`)
  }
})

// PLAY ONCE. The replay plays the at-bat through once and rests; a picked
// pitch plays alone and holds. The card's loop (no `once`) is unchanged.
const three = [{ T: 0.4 }, { T: 0.5 }, { T: 0.45 }]
const slot = 0.5 * 3 + 0.9 // the slowest flight ×3, then the hold

test('once: the at-bat plays in order, then holds the last pitch at full length', () => {
  assert.deepEqual(sceneFrame(three, 0.1, 3, true), sceneFrame(three, 0.1, 3))
  assert.equal(sceneFrame(three, slot + 0.1, 3, true).idx, 1)
  assert.equal(sceneFrame(three, 2 * slot + 0.1, 3, true).idx, 2)
  for (const t of [3 * slot, 3 * slot + 5, 100]) {
    assert.deepEqual(sceneFrame(three, t, 3, true), { idx: 2, progress: 1, done: true }, `t ${t}`)
  }
})

test('the card still loops', () => {
  assert.equal(sceneFrame(three, 3 * slot + 0.1).idx, 0)
  assert.equal(sceneFrame(three, 3 * slot + 0.1).done, undefined)
})

test('one picked pitch plays alone, then holds on its full path', () => {
  const one = [three[1]]
  close(sceneFrame(one, 0.75, 3, true).progress, 0.5)
  assert.equal(sceneFrame(one, 0.75, 3, true).done, undefined)
  assert.deepEqual(sceneFrame(one, 1.5 + 0.9, 3, true), { idx: 0, progress: 1, done: true })
})

function close(a, b) {
  assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)
}
