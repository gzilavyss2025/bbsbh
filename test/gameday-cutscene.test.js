// The big-play cutscene's pure parts: the clock, the art's invariants, and a frame's pixels.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { beatsAt, PER_LETTER, TYPE_AT } from '../src/screens/gameday/next/cutscene/cutsceneTimeline.js'
import { BAND, C, H, KIT, KIT_SLOTS, SPR, TOKENS, W, WAIST, textW } from '../src/screens/gameday/next/cutscene/cutsceneArt.js'
import { BATTER_X, BATTER_Y, drawCutscene } from '../src/screens/gameday/next/cutscene/drawCutscene.js'

const HR = { variant: 'hr', headline: 'HOME RUN!', name: 'BATTER NAME', detail: '382 FT', mono: 'M' }

test('the clock: two white frames, a slide, letters at 20 a second, then the name, then the detail', () => {
  const n = HR.headline.length, done = TYPE_AT + PER_LETTER * n
  assert.ok(beatsAt(0.02, 'hr', n).white && beatsAt(0.14, 'hr', n).white && !beatsAt(0.1, 'hr', n).white)
  assert.equal(beatsAt(0.15, 'hr', n).slide, 70)
  assert.equal(beatsAt(0.5, 'hr', n).slide, 0)
  assert.equal(beatsAt(TYPE_AT - 0.01, 'hr', n).typed, 0)
  assert.equal(beatsAt(TYPE_AT + PER_LETTER * 3 + 0.001, 'hr', n).typed, 4)
  assert.equal(beatsAt(done + 1, 'hr', n).typed, n)
  const k = beatsAt(done + 0.2, 'hr', n)
  assert.ok(!k.name && !k.detail, 'the name waits a quarter second')
  assert.ok(beatsAt(done + 0.4, 'hr', n).name && !beatsAt(done + 0.4, 'hr', n).detail)
  assert.ok(beatsAt(done + 0.5, 'hr', n).detail)
  assert.ok(beatsAt(done + 0.5, 'hr', n).end > done + 0.5)
})

test('each variant has its own celebration', () => {
  assert.equal(beatsAt(0.3, 'hr', 9).pose, 'up')
  assert.equal(beatsAt(0.3, 'rbi', 9).pose, 'point')
  assert.ok(['point', 'point2'].includes(beatsAt(2, 'rbi', 9).pose))
  assert.ok(['up', 'pump'].includes(beatsAt(2, 'slam', 9).pose))
  assert.ok(beatsAt(1, 'hr', 9).batFlip > 0 && beatsAt(1, 'slam', 9).batFlip < 0)
  assert.ok(beatsAt(1, 'slam', 9).fireworks && !beatsAt(1, 'hr', 9).fireworks)
})

test('the art: every pose is one rectangle of KIT letters, and every slot is a token or a kit slot', () => {
  for (const [name, rows] of Object.entries(SPR)) {
    assert.equal(rows.length, 49, name)
    for (const r of rows) {
      assert.equal(r.length, 45, name)
      for (const ch of r) assert.ok(ch === '.' || KIT[ch] != null, `${name}: ${ch}`)
    }
    assert.ok(rows[WAIST].includes('B'), `${name}: the belt is on the waist row`)
  }
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
  const q = SPR.up[1].indexOf('S')
  assert.equal(b.px[(BATTER_Y + 2) * W + BATTER_X + q * 2], C.skinLight, 'a fist is up at the top of the batter box')
  const rbi = drawCutscene(3.1, { ...HR, variant: 'rbi', headline: '2-RUN DOUBLE!' })
  assert.notDeepEqual(rbi.px.subarray(0, BAND * W), b.px.subarray(0, BAND * W))
})
