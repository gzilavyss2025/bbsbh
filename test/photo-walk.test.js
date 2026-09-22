import assert from 'node:assert/strict'
import test from 'node:test'
import { photoWalkShouldContinue } from '../src/api/gamePhotos.js'

// Issue #1142: a MiLB club's games carry no photographer stills, so the
// Photos rail walked the whole season (~132 content fetches) and drew
// nothing. The empty-batch floor stops the walk after the first batch
// finds nothing for the club.
const base = { total: 132, target: 10, rounds: 0, maxBatches: 6 }

test('the walk starts on a club with games left and nothing found yet', () => {
  assert.equal(photoWalkShouldContinue({ ...base, consumed: 0, found: 0 }), true)
})

test('empty-batch floor: a first batch with no photos stops the walk', () => {
  assert.equal(photoWalkShouldContinue({ ...base, consumed: 8, found: 0, rounds: 1 }), false)
})

test('a club with photos but under the target keeps walking (MLB grow unchanged)', () => {
  assert.equal(photoWalkShouldContinue({ ...base, consumed: 8, found: 4, rounds: 1 }), true)
  assert.equal(photoWalkShouldContinue({ ...base, consumed: 40, found: 9, rounds: 5 }), true)
})

test('the walk stops at the target, the batch cap, or the end of the season', () => {
  assert.equal(photoWalkShouldContinue({ ...base, consumed: 8, found: 10, rounds: 1 }), false)
  assert.equal(photoWalkShouldContinue({ ...base, consumed: 48, found: 3, rounds: 6 }), false)
  assert.equal(photoWalkShouldContinue({ ...base, consumed: 132, found: 3, rounds: 1 }), false)
})

test('a scroll-back grow on a rail that already has photos is not stopped by the floor', () => {
  assert.equal(
    photoWalkShouldContinue({ ...base, consumed: 16, found: 12, target: 22, rounds: 0 }),
    true,
  )
})
