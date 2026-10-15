// scripts/layout/check-media-widths.mjs rejects an @media width that is not on the
// grandfather list (#1179). Each case feeds a fixture to the guard's scanner: a
// bad width must fail, a listed or exempt one must pass.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { WIDTHS, findUnlistedWidths } from '../scripts/layout/check-media-widths.mjs'

const w = (src, kind) => findUnlistedWidths(src, kind).map((f) => `${f.line}:${f.width}`)
const js = (src) => w(src, 'js')

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

test('a width in a JS media query is read too (#1831)', () => {
  assert.deepEqual(js("const q = useMediaQuery('(min-width: 735px)')"), ['1:735px'])
  assert.deepEqual(js("window.matchMedia(`(max-width: 777px) and (hover: hover)`)"), ['1:777px'])
  assert.deepEqual(js("export const X_QUERY = '(width >= 731px)'"), ['1:731px'])
  assert.deepEqual(js("useMediaQuery('(min-width: 740px)')"), [])
  assert.deepEqual(js("useMediaQuery('(min-width: 1000px)')"), [])
  assert.deepEqual(js("matchMedia('(prefers-reduced-motion: reduce)')"), [])
  assert.deepEqual(js("const style = { maxWidth: 'min(100%, 720px)' }"), [])
  assert.deepEqual(js('fn(width, 735px)'), [])
  assert.deepEqual(js("items.map(({ a }) => (\n  <div style={{ width: '12rem' }}><Grid min=\"4rem\" /></div>\n))"), [])
  assert.deepEqual(js("useMediaQuery('(700px <= width <= 800px)')"), ['1:800px'])
})

test('a JS comment that quotes a query does not fail, and the exempt marker works', () => {
  assert.deepEqual(js("// was '(min-width: 735px)'\nconst a = 1"), [])
  assert.deepEqual(js("/* '(min-width: 735px)' */ const a = 1"), [])
  assert.deepEqual(js("// breakpoint-exempt: a print sheet\nuseMediaQuery('(min-width: 735px)')"), [])
  assert.deepEqual(js("// breakpoint-exempt\nuseMediaQuery('(min-width: 735px)')"), ['2:735px'])
})

test('a container query in a JS string is not covered, and a string cannot hide a query (#1831)', () => {
  assert.deepEqual(js("const q = '@container card (min-width: 500px)'"), [])
  assert.deepEqual(js("const s = 'a /* b'\nuseMediaQuery('(min-width: 735px)')\n/* c */"), ['2:735px'])
  assert.deepEqual(w('.a::before { content: "/*"; }\n@media (min-width: 735px) { }\n/* c */'), ['2:735px'])
})

test('layout.css documents every width the guard lists', () => {
  const css = readFileSync(new URL('../src/tokens/layout.css', import.meta.url), 'utf8')
  const table = css.slice(css.indexOf('SCREEN WIDTHS'))
  for (const width of WIDTHS) {
    assert.match(table, new RegExp(`(?<![\\d.])${width.replace('.', '\\.')}(?![\\d.])`), width)
  }
})
