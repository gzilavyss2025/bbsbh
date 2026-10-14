import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'

// Splits motion (#2073, slice 08a): the parts rise on view and their bars grow, from the
// source text, the way notice-n5.test.js reads a sheet.
const read = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')
const css = stripComments(read('src/styles/player-next/both/splits.css'))
const MOD = 'src/screens/player/next/modules/splits/'
const decl = (body, prop) =>
  body?.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${prop}:`))?.slice(prop.length + 1).trim()

test('a part waits unseen, then rises on the unfold curve', () => {
  assert.equal(decl(ruleBody(css, '.splitsmod__part.is-pre'), 'opacity'), '0')
  assert.equal(
    decl(ruleBody(css, '.splitsmod__part.is-in'), 'animation'),
    'splitsmod-rise calc(var(--dur-rise) * 2) var(--ease-unfold) backwards',
  )
  assert.match(ruleBody(css, '@keyframes splitsmod-rise'), /translateY\(var\(--space-3h\)\)/)
})

test('the bars grow from 0.02, row by row, only in a part that rises', () => {
  assert.equal(
    decl(ruleBody(css, '.splitsmod__part.is-in .splitsmod__fill'), 'animation'),
    'splitsmod-grow var(--dur-grow) var(--ease-unfold) calc(var(--dur-fast) + var(--stagger-step) * var(--i, 0)) backwards',
  )
  assert.match(ruleBody(css, '@keyframes splitsmod-grow'), /transform:\s*scaleX\(0\.02\)/)
})

test('a fill that changes in place glides', () => {
  assert.equal(decl(ruleBody(css, '.splitsmod__fill'), 'transition'), 'transform var(--dur-grow) var(--ease-unfold)')
})

test('reduced motion: no rise, no grow, no glide', () => {
  const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'))
  assert.match(block, /\.splitsmod__part\.is-pre\s*\{\s*opacity:\s*1/)
  assert.match(block, /\.splitsmod__fill\s*\{\s*transition:\s*none/)
})

test('no raw time in any splits.css animation or transition', () => {
  for (const m of css.matchAll(/(?:animation|transition)[a-z-]*:\s*([^;}]*)/g)) {
    const bare = m[1].replace(/var\([^)]*\)/g, '')
    assert.doesNotMatch(bare, /\d(?:ms|s)\b/, m[0])
  }
})

test('rows carry their index to the fill, and the parts go through Part', () => {
  const rows = read(`${MOD}LineRows.jsx`)
  assert.match(rows, /export function Part\(/)
  assert.match(rows, /useInViewOnce\(once\)/)
  assert.match(rows, /phase === 'wait' \? ' is-pre' : phase === 'play' \? ' is-in' : ''/)
  assert.match(rows, /'--i': i/)
  const index = read(`${MOD}index.jsx`)
  assert.doesNotMatch(index, /<section className="splitsmod__part"/)
  assert.match(index, /<Part once=\{`\$\{once\}:h`\}/)
  assert.match(index, /<Part once=\{`\$\{once\}:s`\}/)
  assert.match(read(`${MOD}VsTeam.jsx`), /<Part once=/)
})

test('the club strip glides on a pick and jumps on mount', () => {
  const vs = read(`${MOD}VsTeam.jsx`)
  assert.match(vs, /behavior: glide \? 'smooth' : 'auto'/)
  assert.match(vs, /centred\.current !== pick && !motionIsReduced\(\)/)
})
