// Unit coverage for src/lib/milestoneCelebrations.js — the Game Log
// milestone shelf's one-shot completion-animation store.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MILESTONE_IDS,
  hasCelebratedMilestone,
  isMilestoneId,
  markMilestoneCelebrated,
  parseMilestoneCelebrations,
  serializeMilestoneCelebrations,
} from '../src/lib/milestoneCelebrations.js'

test('isMilestoneId', () => {
  assert.equal(isMilestoneId('clubs'), true)
  assert.equal(isMilestoneId('parks'), true)
  assert.equal(isMilestoneId('nope'), false)
  assert.equal(isMilestoneId(42), false)
  assert.equal(isMilestoneId(undefined), false)
})

test('parseMilestoneCelebrations: null/malformed collapse to empty', () => {
  assert.deepEqual(parseMilestoneCelebrations(null), {})
  assert.deepEqual(parseMilestoneCelebrations('not json'), {})
  assert.deepEqual(parseMilestoneCelebrations('[]'), {})
  assert.deepEqual(parseMilestoneCelebrations('"a string"'), {})
})

test('parseMilestoneCelebrations: drops unknown ids and non-integer timestamps', () => {
  const raw = JSON.stringify({ clubs: 100, madeup: 200, parks: 'nope', extra: -1 })
  assert.deepEqual(parseMilestoneCelebrations(raw), { clubs: 100 })
})

test('hasCelebratedMilestone', () => {
  assert.equal(hasCelebratedMilestone({ clubs: 100 }, 'clubs'), true)
  assert.equal(hasCelebratedMilestone({ clubs: 100 }, 'parks'), false)
  assert.equal(hasCelebratedMilestone(null, 'clubs'), false)
})

test('markMilestoneCelebrated: records the timestamp for a known id', () => {
  const next = markMilestoneCelebrated({}, 'clubs', 12345)
  assert.deepEqual(next, { clubs: 12345 })
})

test('markMilestoneCelebrated: returns the SAME reference for an unknown id', () => {
  const map = { clubs: 1 }
  const next = markMilestoneCelebrated(map, 'nope', 999)
  assert.equal(next, map)
})

test('markMilestoneCelebrated: returns the SAME reference for an already-celebrated id (no re-write)', () => {
  const map = { clubs: 1 }
  const next = markMilestoneCelebrated(map, 'clubs', 999)
  assert.equal(next, map)
  assert.equal(next.clubs, 1)
})

test('markMilestoneCelebrated: a second, different id adds alongside the first', () => {
  const first = markMilestoneCelebrated({}, 'clubs', 1)
  const second = markMilestoneCelebrated(first, 'parks', 2)
  assert.deepEqual(second, { clubs: 1, parks: 2 })
})

test('serializeMilestoneCelebrations round-trips through parse', () => {
  const map = markMilestoneCelebrated({}, 'clubs', 5)
  const raw = serializeMilestoneCelebrations(map)
  assert.deepEqual(parseMilestoneCelebrations(raw), map)
})

test('MILESTONE_IDS is the closed set clubs+parks', () => {
  assert.deepEqual([...MILESTONE_IDS].sort(), ['clubs', 'parks'])
})
