import assert from 'node:assert/strict'
import test from 'node:test'
import { compare, countLayout, grew, layoutFiles } from '../scripts/layout/check-layout-ratchet.mjs'

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

// #1831 item 3: the ratchet's gaps.

test('property and keyword case do not hide a rule (a)', () => {
  assert.deepEqual(countLayout('.a { DISPLAY: GRID; FLEX-DIRECTION: Column; Flex-Wrap: Wrap; }'), { column: 1, wrap: 1, grid: 1 })
})

test('a rule inside @keyframes is not counted (b)', () => {
  const src = '@keyframes pop { from { display: grid; } to { flex-direction: column; } }\n@-webkit-keyframes pop { 0% { display: grid; } }\n.a { display: grid; }'
  assert.deepEqual(countLayout(src), { ...none, grid: 1 })
})

test('grew reads the numbers, not the message text (c)', () => {
  assert.equal(grew({ 'a.css': { ...none, grid: 2 } }, { 'a.css': { grid: 1 } }), true)
  assert.equal(grew({ 'new.css': { ...none, wrap: 1 } }, {}), true)
  assert.equal(grew({ 'a.css': { ...none, grid: 1 } }, { 'a.css': { grid: 2 } }), false)
  assert.equal(grew({ 'a.css': { ...none, grid: 1 } }, { 'a.css': { grid: 1 } }), false)
})

test('an exempt comment that ends the previous rule line does not exempt the next rule (d)', () => {
  const src = '.a { color: red; } /* layout-exempt: for a */\n.b { display: grid; }'
  assert.deepEqual(countLayout(src), { ...none, grid: 1 })
  assert.deepEqual(countLayout('/* layout-exempt: ok */\n.b { display: grid; }'), none)
  assert.deepEqual(countLayout('.a { color: red; }\n/* layout-exempt: ok */\n.b { display: grid; }'), none)
})

test('index.css and the token files are counted with src/styles (e)', () => {
  const files = layoutFiles()
  assert.ok(files.includes('src/index.css'))
  assert.ok(files.includes('src/tokens/layout.css'))
  assert.ok(!files.some((f) => f.startsWith('src/styles/system/')))
})
