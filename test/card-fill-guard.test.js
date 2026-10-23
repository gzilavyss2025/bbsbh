import assert from 'node:assert/strict'
import test from 'node:test'
import { findCardFill } from '../scripts/layout/check-card-fill.mjs'

// The matcher behind the card-fill guard. It is pure: every case is a CSS string.

test('the rule that rubbed the scouting cards together is caught', () => {
  const [hit] = findCardFill('.ww-scout__card > * {\n  height: 100%;\n}')
  assert.equal(hit.selector, '.ww-scout__card > *')
  assert.equal(hit.decl, 'height: 100%')
  assert.equal(hit.line, 2)
})

test('min-height, block-size and a calc of 100% are caught too', () => {
  assert.equal(findCardFill('.a > * { min-height: 100% }').length, 1)
  assert.equal(findCardFill('.a > * { block-size: 100% }').length, 1)
  assert.equal(findCardFill('.a > * { height: calc(100% - 4px) }').length, 1)
})

test('a rule on a card class is caught, with or without a state', () => {
  assert.equal(findCardFill('.card--stamped { height: 100% }').length, 1)
  assert.equal(findCardFill('.x .card:hover { height: 100% }').length, 1)
  assert.equal(findCardFill('.x.card--named { min-height: 100% }').length, 1)
})

test('one hit per declaration, the matching selector named', () => {
  const hits = findCardFill('.a, .b > * { height: 100%; min-height: 100% }')
  assert.equal(hits.length, 2)
  assert.equal(hits[0].selector, '.b > *')
})

test('a named part, a pixel height and a card-like class name are not read', () => {
  assert.equal(findCardFill('.bar { height: 100% }').length, 0)
  assert.equal(findCardFill('.a > * { height: 40px }').length, 0)
  assert.equal(findCardFill('.a > * { flex: 1 }').length, 0)
  assert.equal(findCardFill('.cardinal { height: 100% }').length, 0)
  assert.equal(findCardFill('.card__body { height: 100% }').length, 0)
  assert.equal(findCardFill('.a > .b { height: 100% }').length, 0)
})

test('a card-fill-exempt reason on the line before the rule is honoured', () => {
  assert.equal(findCardFill('/* card-fill-exempt: a poster, not a card */\n.a > * { height: 100% }').length, 0)
})

test('an exempt marker with no reason, or one further up, does not count', () => {
  assert.equal(findCardFill('/* card-fill-exempt: */\n.a > * { height: 100% }').length, 1)
  assert.equal(findCardFill('/* card-fill-exempt: why */\n\n.a > * { height: 100% }').length, 1)
})

test('a keyframes step is not a layout', () => {
  assert.equal(findCardFill('@keyframes k { 0% { height: 100% } }').length, 0)
})
