// Unit coverage for the React-free core of the reveal high-water mark
// (src/hooks/revealProgressCore.js). This is the persistence backbone of the
// spoiler invariant: the mark that says how far the user has revealed, ratcheted
// so it only ever moves forward, read back from localStorage on return, and
// merged from cross-tab storage events. Previously it was exercised only through
// one reload e2e spec; the pure rules are pinned directly here.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  parseRevealMark,
  parseAtBatMark,
  mergeMark,
  unlockedInnings,
} from '../src/hooks/revealProgressCore.js'

// --------------------------------------------------------------------------
// parseRevealMark — a malformed storage value can never over-reveal
// --------------------------------------------------------------------------
test('parseRevealMark accepts a non-negative integer string', () => {
  assert.equal(parseRevealMark('0'), 0)
  assert.equal(parseRevealMark('17'), 17)
})

test('parseRevealMark collapses null / garbage / negative / fractional to -1', () => {
  assert.equal(parseRevealMark(null), -1)
  assert.equal(parseRevealMark(undefined), -1)
  assert.equal(parseRevealMark('abc'), -1)
  assert.equal(parseRevealMark('-1'), -1)
  assert.equal(parseRevealMark('2.5'), -1)
  assert.equal(parseRevealMark('Infinity'), -1)
})

// --------------------------------------------------------------------------
// parseAtBatMark — the "{halfIdx}:{count}" stepping cursor (ADR-0016)
// --------------------------------------------------------------------------
test('parseAtBatMark reads a well-formed cursor', () => {
  assert.deepEqual(parseAtBatMark('4:2'), { halfIdx: 4, count: 2 })
  assert.deepEqual(parseAtBatMark('0:0'), { halfIdx: 0, count: 0 })
})

test('parseAtBatMark falls back to the inert cursor on anything malformed', () => {
  const inert = { halfIdx: -1, count: 0 }
  assert.deepEqual(parseAtBatMark(null), inert)
  assert.deepEqual(parseAtBatMark('x:2'), inert)
  assert.deepEqual(parseAtBatMark('3'), inert) // missing count
  assert.deepEqual(parseAtBatMark('-1:0'), inert)
  assert.deepEqual(parseAtBatMark('3:-1'), inert)
})

// --------------------------------------------------------------------------
// mergeMark — the one ratchet
// --------------------------------------------------------------------------
test('mergeMark only ever moves forward', () => {
  assert.equal(mergeMark(2, 3), 3) // a genuine advance
  assert.equal(mergeMark(3, 2), 3) // a backward push is ignored
  assert.equal(mergeMark(5, 5), 5) // no-op at equality
  assert.equal(mergeMark(-1, 0), 0) // first reveal from "nothing"
})

test('a malformed incoming value can never walk the mark backward', () => {
  // This is exactly the storage-event path: parse then merge. A null/garbage
  // sibling-tab write parses to -1, which the ratchet drops.
  const current = 6
  assert.equal(mergeMark(current, parseRevealMark(null)), 6)
  assert.equal(mergeMark(current, parseRevealMark('nope')), 6)
  assert.equal(mergeMark(current, parseRevealMark('9')), 9) // a real advance still lands
})

// --------------------------------------------------------------------------
// unlockedInnings — extras never spoil (ADR-0008)
// --------------------------------------------------------------------------
test('a regulation game unlocks exactly its regulation innings', () => {
  assert.equal(unlockedInnings(9, 9, -1), 9)
  assert.equal(unlockedInnings(9, 9, 17), 9) // fully revealed, still 9 (no extras exist)
})

test('an extra inning unlocks only once the prior bottom is revealed', () => {
  // A 9-regulation game that went 11. halfIndex(9,'bottom') = 17.
  assert.equal(unlockedInnings(9, 11, 16), 9) // bottom 9 not yet revealed
  assert.equal(unlockedInnings(9, 11, 17), 10) // bottom 9 in → 10th unlocks
  assert.equal(unlockedInnings(9, 11, 18), 10) // top 10 alone doesn't unlock 11
  assert.equal(unlockedInnings(9, 11, 19), 11) // bottom 10 in → 11th unlocks
})

test('unlockedInnings never exceeds the innings the game actually has', () => {
  assert.equal(unlockedInnings(9, 10, 999), 10)
})
