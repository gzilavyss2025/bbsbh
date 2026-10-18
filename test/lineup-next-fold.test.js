// The lineup page's folded Former teammates card (FoldCard.jsx,
// cards/TeammatesCard.jsx, styles/lineup-next/field.css).
//
// The fold renders its Card flush, so the body is the one place that insets
// what it holds. Without it the Ladder ran to the card's edge: the legend and
// the club names touched the border, and the right column's badges were cut
// off (Former teammates, /10172026/tbcle/lineup1). Bullpen padded each of its
// own parts instead, so it looked right and hid the gap.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments, ruleBody } from './helpers/css.js'

const read = (rel) => readFileSync(new URL(`../src/${rel}`, import.meta.url), 'utf8')
const css = stripComments(read('styles/lineup-next/field.css'))

test('the fold body insets its content on every side', () => {
  assert.match(ruleBody(css, '.lfold__body') ?? '', /padding:\s*var\(--space-3\) var\(--space-3h\);/)
})

test('the Bullpen parts take no side inset of their own, so the body is the one inset', () => {
  assert.doesNotMatch(ruleBody(css, '.lpen__sum') ?? '', /padding/)
  // The board keeps only its top gap: no shorthand, no side or bottom longhand.
  assert.doesNotMatch(ruleBody(css, '.lpen__board') ?? '', /padding(?!-top)[\w-]*:/)
})

// The lineup page is square; the Ladder came from the old rounded card. The
// card sets --ladder-radius once, and every rounded Ladder part reads it, so a
// new rounded part cannot slip in rounded. /postseason-live keeps its rounding.
test('the fold squares the Ladder through its one radius property', () => {
  assert.match(ruleBody(css, '.ltm') ?? '', /--ladder-radius:\s*var\(--radius-square\);/)
  const ladder = stripComments(read('styles/10b-former-teammates.css'))
  const radii = [...ladder.matchAll(/border-radius:\s*([^;]+);/g)].map((m) => m[1])
  assert.ok(radii.length >= 6, 'the Ladder has rounded parts')
  for (const r of radii) assert.match(r, /^var\(--ladder-radius, /, `border-radius: ${r} should read --ladder-radius`)
})

// Gary does not want the legend line on the lineup page (2026-10-18).
test('the fold card leaves out the Ladder legend', () => {
  assert.match(read('screens/lineup/next/cards/TeammatesCard.jsx'), /<Ladder [^>]*legend=\{false\}/)
})
