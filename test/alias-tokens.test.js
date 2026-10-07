// The alias tokens minted for #1156 (--border-grid, --text-on-ink-*) resolve
// to the colour of the primitive they name, and each text rung clears AA on
// the dark grounds it sits on. No pixel moves: an alias that drifts from its
// primitive fails here.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PAIRINGS, TEXT, ratio } from '../src/lib/design/contrastPairings.js'

const css = readFileSync(fileURLToPath(new URL('../src/tokens/colors.css', import.meta.url)), 'utf8')
const decl = (name) => css.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim()
const hex = (name) => {
  const v = decl(name)
  const ref = v?.match(/^var\(--([\w-]+)\)$/)
  return ref ? hex(ref[1]) : v
}

const ALIASES = {
  'border-grid': 'rule-grid',
  'text-on-ink-bright': 'paper-3',
  'text-on-ink-soft': 'rule-soft',
  'text-on-ink-dim': 'rule',
}

for (const [alias, primitive] of Object.entries(ALIASES)) {
  test(`--${alias} is an alias of --${primitive}`, () => {
    assert.equal(decl(alias), `var(--${primitive})`)
    assert.match(hex(alias), /^#[0-9A-F]{6}$/i)
    assert.equal(hex(alias), hex(primitive))
  })
}

test('each --text-on-ink-* rung is paired on its dark grounds, and clears AA', () => {
  for (const alias of Object.keys(ALIASES).filter((a) => a.startsWith('text-on-ink-'))) {
    const pairs = PAIRINGS.filter((p) => p.fg === alias)
    assert.ok(pairs.length >= 2, `${alias} has pairings`)
    for (const p of pairs) {
      assert.ok(p.min >= TEXT, `${alias} on ${p.bg} asserts at least ${TEXT}`)
      assert.ok(ratio(hex(alias), hex(p.bg)) >= p.min, `${alias} on ${p.bg}`)
    }
  }
})
