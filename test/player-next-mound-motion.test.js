import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'

// On the mound's entrance (#2073, slice 10), read from the source text.
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const css = stripComments(read('src/styles/player-next/pitcher/mound.css'))
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()
const anim = (sel) => decl(ruleBody(css, sel), 'animation')

test('the track: rise, fill draw, zone fade, chip stamp, on the board times', () => {
  assert.equal(anim('.mound--in .mound__block--track'), 'mound-rise var(--dur-rise) var(--ease-stamp) calc(var(--stagger-step) * 1.5) backwards')
  assert.equal(anim('.mound--in .mound__fill'), 'mound-draw var(--dur-draw) var(--ease-stamp) calc(var(--stagger-step) * 4.5) backwards')
  assert.equal(anim('.mound--in .mound__zone'), 'mound-fade var(--dur-unfold) var(--ease-out) var(--dur-draw) backwards')
  assert.equal(anim('.mound--in .mound__now .mound__day'), 'card-stamp-in var(--dur-stamp-in) var(--ease-stamp) calc(var(--stagger-step) * 9) backwards')
})

test('the bars grow on scale, one --stagger-step apart, and their counts follow', () => {
  assert.equal(anim('.mound--in .mound__bar'), 'mound-grow calc(var(--stagger-step) * 12) var(--ease-stamp) calc(var(--stagger-step) * (6 + var(--k, 0))) backwards')
  assert.equal(anim('.mound--in .mound__pv'), 'mound-fade calc(var(--dur-fast) * 2.5) var(--ease-out) calc(var(--stagger-step) * (14 + var(--k, 0))) backwards')
  const grow = ruleBody(css, '@keyframes mound-grow')
  assert.match(grow, /scale:\s*1 0/)
  assert.doesNotMatch(grow, /height/)
  assert.equal(anim('.mound--in .mound__avg'), 'mound-draw var(--dur-draw) var(--ease-stamp) calc(var(--stagger-step) * 13) backwards')
})

test('the Day chip pulses 4 times on opacity and transform, never box-shadow', () => {
  assert.equal(anim('.mound--in .mound__now .mound__day::after'), 'mound-ring calc((var(--dur-draw) + var(--dur-unfold)) * 2) ease-in-out calc(var(--stagger-step) * 25) 4')
  const ring = css.slice(css.indexOf('@keyframes mound-ring'), css.indexOf('@keyframes mound-ring') + 200)
  assert.match(ring, /opacity/)
  assert.match(ring, /transform:\s*scale\(1\.06\)/)
  assert.doesNotMatch(ring, /box-shadow/)
})

test('before view the parts wait hidden or at zero', () => {
  assert.match(ruleBody(css, '.mound--pre .mound__fill,\n.mound--pre .mound__avg') ?? '', /scaleX\(0\)/)
  assert.match(css, /\.mound--pre \.mound__bar\s*\{\s*scale:\s*1 0/)
})

test('a bar lifts on a fine-pointer hover, on translate', () => {
  assert.match(css, /@media \(hover: hover\) and \(pointer: fine\)\s*\{\s*\.mound__bar:hover\s*\{\s*translate:\s*0 calc\(var\(--bw-heavy\) \* -1\.5\);\s*filter:\s*brightness\(1\.15\)/)
  assert.equal(decl(ruleBody(css, '.mound__bar'), 'transition'), 'translate var(--dur-fast) var(--ease-stamp), filter var(--dur-fast) var(--ease-stamp)')
})

test('reduced motion: no beat, no pulse, no lift', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(block, /\.mound--in \.mound__now \.mound__day::after/)
  assert.match(block, /animation:\s*none/)
  assert.match(block, /\.mound__bar\s*\{\s*transition:\s*none/)
})

test('no raw time in any mound.css animation or transition', () => {
  for (const m of css.matchAll(/(?:animation|transition)[a-z-]*:\s*([^;}]*)/g)) {
    assert.doesNotMatch(m[1].replace(/var\([^)]*\)/g, ''), /\d(?:ms|s)\b/, m[0])
  }
})

test('the card gates its entrance on view, and each bar carries its index', () => {
  const jsx = read('src/screens/player/next/modules/mound/index.jsx')
  assert.match(jsx, /function MoundCard\(/)
  assert.match(jsx, /useInViewOnce\(once\)/)
  assert.match(jsx, /phase === 'wait' \? ' mound--pre' : phase === 'play' \? ' mound--in' : ''/)
  assert.match(jsx, /mound__block mound__block--track/)
  assert.match(jsx, /'--k': i/)
})
