// scripts/check-css-vars.mjs rejects a var(--x) that nothing defines (#2526). Each case
// feeds a fixture to the guard's scanners: an undefined read must fail, a defined one,
// one with a fallback and one set from JS must pass.

import assert from 'node:assert/strict'
import test from 'node:test'
import { declaredIn, findUndefinedReads, literalsIn } from '../scripts/layout/check-css-vars.mjs'

const defs = (css = '', js = '') => {
  const { names, prefixes } = literalsIn(js)
  for (const n of declaredIn(css)) names.add(n)
  return { names, prefixes }
}
const bad = (css, defined = defs()) => findUndefinedReads(css, defined).map((f) => `${f.line}:${f.name}`)

test('a read of a property nothing defines fails, with its line', () => {
  assert.deepEqual(bad('.a {\n  color: var(--nope);\n}\n'), ['2:--nope'])
  assert.deepEqual(bad('.a { color: var( --nope ); }'), ['1:--nope'])
})

test('a property a stylesheet declares, token or local rule, passes', () => {
  assert.deepEqual(bad('.a { color: var(--ink); }', defs(':root { --ink: #111; }')), [])
  assert.deepEqual(bad('.a { --band-fill: red; } .b { fill: var(--band-fill); }', defs('.a { --band-fill: red; }')), [])
})

test('a read with a fallback passes; the fallback itself is still read', () => {
  assert.deepEqual(bad('.a { color: var(--nope, red); }'), [])
  assert.deepEqual(bad('.a { color: var(--nope, var(--also-nope)); }'), ['1:--also-nope'])
})

test('a property JS sets passes: a literal name, or a template prefix', () => {
  assert.deepEqual(bad('.a { width: var(--bar-fill); }', defs('', "el.style.setProperty('--bar-fill', v)")), [])
  assert.deepEqual(bad('.a { width: var(--row-3); }', defs('', 'const k = `--row-${i}`')), [])
  assert.deepEqual(bad('.a { width: var(--col-3); }', defs('', 'const k = `--row-${i}`')), ['1:--col-3'])
})

test('a comment neither reads nor defines', () => {
  assert.deepEqual(bad('/* var(--nope) */ .a { color: red; }'), [])
  assert.deepEqual(bad('.a { color: var(--ink); }', defs('/* --ink: #111; */')), ['1:--ink'])
  assert.deepEqual(bad('.a { color: var(--x); }', defs('', "// el.style.setProperty('--x', 1)")), ['1:--x'])
})

test('a source with its own definitions passes on them alone', () => {
  const own = declaredIn(':root { --navy: #1B2A3A; }')
  assert.deepEqual(findUndefinedReads('.a { color: var(--navy); }', defs(), own), [])
  assert.equal(findUndefinedReads('.a { color: var(--accent-primary); }', defs(), own).length, 1)
})
