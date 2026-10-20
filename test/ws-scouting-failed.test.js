// failedCards: which scouting cards had a load fail (#2316). A failed load is not an empty one.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { failedCards, failedLine } from '../src/lib/postseason/worldseries/scouting/failedCards.js'

const ok = (label, data = { a: 1 }) => ({ label, data, error: null })

test('none failed: no labels, no line', () => {
  assert.deepEqual(failedCards([ok('Film room'), ok('Platoon')]), [])
  assert.equal(failedLine([]), '')
})

test('one failed', () => {
  assert.deepEqual(failedCards([ok('Film room'), { label: 'Platoon', data: null, error: new Error('x') }]), ['Platoon'])
  assert.equal(failedLine(['Platoon']), 'Some cards could not load: Platoon.')
})

test('several failed keep their order', () => {
  const bad = (label) => ({ label, data: null, error: new Error('x') })
  assert.deepEqual(failedCards([bad('Film room'), ok('Park fit'), bad('Platoon')]), ['Film room', 'Platoon'])
  assert.equal(failedLine(['Film room', 'Platoon']), 'Some cards could not load: Film room, Platoon.')
})

test('an empty result is not a failure', () => {
  assert.deepEqual(failedCards([ok('Film room', []), ok('Platoon', null), ok('Park fit', {})]), [])
})

test('a flagged failure (a static file that fell back) counts', () => {
  assert.deepEqual(failedCards([{ label: 'Glove and legs', failed: true }]), ['Glove and legs'])
})

test('a repeated label shows once', () => {
  const bad = { label: 'Matchup edges', error: new Error('x') }
  assert.deepEqual(failedCards([bad, bad]), ['Matchup edges'])
})
