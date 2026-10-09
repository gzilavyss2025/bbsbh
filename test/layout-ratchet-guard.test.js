import assert from 'node:assert/strict'
import test from 'node:test'
import { compare, countLayout } from '../scripts/layout/check-layout-ratchet.mjs'

// The matcher behind the layout ratchet. It is pure: every case is a CSS string.

const none = { column: 0, wrap: 0, grid: 0 }
const css = `
.a { display: flex; flex-direction: column; }
@media (min-width: 600px) { .b { display: inline-grid; } }
.c { flex-flow: row wrap; }
.d { flex-flow: column-reverse; }
.e { display: flex; flex-wrap: nowrap; }
/* flex-direction: column in a comment is not a rule */
`

test('counts column, wrap and grid rules, nested ones and shorthands included', () => {
  assert.deepEqual(countLayout(css), { column: 2, wrap: 1, grid: 1 })
})

test('a rule with a layout-exempt reason on the line before is not counted', () => {
  const src = '/* layout-exempt: needs a named area */\n.x { display: grid; }\n.y { display: grid; }'
  assert.deepEqual(countLayout(src), { ...none, grid: 1 })
})

test('an exempt marker with no reason does not count as one', () => {
  assert.deepEqual(countLayout('/* layout-exempt: */\n.x { display: grid; }'), { ...none, grid: 1 })
})

test('an added rule fails', () => {
  const problems = compare({ 'a.css': { ...none, grid: 2 } }, { 'a.css': { grid: 1 } })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /a\.css.*grid.*2.*1/)
})

test('a new file with a layout rule fails', () => {
  assert.equal(compare({ 'new.css': { ...none, column: 1 } }, {}).length, 1)
})

test('a removed rule with an unlowered budget fails', () => {
  const problems = compare({ 'a.css': { ...none, grid: 1 } }, { 'a.css': { grid: 2 } })
  assert.equal(problems.length, 1)
  assert.match(problems[0], /lower/i)
})

test('a file that is gone but still in the budget fails', () => {
  assert.equal(compare({}, { 'gone.css': { grid: 1 } }).length, 1)
})

test('matching counts pass', () => {
  assert.deepEqual(compare({ 'a.css': { ...none, grid: 1, wrap: 2 } }, { 'a.css': { grid: 1, wrap: 2 } }), [])
})
