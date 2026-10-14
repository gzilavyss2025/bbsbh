// Slice 20c (#2073): the Similar rows take the canvas row hover and a focus ring, and the
// Foul balls count cells are 52px, as the canvas draws them.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', 'src')
const c = stripComments(readFileSync(join(SRC, 'styles/player-next/both/similar.css'), 'utf8'))
const fouls = stripComments(readFileSync(join(SRC, 'styles/player-next/batter/fouls.css'), 'utf8'))

test('a Similar row tints to the row-hover surface, on pointer devices only', () => {
  assert.match(c, /@media \(hover: hover\) \{\s*\.simp__row:hover \{\s*background: var\(--surface-row-hover\);/)
  assert.doesNotMatch(c, /\.simp__row:hover \{\s*background: var\(--bg-canvas\)/)
})

test('a Similar row draws the house ring when it has keyboard focus', () => {
  const ring = ruleBody(c, '.simp__row:focus-visible')
  assert.ok(ring)
  assert.match(ring, /outline: var\(--bw-heavy\) solid var\(--focus-ring\)/)
  assert.match(ring, /outline-offset: calc\(var\(--bw-heavy\) \* -1\)/)
})

test('a Foul balls count cell is 52px, the tap minimum plus one step', () => {
  assert.match(ruleBody(fouls, '.fouls__cell'), /min-height: calc\(var\(--tap-min\) \+ var\(--space-2\)\);/)
})
