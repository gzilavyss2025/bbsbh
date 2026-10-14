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

const parts = stripComments(read(`${MOD}parts.css`))

test('a fold the reader opens cascades its rows, and their bars grow', () => {
  assert.equal(
    decl(ruleBody(parts, '.splitsmod__appear'), 'animation'),
    'splitsmod-rise calc(var(--dur-rise) * 2) var(--ease-unfold) calc(var(--stagger-step) * var(--i, 0)) backwards',
  )
  assert.equal(
    decl(ruleBody(parts, '.splitsmod__appear .splitsmod__fill'), 'animation'),
    'splitsmod-grow var(--dur-grow) var(--ease-unfold) calc(var(--dur-fast) + var(--stagger-step) * var(--i, 0)) backwards',
  )
  const gl = read(`${MOD}GameLines.jsx`)
  assert.match(gl, /tapped\[item\.fold\.key\] \? 'splitsmod__appear' : undefined/)
  assert.match(gl, /style=\{\{ '--i': i \}\}/)
  assert.match(gl, /<Part once=\{viewKey\(bio\.id, `splits-\$\{group\}:g`\)\}/)
})

test('the fold chevron turns, and a club press shrinks the club', () => {
  assert.equal(decl(ruleBody(parts, '.splitsmod__foldchev'), 'transition'), 'transform var(--dur-med) var(--ease-out)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__club'), 'transition'), 'transform var(--dur-fast) var(--ease-stamp)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__club:active'), 'transform'), 'scale(0.97)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__door.boxlines__door:active'), 'background'), 'var(--bg-canvas)')
})

test('the picked club prints with the canvas offset shadow', () => {
  const body = ruleBody(parts, ".splitsmod__club[aria-pressed='true']")
  assert.ok(body)
  assert.equal(decl(body, 'box-shadow'), 'var(--bw-heavy) var(--bw-heavy) 0 var(--border-stamped)')
  assert.equal(decl(ruleBody(parts, '.splitsmod__club') ?? '', 'box-shadow'), undefined, 'an unpicked club has no shadow')
})

test('hover colours, for a fine pointer only', () => {
  const at = parts.indexOf('@media (hover: hover) and (pointer: fine)')
  assert.ok(at > -1)
  const block = parts.slice(at, parts.indexOf('@media (prefers-reduced-motion: reduce)', at))
  assert.match(block, /\.splitsmod__door\.boxlines__door:hover\s*\{\s*background:\s*var\(--surface-inset\)/)
  assert.match(block, /\.splitsmod__fold:hover\s*\{\s*background:\s*var\(--border-hairline\)/)
  assert.match(block, /\.splitsmod__club:hover\s*\{\s*background:\s*var\(--bg-canvas\)/)
  assert.match(block, /\.splitsmod__club\[aria-pressed='true'\]:hover\s*\{\s*background:\s*var\(--surface-inset\)/)
})

test('parts.css: reduced motion stops the cascade and the turns', () => {
  const block = parts.slice(parts.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(block, /\.splitsmod__appear,\s*\.splitsmod__appear \.splitsmod__fill\s*\{\s*animation:\s*none/)
  assert.match(block, /\.splitsmod__club,\s*\.splitsmod__foldchev\s*\{\s*transition:\s*none/)
})

// parts.css is outside src/styles/, so check-raw-values.mjs never reads it.
test('parts.css: no raw time and no hex', () => {
  for (const m of parts.matchAll(/(?:animation|transition)[a-z-]*:\s*([^;}]*)/g)) {
    assert.doesNotMatch(m[1].replace(/var\([^)]*\)/g, ''), /\d(?:ms|s)\b/, m[0])
  }
  assert.doesNotMatch(parts, /#[0-9a-f]{3,8}\b/i)
})
