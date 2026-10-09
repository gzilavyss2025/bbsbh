// scripts/layout/check-media-widths.mjs rejects an @media width that is not on the
// grandfather list (#1179). Each case feeds a fixture to the guard's scanner: a
// bad width must fail, a listed or exempt one must pass.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { WIDTHS, findUnlistedWidths } from '../scripts/layout/check-media-widths.mjs'

const w = (src) => findUnlistedWidths(src).map((f) => `${f.line}:${f.width}`)

test('a width off the list fails; min, max, range and rem forms are read', () => {
  assert.deepEqual(w('@media (min-width: 735px) { .a { color: red } }'), ['1:735px'])
  assert.deepEqual(w('@media (max-width: 777px) and (min-width: 740px) { }'), ['1:777px'])
  assert.deepEqual(w('@media (width >= 731px) { }'), ['1:731px'])
  assert.deepEqual(w('@media (700px <= width <= 800px) { }'), ['1:800px'])
  assert.deepEqual(w('@media (min-height: 500px) { }'), [])
  assert.deepEqual(w('@media (max-width: 31rem) { }'), ['1:31rem'])
})

test('every listed width passes, and a non-width query is ignored', () => {
  for (const width of WIDTHS) assert.deepEqual(w(`@media (min-width: ${width}) { }`), [], width)
  assert.deepEqual(w('@media (prefers-reduced-motion: reduce) { }'), [])
  assert.deepEqual(w('@media (min-width: 740px) and (hover: hover) { }'), [])
})

test('the exempt marker needs a reason, on the line or the line above', () => {
  assert.deepEqual(w('/* breakpoint-exempt: a print sheet */\n@media (min-width: 735px) { }'), [])
  assert.deepEqual(w('@media (min-width: 735px) { /* breakpoint-exempt: a reason */ }'), [])
  assert.deepEqual(w('/* breakpoint-exempt */\n@media (min-width: 735px) { }'), ['2:735px'])
})

test('a comment that quotes a query does not fail', () => {
  assert.deepEqual(w('/* @media (min-width: 735px) { */\n.a { color: red }'), [])
})

test('layout.css documents every width the guard lists', () => {
  const css = readFileSync(new URL('../src/tokens/layout.css', import.meta.url), 'utf8')
  const table = css.slice(css.indexOf('SCREEN WIDTHS'))
  for (const width of WIDTHS) {
    assert.match(table, new RegExp(`(?<![\\d.])${width.replace('.', '\\.')}(?![\\d.])`), width)
  }
})
