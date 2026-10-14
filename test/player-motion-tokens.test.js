// The player-page motion tokens and the two row surfaces (#2073, slice 01a).
// Every later slice of the player motion work reads these names, so a wrong
// value here is wrong on every card. Asserted from the token sheets, the way
// test/alias-tokens.test.js reads colors.css.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PAIRINGS, TEXT, ratio } from '../src/lib/design/contrastPairings.js'
import { stripComments } from './helpers/css.js'

const sheet = (name) =>
  stripComments(readFileSync(fileURLToPath(new URL(`../src/tokens/${name}`, import.meta.url)), 'utf8'))
const effects = sheet('effects.css')
const colors = sheet('colors.css')
const decl = (css, name) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
const hex = (name) => {
  const v = decl(colors, name)
  const ref = v?.match(/^var\(--([\w-]+)\)$/)
  return ref ? hex(ref[1]) : v
}

test('the two curves are the canvas curves, and --ease-out stays', () => {
  assert.equal(decl(effects, 'ease-stamp'), 'cubic-bezier(0.2, 0.9, 0.3, 1)')
  assert.equal(decl(effects, 'ease-unfold'), 'cubic-bezier(0.23, 1, 0.32, 1)')
  assert.equal(decl(effects, 'ease-out'), 'cubic-bezier(0.16, 1, 0.3, 1)')
})

test('the player-page durations and the stagger step', () => {
  assert.equal(decl(effects, 'dur-rise'), '420ms')
  assert.equal(decl(effects, 'dur-unfold'), '400ms')
  assert.equal(decl(effects, 'dur-grow'), '750ms')
  assert.equal(decl(effects, 'dur-draw'), '900ms')
  assert.equal(decl(effects, 'stagger-step'), '55ms')
})

test('the stamp-in reads the canvas: 380ms on the stamp curve', () => {
  assert.equal(decl(effects, 'dur-stamp-in'), '380ms')
  assert.equal(decl(effects, 'ease-stamp-in'), 'var(--ease-stamp)')
  assert.equal(decl(effects, 'dur-slow'), '360ms', '--dur-slow stays for the rest of the app')
})

test('the row surfaces alias two numbered paper primitives', () => {
  assert.equal(decl(colors, 'surface-row-hover'), 'var(--paper-4)')
  assert.equal(decl(colors, 'surface-row-selected'), 'var(--paper-5)')
  assert.equal(hex('surface-row-hover'), '#F3EBD2')
  assert.equal(hex('surface-row-selected'), '#EFE6C8')
})

test('the text on each row surface is paired, and clears AA', () => {
  for (const bg of ['surface-row-hover', 'surface-row-selected']) {
    const fgs = PAIRINGS.filter((p) => p.bg === bg).map((p) => p.fg)
    for (const fg of ['text-heading', 'text-body', 'text-caption', 'accent-positive']) {
      assert.ok(fgs.includes(fg), `${fg} on ${bg} is paired`)
    }
    for (const p of PAIRINGS.filter((q) => q.bg === bg)) {
      assert.ok(p.min >= TEXT, `${p.fg} on ${bg} asserts text contrast`)
      assert.ok(ratio(hex(p.fg), hex(bg)) >= p.min, `${p.fg} on ${bg}`)
    }
  }
})

test('a loss on a picked row is clay-deep: --accent-negative is under AA there', () => {
  assert.ok(ratio(hex('accent-negative'), hex('surface-row-selected')) < TEXT)
  assert.ok(!PAIRINGS.some((p) => p.fg === 'accent-negative' && p.bg === 'surface-row-selected'))
  assert.ok(PAIRINGS.some((p) => p.fg === 'clay-deep' && p.bg === 'surface-row-selected'))
})
