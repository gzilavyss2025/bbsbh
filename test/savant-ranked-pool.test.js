// #3064: the catcher arm pool is counted off the ranked board, before any fillOnly merge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rankedPool } from '../scripts/lib/savant.mjs'

test('rankedPool counts every id the board ranked', () => {
  const ranked = [{ key: 'pop', pct: { 1: 50 } }, { key: 'arm', fillOnly: true, pct: { 1: 90, 2: 40, 3: 10 } }]
  assert.equal(rankedPool(ranked, 'arm'), 3)
})

test('rankedPool is null for a missing or empty board, never 0', () => {
  assert.equal(rankedPool([{ key: 'arm', pct: {} }], 'arm'), null)
  assert.equal(rankedPool([], 'arm'), null)
})
