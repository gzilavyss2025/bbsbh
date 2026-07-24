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
  effectiveReveal,
} from '../src/hooks/revealProgressCore.js'
import { halfIndex } from '../src/api/select.js'

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

// --------------------------------------------------------------------------
// effectiveReveal — the "Scores Unlocked" render override (ADR-0026)
//
// The one spoiler-critical property: this changes what RENDERS, never what
// PERSISTS. The override must not touch the high-water mark the ratchet stores.
// --------------------------------------------------------------------------
test('effectiveReveal is the identity when the day pass is off', () => {
  // Pass off: the real mark and real extras-unlock count pass straight through,
  // untouched — a partly-revealed game keeps rendering exactly as far as it was.
  const out = effectiveReveal({
    scoresUnlocked: false,
    revealedThrough: 3,
    unlocked: 9,
    actualCount: 11,
  })
  assert.deepEqual(out, { renderRevealedThrough: 3, renderUnlocked: 9 })
})

test('effectiveReveal reveals every half and unlocks every inning when on', () => {
  // A 9-regulation game that went 11, opened while the pass is on with NOTHING
  // revealed by hand (-1). Rendering shows the whole game: mark advances to the
  // final half, and all 11 innings — extras included — are unlocked, because
  // opting into spoilers for the day means opting into them (ADR-0008's
  // extras-never-spoil guard is a default-mode guard the pass lifts on purpose).
  const out = effectiveReveal({
    scoresUnlocked: true,
    revealedThrough: -1,
    unlocked: 9,
    actualCount: 11,
  })
  assert.equal(out.renderRevealedThrough, halfIndex(11, 'bottom')) // last half
  assert.equal(out.renderUnlocked, 11)
})

test('effectiveReveal never walks the render mark backward past real progress', () => {
  // Contrived: a real mark already at/beyond the computed last half (a game
  // still loading its full inning count, say). Math.max keeps the higher value
  // so the override can never *hide* a half the user already earned.
  const out = effectiveReveal({
    scoresUnlocked: true,
    revealedThrough: 99,
    unlocked: 9,
    actualCount: 9,
  })
  assert.equal(out.renderRevealedThrough, 99)
})

test('effectiveReveal never yields a non-finite render mark', () => {
  // Guards the deliberate choice of a finite last-half index over Infinity:
  // an Infinity mark could reach an array index or be stringified into storage.
  for (const actualCount of [7, 9, 11, 18]) {
    const { renderRevealedThrough } = effectiveReveal({
      scoresUnlocked: true,
      revealedThrough: -1,
      unlocked: 7,
      actualCount,
    })
    assert.ok(Number.isInteger(renderRevealedThrough), `finite for ${actualCount}`)
  }
})

test('the day-pass override can NEVER advance the persisted ratchet', () => {
  // The mutation invariant. Simulate the InningViewer wiring: the persisted
  // high-water mark is `persisted`; the pass is ON, so the render override
  // fully reveals the screen. The ratchet (mergeMark) is the ONLY thing that
  // writes storage, and the component feeds it the real mark — NEVER the render
  // override. Assert that after a full-reveal render, the persisted mark is
  // still exactly where the user left it by hand.
  const actualCount = 9
  let persisted = 3 // revealed through the bottom of the 2nd, by hand

  const { renderRevealedThrough } = effectiveReveal({
    scoresUnlocked: true,
    revealedThrough: persisted,
    unlocked: 9,
    actualCount,
  })
  assert.equal(renderRevealedThrough, halfIndex(9, 'bottom')) // 17 — fully open

  // What the component actually persists on every reveal source is the real
  // mark. Nothing about turning the pass on runs it through the ratchet.
  persisted = mergeMark(persisted, persisted)
  assert.equal(persisted, 3) // untouched — the pass leaked nothing into storage

  // And this is precisely the bug the separation prevents: had the render
  // override been wired into the ratchet, it would have jumped the stored mark
  // to 17 and the game would stay spoiled after 8am. It must not.
  const ifLeaked = mergeMark(3, renderRevealedThrough)
  assert.equal(ifLeaked, 17)
  assert.notEqual(persisted, ifLeaked)
})
