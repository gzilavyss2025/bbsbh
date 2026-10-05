// The pitch scene in both of the Scout's views, and the real flight of one
// tracked pitch (#1490, ADR-0099). The Now Pitching card's own picture is
// pinned in test/pitcher-card-model.test.js; this file pins the second camera
// and holds the hitter camera to the card's `proj`.
import assert from 'node:assert/strict'
import test from 'node:test'
import { PLATE_FRONT, camera, realFlight } from '../src/lib/pitcherCard/camera.js'
import { BAR_TOP, SCENE_H, SCENE_W, arc, pitcherStage, proj, realScenePitch, sceneFrame } from '../src/lib/pitcherCard/scene.js'
import { regionRect } from '../src/lib/zone/regions.js'

const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b}`)

// Pivetta to Chourio, 2025-09-22, 1st inning, pitch 1 (a 92.9 mph fastball),
// the Savant row as headToHead.js `pitchOf` shapes it.
const PITCH = {
  px: 0.4446023044347701, pz: 3.1765661739623927,
  vx0: 4.681659060107464, vy0: -135.09268181637415, vz0: -7.5221877356370515,
  ax: -4.857150851917067, ay: 28.591294504008502, az: -9.946841300028124,
  release: [-1.1, 53.88, 6.9],
}

test('the hitter camera is the card’s own projection, point for point', () => {
  const cam = camera('hitter')
  for (const p of [[0, 0, 2.5], [1.2, 30, 5], [-1.9, 54.2, 5.8], [0.7, PLATE_FRONT, 1.6]]) {
    const a = cam(...p)
    const b = proj(...p)
    for (let i = 0; i < 3; i += 1) close(a[i], b[i], 1e-9, `coord ${i}`)
  }
})

test('first base is on the viewer’s left in the Pitcher’s view and on the right in the Hitter’s, as the maps draw it', () => {
  for (const view of ['pitcher', 'hitter']) {
    const cam = camera(view)
    const [x1b] = cam(1, PLATE_FRONT, 2.5)
    const [x3b] = cam(-1, PLATE_FRONT, 2.5)
    const side1bOnLeft = regionRect('side1b', view).x < regionRect('side3b', view).x
    assert.equal(x1b < x3b, side1bOnLeft, view)
    assert.equal(side1bOnLeft, view === 'pitcher', view)
  }
  // A generic arc to the glove side of a right-hander (a sweeper, first-base
  // side) lands on the same screen side as the first-base region, per view.
  const end = (view) => arc('ST', 82, false, view).at(-1)[0]
  assert.ok(end('pitcher') < SCENE_W / 2)
  assert.ok(end('hitter') > SCENE_W / 2)
})

test('the real flight ends at plate_x / plate_z on the front of the plate and starts at release', () => {
  const f = realFlight(PITCH)
  const [x, y, z] = f.at(1)
  close(x, PITCH.px, 0.01, 'plate_x')
  close(y, PLATE_FRONT, 0.01, 'plate y')
  close(z, PITCH.pz, 0.01, 'plate_z')
  const [rx, ry, rz] = f.at(0)
  close(ry, PITCH.release[1], 0.01, 'release y')
  // Savant's measured release and the solved one agree to a few inches.
  close(rx, PITCH.release[0], 0.3, 'release x')
  close(rz, PITCH.release[2], 0.3, 'release z')
  close(f.T, 0.4, 0.05, 'flight time')
})

test('a row missing a field has no flight, never a NaN path', () => {
  assert.equal(realFlight({ ...PITCH, vy0: null }), null)
  assert.equal(realFlight({ ...PITCH, release: [null, null, null] }), null)
  assert.equal(realScenePitch(null, {}), null)
})

test('the real pitch draws in both views, inside the frame and above the bar', () => {
  for (const view of ['hitter', 'pitcher']) {
    const p = realScenePitch(realFlight(PITCH), { code: 'FF', name: 'Fastball', mph: '92.9', family: 'fastball' }, view)
    assert.equal(p.pts.length, 41)
    for (const [x, y, d] of p.pts) {
      assert.ok(x > 0 && x < SCENE_W, `${view} x ${x}`)
      assert.ok(y > 0 && y < BAR_TOP, `${view} y ${y}`)
      assert.ok(d > 0, `${view} size`)
    }
  }
})

test('the Pitcher’s view stage: a projected zone in frame, a placed mound at the foot', () => {
  const s = pitcherStage()
  for (const [x, y] of [...s.front, ...s.plate]) {
    assert.ok(x > 0 && x < SCENE_W && y > 0 && y < BAR_TOP)
  }
  // The zone is tall enough to read (at least 30 px).
  assert.ok(s.front[3][1] - s.front[0][1] > 30)
  assert.equal(s.mound.cy, SCENE_H - 2)
  assert.equal(s.grid.length, 4)
})

test('slow motion: the modal’s real speed and quarter speed stretch the same flight', () => {
  const pitches = [{ T: 0.4 }]
  assert.equal(sceneFrame(pitches, 0.2, 1).progress, 0.5)
  assert.equal(sceneFrame(pitches, 0.2, 4).progress, 0.125)
  // The card's default stays at a third of real speed.
  close(sceneFrame(pitches, 0.2).progress, 0.2 / 1.2, 1e-9)
})
