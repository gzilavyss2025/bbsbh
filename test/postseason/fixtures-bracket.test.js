import assert from 'node:assert/strict'
import test from 'node:test'
import { deriveBracket } from '../../src/api/postseason/bracket.js'
import { bracket2025, results, skeleton } from './fixtures.js'

test('bracket2025 is the 2025 skeleton and results at one cutoff', () => {
  const cutoff = '2025-10-09'
  assert.deepEqual(bracket2025(cutoff), deriveBracket(skeleton(2025), results(2025), cutoff))
  assert.equal(bracket2025('2025-12-15').champion.abbreviation, 'LAD')
})
