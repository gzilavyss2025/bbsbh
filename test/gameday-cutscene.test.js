// The big-play cutscene's pure parts: the clock, the scene spec, the art's invariants, and a frame's pixels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beatsAt, lineShown } from '../src/screens/gameday/next/cutscene/cutsceneTimeline.js'
import { BAND_LINES, SCENES, SEQUENCE, sceneOf } from '../src/screens/gameday/next/cutscene/cutsceneScenes.js'
import { BAND, C, H, KIT, KIT_SLOTS, SPR, TOKENS, W, WAIST, textW } from '../src/screens/gameday/next/cutscene/cutsceneArt.js'
import { POSES, buildPose } from '../src/screens/gameday/next/cutscene/cutscenePoses.js'
import { BACKDROPS } from '../src/screens/gameday/next/cutscene/cutsceneBackdrops.js'
import { EXTRAS } from '../src/screens/gameday/next/cutscene/cutsceneExtras.js'
import { drawCutscene } from '../src/screens/gameday/next/cutscene/drawCutscene.js'

const HR = { scene: 'hr', headline: 'HOME RUN!', name: 'BATTER NAME', detail: '382 FT', mono: 'M' }
const hr = sceneOf('hr'), n = HR.headline.length, done = SEQUENCE.typeAt + SEQUENCE.perLetter * n

test('the clock: two white frames, a slide, letters at 20 a second, then the other lines by their own delay', () => {
  assert.ok(beatsAt(0.02, hr, n).white && beatsAt(0.14, hr, n).white && !beatsAt(0.1, hr, n).white)
  assert.equal(beatsAt(0.15, hr, n).slide, 70)
  assert.equal(beatsAt(0.5, hr, n).slide, 0)
  assert.equal(beatsAt(SEQUENCE.typeAt - 0.01, hr, n).typed, 0)
  assert.equal(beatsAt(SEQUENCE.typeAt + SEQUENCE.perLetter * 3 + 0.001, hr, n).typed, 4)
  assert.equal(beatsAt(done + 1, hr, n).typed, n)
  const [head, name, detail] = BAND_LINES
  const at = (t) => [head, name, detail].map((l) => lineShown(l, t, beatsAt(t, hr, n)))
  assert.deepEqual(at(0.4), [false, false, false])
  assert.deepEqual(at(done + 0.2), [true, false, false], 'the name waits a quarter second')
  assert.deepEqual(at(done + 0.4), [true, true, false])
  assert.deepEqual(at(done + 0.5), [true, true, true])
  assert.ok(beatsAt(done + 0.5, hr, n).end > done + 0.5)
})

test('scenes: the presets have their own celebrations, and a spec can start from one and override', () => {
  assert.equal(beatsAt(0.3, hr, n).pose, 'up')
  assert.equal(beatsAt(0.3, sceneOf('rbi'), n).pose, 'point')
  assert.ok(['point', 'point2'].includes(beatsAt(2, sceneOf('rbi'), n).pose))
  assert.ok(sceneOf('hr').extras.includes('batFlip') && !sceneOf('slam').extras.includes('batFlip'))
  assert.ok(sceneOf('slam').extras.includes('fireworks'))
  const own = sceneOf({ preset: 'slam', backdrop: 'dusk', facing: 'left', sequence: { perLetter: 0.1, hold: 3 } })
  assert.deepEqual(own.poses, SCENES.slam.poses)
  assert.equal(own.backdrop, 'dusk')
  assert.equal(own.sequence.perLetter, 0.1)
  assert.equal(own.sequence.typeAt, SEQUENCE.typeAt)
  assert.equal(beatsAt(10, sceneOf({ poses: ['up'] }), n).pose, 'up', 'one pose never cycles')
  assert.equal(beatsAt(0, own, n).end, own.sequence.typeAt + own.sequence.perLetter * n + 3)
})

test('the art: poses build from the grid as rectangles of KIT letters; a custom pose is a few points', () => {
  for (const [name, rows] of Object.entries(SPR)) {
    assert.equal(rows.length, 49, name)
    for (const r of rows) {
      assert.equal(r.length, 45, name)
      for (const ch of r) assert.ok(ch === '.' || KIT[ch] != null, `${name}: ${ch}`)
    }
    assert.ok(rows[WAIST].includes('B'), `${name}: the belt is on the waist row`)
  }
  assert.deepEqual(Object.keys(SPR), Object.keys(POSES))
  const salute = buildPose({ near: [[29, 21], [25, 15], [23, 9]], far: [[40, 21], [44, 27], [44, 33]], nearHand: 'fist', farHand: 'fistDown', farBehind: true })
  assert.equal(salute.length, 49)
  assert.notDeepEqual(salute, SPR.up)
  assert.equal(Object.keys(C).length, TOKENS.length + KIT_SLOTS.length)
  assert.equal(textW('HOME RUN!', 2), 2 * (6 * 8 + 4) - 2)
})

test('a frame: white at the cut, then the band in ink, the batter over the track, the headline once typed', () => {
  assert.ok(drawCutscene(0.03, HR).px.every((c) => c === C.chalk))
  const b = drawCutscene(3.1, HR)   // fists up on this beat, the flip long gone
  assert.equal(b.px.length, W * H)
  assert.ok(b.px.every((c) => c < TOKENS.length + KIT_SLOTS.length))
  assert.equal(b.px[(H - 1) * W], C.outline, 'the band is ink')
  const band = b.px.subarray(BAND * W)
  assert.ok(band.includes(C.chalk) && band.includes(C.trim), 'headline and detail are on the band')
  const q = SPR.up[1].indexOf('S'), [bx, by] = hr.at
  assert.equal(b.px[(by + 2) * W + bx + q * 2], C.skinLight, 'a fist is up at the top of the batter box')
  const rbi = drawCutscene(3.1, { ...HR, scene: 'rbi', headline: '2-RUN DOUBLE!' })
  assert.notDeepEqual(rbi.px.subarray(0, BAND * W), b.px.subarray(0, BAND * W))
})

test('a custom scene: another backdrop, a mirrored batter, its own extra, its own pose, its own band', () => {
  let drew = 0
  const stamp = (b) => { drew++; b.px[0] = C.trim }
  const spec = {
    backdrop: 'chunky', facing: 'left', poses: ['salute'],
    sprites: { salute: buildPose({ near: [[29, 21], [25, 15], [23, 9]], far: [[40, 21], [44, 27], [44, 33]], nearHand: 'fist', farHand: 'fistDown', farBehind: true }) },
    extras: ['droppedBat', stamp],
    lines: [{ text: '$headline', y: 104, scale: 2, colour: 'trim', typed: true }, { text: '$name', y: 130, scale: 1, colour: 'chalk', align: 'left', after: 0.1 }],
  }
  const b = drawCutscene(3.1, { ...HR, scene: spec })
  assert.equal(drew, 1)
  assert.equal(b.px[0], C.trim, 'a function extra draws')
  assert.ok(!b.px.subarray(BAND * W).includes(C.jerseyLight), 'no shadow on this band')
  assert.equal(b.px[130 * W + 8], C.chalk, 'the name line starts at the left margin')
  for (const name of Object.keys(BACKDROPS)) {
    const k = beatsAt(1, hr, n), buf = { w: W, h: H, px: new Uint8Array(W * H) }
    BACKDROPS[name](buf, k, 1)
    assert.ok(buf.px.subarray(0, BAND * W).some((c) => c !== 0), name + ' paints the scene')
  }
  assert.deepEqual(Object.keys(EXTRAS).sort(), ['batFlip', 'chips', 'droppedBat', 'fireworks'])
  const right = drawCutscene(3.1, { ...HR, scene: { ...spec, facing: 'right' } })
  assert.notDeepEqual(right.px.subarray(0, BAND * W), b.px.subarray(0, BAND * W), 'facing mirrors the batter')
})
