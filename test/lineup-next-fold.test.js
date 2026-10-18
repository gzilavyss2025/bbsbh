// The folded card's body inset (FoldCard.jsx, styles/lineup-next/field.css).
// The fold renders its Card flush, so the body is the one place that insets
// what it holds. Without it the Ladder ran to the card's edge: the legend and
// the club names touched the border, and the right column's badges were cut
// off (Former teammates, /10172026/tbcle/lineup1). Bullpen padded each of its
// own parts instead, so it looked right and hid the gap.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { stripComments, ruleBody } from './helpers/css.js'

const FIELD = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'styles', 'lineup-next', 'field.css')
const css = stripComments(readFileSync(FIELD, 'utf8'))

const padding = (selector) =>
  ruleBody(css, selector)
    ?.split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('padding:'))
    ?.slice('padding:'.length)
    .trim()

test('the fold body insets its content on every side', () => {
  const p = padding('.lfold__body')
  assert.ok(p, '.lfold__body should set padding')
  const parts = p.split(/\s+/)
  assert.ok(parts.length <= 2 && parts.every((v) => v.startsWith('var(--space-')), `want a token inset on all sides, got "${p}"`)
})

test('the Bullpen parts take no inline inset of their own, so the body is the one inset', () => {
  for (const sel of ['.lpen__sum', '.lpen__board']) {
    const p = padding(sel)
    if (!p) continue
    const parts = p.split(/\s+/)
    const inline = parts.length === 1 ? parts[0] : parts[1]
    assert.equal(inline, '0', `${sel} pads its sides (${p}); the fold body owns that inset`)
  }
})

// The lineup page is square: its cards, sheets and rows set no radius. The
// Ladder came from the old rounded card, so inside the fold every part of it
// goes square too. The old card on /postseason-live keeps its rounding.
test('every rounded Ladder part is square inside the lineup fold', () => {
  const ladderCss = stripComments(
    readFileSync(join(dirname(FIELD), '..', '10b-former-teammates.css'), 'utf8'),
  )
  const rounded = [...ladderCss.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter((m) => /border-radius:\s*var\(--radius-(xs|sm|pill)\)/.test(m[2]))
    .map((m) => m[1].trim())
  assert.ok(rounded.length >= 6, `expected the Ladder's rounded parts, found ${rounded.join(', ')}`)
  const square = [...css.matchAll(/([^{}]+)\{([^}]*border-radius:\s*0;[^}]*)\}/g)].flatMap((m) =>
    m[1].split(',').map((s) => s.trim()),
  )
  for (const sel of rounded) assert.ok(square.includes(`.ltm ${sel}`), `.ltm ${sel} should set border-radius: 0`)
})
