// The pair ledger's pure rules (#2455) and its source contract. The suite has no JSX
// loader, so the component is pinned the way the suite pins others: by reading its source.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripComments } from './helpers/css.js'
import { pairLead } from '../src/lib/design/ledger/pairLead.js'

const src = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')
const code = (p) => src(p).replace(/^\s*\/\/.*$/gm, '')

test('pairLead: the larger figure leads, or the smaller one when lower wins', () => {
  assert.equal(pairLead(5, 3), 'a')
  assert.equal(pairLead(3, 5), 'b')
  assert.equal(pairLead(4, 9, { lowerWins: true }), 'a')
  assert.equal(pairLead(27, 11, { lowerWins: true }), 'b')
})

test('pairLead: a tie marks nobody, and negative figures compare as numbers', () => {
  assert.equal(pairLead(8, 8, { lowerWins: true }), null)
  assert.equal(pairLead(-3, 5), 'b')
  assert.equal(pairLead(-3, -7), 'a')
})

test('pairLead: a missing figure is never zero and never a win', () => {
  for (const missing of [null, undefined, '', NaN, '—']) {
    assert.equal(pairLead(missing, -4), null)
    assert.equal(pairLead(2, missing, { lowerWins: true }), null)
  }
  assert.equal(pairLead(null, null), null)
})

test('pairLead: figures tie when they match at the precision the reader sees', () => {
  assert.equal(pairLead(0.2501, 0.2504, { digits: 3 }), null)
  assert.equal(pairLead(0.2501, 0.2514, { digits: 3 }), 'b')
  assert.equal(pairLead(0.2501, 0.2504), 'b')
})

test('PairLedger takes exactly two sides and hard-codes no club, rank or threshold', () => {
  assert.match(src('components/ui/table/PairLedger.jsx'), /sides\.length !== 2/)
  assert.doesNotMatch(code('components/ui/table/PairLedger.jsx'), /Brewers|Rays|teams\.js|TeamLogo|top 15|Outside top/)
  assert.doesNotMatch(code('lib/design/ledger/pairLead.js'), /Brewers|Rays|top 15/)
})

test('PairLedger composes Card, Table and Key; its sheet draws no second frame', () => {
  const s = src('components/ui/table/PairLedger.jsx')
  for (const part of ['Card', 'Table', 'Key', 'Stack', 'Cluster']) assert.match(s, new RegExp(`import \\{ ${part} \\}`))
  const css = stripComments(src('styles/system/ledger/pair-ledger.css'))
  assert.doesNotMatch(css, /box-shadow|border-radius|#[0-9a-f]{3,6}\b/i)
})

test('a leader and a failure each carry text, so neither depends on colour', () => {
  const s = src('components/ui/table/PairLedger.jsx')
  assert.match(s, /sr-only"> \(leads\)/)
  assert.match(s, /sr-only"> \(failed\)/)
  assert.match(s, /aria-hidden="true">\*</)
})
