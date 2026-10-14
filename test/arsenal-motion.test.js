import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { LEAD, TAIL, beatsAt, countText, eo, totalMs } from '../src/screens/player/next/modules/arsenal/timeline.js'
import { ruleBody, stripComments } from './helpers/css.js'

// Slice 11 (#2073): the Pitch arsenal menu and Detail panel sit on the shared MenuRail; a pick replays the
// side view; a ghost path fades in, never draws in. Asserted from the source text.
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const card = read('src/screens/player/next/modules/arsenal/ArsenalCard.jsx')
const scene = read('src/screens/player/next/modules/arsenal/FlightScene.jsx')
const css = stripComments(read('src/styles/player-next/pitcher/arsenal.css'))

test('the arsenal menu is a MenuRail, with the Detail as its panel', () => {
  assert.match(card, /import \{ MenuRail \} from '[./]+components\/ui\/control\/MenuRail\.jsx'/)
  assert.match(card, /<MenuRail[\s\S]*panel=\{/)
  assert.match(card, /backLabel="All pitches"/)
  assert.match(card, /railMeta/)
  assert.doesNotMatch(card, /\{one && <Detail/)
  assert.doesNotMatch(card, /arsenal__menu/)
})

test('a pick and an un-pick replay the timeline', () => {
  assert.match(card, /onPick=\{pick\}/)
  assert.match(card, /const pick = \(code\) => \{[\s\S]*?setSolo\(code\)[\s\S]*?clock\.play\(\)/)
})

test('the old menu rules are gone: no display:none rail', () => {
  assert.doesNotMatch(css, /\.arsenal__menu/)
  assert.doesNotMatch(css, /\.arsenal__pick/)
  assert.equal(ruleBody(css, '.arsenal__name'), null)
})

test('a ghost path is whole and faint from the clock, with no CSS animation to fight it', () => {
  assert.match(scene, /b \? b\.trail : faint \? 0\.22 : 1/)
  assert.equal(ruleBody(css, '.arsenal__path--ghost'), null)
  assert.doesNotMatch(css, /arsenal-ghost/)
})

// The Arsenal card's timeline (#2073, slice 12): the board ArsenalReveal's beats as a pure function of t.
// Numbers are the board's; a pitch with no path (ft null) never flies and never lands.
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not within ${eps} of ${b}`)
const P = [
  { code: 'FF', ft: 0.401, rpm: 2233 },
  { code: 'SL', ft: 0.44, rpm: 2500 },
  { code: 'CH', ft: null, rpm: null },
]
const landFF = LEAD + 0.401 * 1000 * 3 // the same float steps as beatsAt
const at = (t, opts) => beatsAt(t, P, opts)
const pitch = (b, code) => b.pitches.find((p) => p.code === code)

test('eo is the board ease-out quart, held at 0 before and 1 after', () => {
  assert.equal(eo(-1), 0)
  assert.equal(eo(0), 0)
  assert.equal(eo(1), 1)
  assert.equal(eo(2), 1)
  close(eo(0.5), 1 - 0.5 ** 4)
})

test('totalMs: 760 lead + the longest flight at 1/S speed + 760 hold; a pitch with no path does not count', () => {
  assert.equal(LEAD, 760)
  assert.equal(TAIL, 760)
  assert.equal(totalMs(P, 3), 2840)
  assert.equal(totalMs(P, 6), 4160)
  assert.equal(totalMs([{ code: 'CH', ft: null }], 3), 1520)
})

test('at t = 0 nothing shows: bar rolled up, no ring, rows hidden, balls at release, no trail, no marks', () => {
  const b = at(0)
  assert.equal(b.roll, 0)
  assert.equal(b.rollEdge, false)
  assert.equal(b.ring.o, 0)
  for (const p of b.pitches) {
    assert.equal(p.row.e, 0)
    assert.equal(p.u, 0)
    assert.equal(p.trail, 0)
    assert.equal(p.mark.o, 0)
  }
})

test('the mix bar rolls in from 100ms over 900ms, with the shadow edge only while it moves', () => {
  assert.equal(at(100).roll, 0)
  const mid = at(550)
  assert.ok(mid.roll > 0 && mid.roll < 1)
  assert.equal(mid.rollEdge, true)
  assert.equal(at(1000).roll, 1)
  assert.equal(at(1000).rollEdge, false)
})

test('the scale ticks draw from 120 + k*40 ms over 300ms; their labels fade from 260 + k*40 ms over 400ms', () => {
  assert.equal(at(120).ticks[0].draw, 0)
  assert.equal(at(420).ticks[0].draw, 1)
  assert.equal(at(320).ticks[5].draw, 0)
  assert.ok(at(330).ticks[5].draw > 0)
  assert.equal(at(260).ticks[0].label, 0)
  assert.equal(at(660).ticks[0].label, 1)
})

test('the release ring grows 3 -> 16 and fades 0.8 -> 0 over the first 380ms of the flight', () => {
  assert.equal(at(LEAD).ring.o, 0)
  const r = at(LEAD + 190).ring
  close(r.r, 3 + 13 * (1 - 0.5 ** 4))
  close(r.o, 0.8 * 0.5 ** 4)
  assert.equal(at(LEAD + 380).ring.o, 0)
})

test('the ball scales in from 0.85 over the 260ms before release, then spins by its rpm', () => {
  const before = pitch(at(LEAD - 260), 'FF')
  assert.equal(before.ball.o, 0)
  close(before.ball.k, 0.85)
  const out = pitch(at(LEAD), 'FF')
  assert.equal(out.ball.o, 1)
  assert.equal(out.ball.k, 1)
  const half = pitch(at(LEAD + 0.401 * 1000 * 3 * 0.5), 'FF')
  close(half.u, 0.5)
  close(half.ball.spin, (-0.5 * 360 * 2233) / 900)
  assert.equal(pitch(at(LEAD + 100), 'CH').ball.spin, 0)
})

test('on landing: ripple 4 -> 14 from 0.6, mark pops from 1.7, segment flashes 0.5, sweep starts, glyph 1.45', () => {
  const p = pitch(at(landFF), 'FF')
  assert.equal(p.landed, true)
  assert.equal(p.u, 1)
  assert.equal(p.ripple.r, 4)
  close(p.ripple.o, 0.6)
  assert.equal(p.mark.o, 0)
  close(p.mark.k, 1.7)
  close(p.flash, 0.5)
  assert.equal(p.sweep.x, 0)
  assert.equal(p.sweep.o, 1)
  close(p.glyph, 1.45)
  assert.equal(pitch(at(landFF + 70), 'FF').mark.o, 1)
  assert.equal(pitch(at(landFF + 140), 'FF').ball.o, 0)
  assert.equal(pitch(at(landFF + 380), 'FF').ripple.o, 0)
  assert.equal(pitch(at(landFF - 1), 'FF').landed, false)
})

test('at the end every flight has landed and settled; the trail rests at 0.45', () => {
  const b = at(totalMs(P, 3))
  assert.equal(b.roll, 1)
  for (const code of ['FF', 'SL']) {
    const p = pitch(b, code)
    assert.equal(p.landed, true)
    assert.equal(p.ripple.o, 0)
    assert.equal(p.mark.o, 1)
    assert.equal(p.mark.k, 1)
    assert.equal(p.flash, 0)
    // The board's sweep fades over 260 + 700ms, but the slowest pitch lands only 760ms before the end:
    // under 1% is left, as on the board.
    assert.ok(p.sweep.o < 0.01, `sweep ${p.sweep.o}`)
    assert.equal(p.glyph, 1)
    close(p.trail, 0.45)
  }
  assert.equal(pitch(b, 'CH').landed, false)
  for (const p of b.pitches) {
    assert.equal(p.row.e, 1)
    assert.equal(p.row.count, 1)
  }
})

test('the menu rows enter 80ms apart from 140ms; the figures count from 240 + i*80 ms', () => {
  assert.ok(at(200).pitches[0].row.e > 0)
  assert.equal(at(220).pitches[1].row.e, 0)
  assert.ok(at(230).pitches[1].row.e > 0)
  assert.equal(at(240).pitches[0].row.count, 0)
  assert.ok(at(300).pitches[0].row.count > 0)
})

test('a pick leaves the others as ghosts: whole, no ball, fading to 0.22, marks to 0.3, rows dimmed', () => {
  const b = at(1000, { solo: 'FF' })
  const sl = pitch(b, 'SL')
  assert.equal(sl.ghost, true)
  assert.equal(sl.u, 1)
  assert.equal(sl.landed, false)
  assert.equal(sl.ball.o, 0)
  close(sl.trail, 0.22)
  close(sl.mark.o, 0.3)
  assert.equal(sl.row.dim, 0.45)
  assert.equal(pitch(at(300, { solo: 'FF' }), 'SL').trail, 0)
  assert.equal(pitch(b, 'FF').ghost, false)
  assert.equal(pitch(b, 'FF').row.dim, 1)
})

test('at 1/6 speed the flight takes twice as long', () => {
  assert.equal(pitch(at(landFF, { S: 6 }), 'FF').landed, false)
  assert.equal(pitch(at(LEAD + 0.401 * 1000 * 6, { S: 6 }), 'FF').landed, true)
})

test('countText counts up with the figure\'s own decimals, or the ones asked for', () => {
  assert.equal(countText(23.3, 1), '23.3')
  assert.equal(countText(23.3, 0), '0.0')
  assert.equal(countText(23, 0.5), '12')
  assert.equal(countText(90, 0.5, 1), '45.0')
  assert.equal(countText(90, 2, 1), '90.0')
})

// ---- the card and the sheet ----
test('one clock drives the side view: no remount key, no CSS draw or ghost animation', () => {
  assert.match(card, /useArsenalClock\(/)
  assert.match(card, /beatsAt\(clock\.t/)
  assert.doesNotMatch(card, /key=\{run\}/)
  assert.doesNotMatch(css, /arsenal-draw/)
  assert.doesNotMatch(css, /arsenal-ghost/)
  assert.equal(ruleBody(css, '.arsenal__path--ghost'), null)
})

test('the clock checks reduced motion and caps a frame at 50ms', () => {
  assert.match(card, /motionIsReduced\(\)/)
  assert.match(card, /Math\.min\(50, now - last\)/)
})

test('the scene draws the beats: ring, ripple, seam, ticks', () => {
  for (const cls of ['arsenal__ring', 'arsenal__ripple', 'arsenal__seam', 'arsenal__tick', 'arsenal__ticklabel']) {
    assert.match(scene, new RegExp(cls), `FlightScene has no ${cls}`)
    assert.ok(ruleBody(css, `.${cls}`), `arsenal.css has no .${cls} rule`)
  }
})
