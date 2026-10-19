// The player motion's JS curves and its shared rise (#2073, slice 01b).
// A tween in JS and a transition in CSS must run on one curve, so each array in
// lib/motion/curves.js is pinned to its token, the way
// test/scorecard-lens-glide.test.js pins EASE_OUT.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  EASE_OUT,
  EASE_STAMP,
  EASE_UNFOLD,
  cubicBezier,
  easeOut,
  easeOutQuart,
  easeStamp,
  easeUnfold,
} from '../src/lib/motion/curves.js'
import * as glide from '../src/lib/scorecard/glide.js'
import { ruleBody, stripComments } from './helpers/css.js'

const read = (rel) => readFileSync(fileURLToPath(new URL(`../src/${rel}`, import.meta.url)), 'utf8')
const effects = stripComments(read('tokens/effects.css'))
const points = (name) =>
  effects.match(new RegExp(`--${name}:\\s*cubic-bezier\\(([^)]*)\\)`))?.[1].split(',').map(Number)
const decl = (body, property) =>
  body
    .split(';')
    .map((d) => d.trim().replace(/\s+/g, ' '))
    .find((d) => d.startsWith(`${property}:`))
    ?.slice(property.length + 1)
    .trim()

test('EASE_STAMP and EASE_UNFOLD are the --ease-stamp and --ease-unfold tokens', () => {
  assert.deepEqual(points('ease-stamp'), EASE_STAMP)
  assert.deepEqual(points('ease-unfold'), EASE_UNFOLD)
})

test('EASE_OUT is the --ease-out token', () => {
  assert.deepEqual(points('ease-out'), EASE_OUT)
  assert.equal(easeOut(0.5), cubicBezier(...EASE_OUT)(0.5))
})

test('cubicBezier moved: glide.js re-exports the one in lib/motion/curves.js', () => {
  assert.equal(glide.cubicBezier, cubicBezier)
  // The glide's own curve still reads --ease-out through it.
  assert.equal(glide.easeOut(0.5), cubicBezier(...glide.EASE_OUT)(0.5))
})

test('easeStamp and easeUnfold run from 0 to 1, never fall and never overshoot', () => {
  for (const ease of [easeStamp, easeUnfold]) {
    assert.equal(ease(0), 0)
    assert.equal(ease(1), 1)
    let was = 0
    for (let i = 1; i <= 100; i += 1) {
      const y = ease(i / 100)
      assert.ok(y >= was && y <= 1, `at ${i / 100}`)
      was = y
    }
  }
})

test('easeStamp is front-loaded: most of the move is done by the middle', () => {
  assert.ok(easeStamp(0.5) > 0.85, `easeStamp(0.5) = ${easeStamp(0.5)}`)
})

test('easeOutQuart is the canvas eo: 1 - (1 - t)^4, clamped', () => {
  assert.equal(easeOutQuart(0), 0)
  assert.equal(easeOutQuart(1), 1)
  assert.equal(easeOutQuart(0.5), 0.9375)
  assert.equal(easeOutQuart(-1), 0)
  assert.equal(easeOutQuart(2), 1)
})

test('the player rise: 6px up and in, over --dur-rise on the stamp curve, one step per row', () => {
  const css = stripComments(read('styles/motion/player-rise.css'))
  assert.match(css, /@keyframes player-rise-in\s*\{\s*from\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateY\(var\(--space-1h\)\);/)
  assert.equal(
    decl(ruleBody(css, '.player-rise'), 'animation'),
    'player-rise-in var(--dur-rise) var(--ease-stamp) calc(var(--stagger-step) * var(--rise-i, 0)) backwards',
  )
  assert.equal(decl(ruleBody(css, '.player-rise--wait'), 'opacity'), '0')
})

test('the player rise is off under reduced motion, and a waiting block shows', () => {
  const css = stripComments(read('styles/motion/player-rise.css')).replace(/\s+/g, ' ')
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduced, /\.player-rise--wait \{ opacity: 1; \}/)
  assert.match(reduced, /\.player-rise \{ animation: none; \}/)
})

test('src/index.css imports the rise right after the stamp-in, before focus/', () => {
  const lines = read('index.css').split('\n')
  const at = (p) => lines.findIndex((l) => l.includes(p))
  assert.equal(at("motion/player-rise.css'"), at("motion/stamp-in.css'") + 1)
  assert.ok(at("motion/player-rise.css'") < at("focus/stage.css'"))
})
