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
  parseBoxRevealMark,
  mergeMark,
  unlockedInnings,
  effectiveReveal,
  markAfterStep,
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
  assert.deepEqual(parseAtBatMark('4:2'), { halfIdx: 4, count: 2, sub: 0 })
  assert.deepEqual(parseAtBatMark('0:0'), { halfIdx: 0, count: 0, sub: 0 })
})

test('parseAtBatMark falls back to the inert cursor on anything malformed', () => {
  const inert = { halfIdx: -1, count: 0, sub: 0 }
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
// effectiveReveal — the stamped-game render override (ADR-0048)
//
// The one spoiler-critical property: this changes what RENDERS, never what
// PERSISTS. The override must not touch the high-water mark the ratchet stores.
// A stamp says the user was there and already knows how it ended, so
// re-sealing a game they stamped protects them from nothing. Its one input is
// `stamped`: the Scores Unlocked day pass that once shared it is gone
// (ADR-0116).
// --------------------------------------------------------------------------
test('effectiveReveal is the identity when stamped is false', () => {
  // Not stamped: the real mark and real extras-unlock count pass straight
  // through, untouched — a partly-revealed game keeps rendering exactly as far
  // as it was.
  const out = effectiveReveal({
    stamped: false,
    revealedThrough: 3,
    unlocked: 9,
    actualCount: 11,
  })
  assert.deepEqual(out, { renderRevealedThrough: 3, renderUnlocked: 9, commitReveals: true })
})

test('effectiveReveal opens a stamped game', () => {
  // The whole point: a game the user never revealed by hand — and it still
  // renders open, because they stamped it.
  const out = effectiveReveal({
    stamped: true,
    revealedThrough: -1,
    unlocked: 9,
    actualCount: 11,
  })
  assert.equal(out.renderRevealedThrough, halfIndex(11, 'bottom')) // extras included
  assert.equal(out.renderUnlocked, 11)
})

// The other half of the contract — the part a render mark alone cannot
// deliver. A half that renders revealed mounts its SealBox force-revealed, and
// SealBox fires onReveal on ANY transition to shown, flag included, not just a
// tap. A caller still wired to `revealTo` would ratchet the REAL mark for every
// half the reader merely looked at — written to localStorage and cloud-synced
// to every device. Browser-confirmed before the first fix (under the retired
// day pass): opening /top1 wrote `bbsbh:reveal:{gamePk}` = "0". Opening a
// stamped game must persist nothing.
test('effectiveReveal stops committing reveals for a stamped game', () => {
  assert.equal(
    effectiveReveal({ stamped: true, revealedThrough: -1, unlocked: 9, actualCount: 9 })
      .commitReveals,
    false,
  )
  // Unstamped, reveals commit normally — the default path must be untouched.
  assert.equal(
    effectiveReveal({ stamped: false, revealedThrough: -1, unlocked: 9, actualCount: 9 })
      .commitReveals,
    true,
  )
  // Still false for a user who has already revealed by hand: the override
  // suspends RECORDING, it doesn't erase what was recorded — the render mark
  // still covers their real progress via the Math.max.
  assert.equal(
    effectiveReveal({ stamped: true, revealedThrough: 5, unlocked: 9, actualCount: 11 })
      .commitReveals,
    false,
  )
})

// An unstamped game is the default path, and it must be byte-identical to what
// it was before this override existed — `stamped` absent and `stamped: false`
// alike. This is the regression guard: the overwhelming majority of games the
// user opens are unstamped, and they must still seal.
test('effectiveReveal is untouched for an unstamped game', () => {
  const base = { revealedThrough: 3, unlocked: 9, actualCount: 11 }
  const expected = { renderRevealedThrough: 3, renderUnlocked: 9, commitReveals: true }
  assert.deepEqual(effectiveReveal(base), expected)
  assert.deepEqual(effectiveReveal({ ...base, stamped: false }), expected)
})

// The stamp override never walks the render mark BACKWARD. A user who revealed
// further by hand than the override's floor keeps every half they reached.
test('effectiveReveal never walks a stamped game backward past real progress', () => {
  const { renderRevealedThrough } = effectiveReveal({
    stamped: true,
    revealedThrough: 40, // absurdly far — a suspended game resumed, say
    unlocked: 9,
    actualCount: 9,
  })
  assert.equal(renderRevealedThrough, 40)
})

test('effectiveReveal never yields a non-finite render mark', () => {
  // Guards the deliberate choice of a finite last-half index over Infinity:
  // an Infinity mark could reach an array index or be stringified into storage.
  for (const actualCount of [7, 9, 11, 18]) {
    const { renderRevealedThrough } = effectiveReveal({
      stamped: true,
      revealedThrough: -1,
      unlocked: 7,
      actualCount,
    })
    assert.ok(Number.isInteger(renderRevealedThrough), `finite for ${actualCount}`)
  }
})

test('the stamp override can NEVER advance the persisted ratchet', () => {
  // The mutation invariant. Simulate the InningViewer wiring: the persisted
  // high-water mark is `persisted`; the game is stamped, so the render override
  // fully reveals the screen. The ratchet (mergeMark) is the ONLY thing that
  // writes storage, and the component feeds it the real mark — NEVER the render
  // override. Assert that after a full-reveal render, the persisted mark is
  // still exactly where the user left it by hand.
  const actualCount = 9
  let persisted = 3 // revealed through the bottom of the 2nd, by hand

  const { renderRevealedThrough } = effectiveReveal({
    stamped: true,
    revealedThrough: persisted,
    unlocked: 9,
    actualCount,
  })
  assert.equal(renderRevealedThrough, halfIndex(9, 'bottom')) // 17 — fully open

  // What the component actually persists on every reveal source is the real
  // mark. Nothing about a stamp runs it through the ratchet.
  persisted = mergeMark(persisted, persisted)
  assert.equal(persisted, 3) // untouched — the stamp leaked nothing into storage

  // And this is precisely the bug the separation prevents: had the render
  // override been wired into the ratchet, it would have jumped the stored mark
  // to 17 and the game would stay open after an unstamp. It must not.
  const ifLeaked = mergeMark(3, renderRevealedThrough)
  assert.equal(ifLeaked, 17)
  assert.notEqual(persisted, ifLeaked)
})

// --------------------------------------------------------------------------
// parseBoxRevealMark — the box score's own bit (ADR-0049)
//
// One bit per game, stored as the string "1" and nothing else. It says only
// THAT the reader lifted the box score's seal by hand — no half-index, no
// count, nothing a score could be read out of. Everything else reads false,
// which leaves the seal on: the same fail-closed direction parseRevealMark
// collapses to -1 for.
// --------------------------------------------------------------------------
test('parseBoxRevealMark accepts exactly the value it writes', () => {
  assert.equal(parseBoxRevealMark('1'), true)
})

test('parseBoxRevealMark reads anything else as sealed', () => {
  for (const raw of [null, undefined, '', '0', '2', 'true', 'yes', '1 ', ' 1', '01', '{}', 1, true]) {
    assert.equal(parseBoxRevealMark(raw), false, `${JSON.stringify(raw)} must not lift a seal`)
  }
})

// A step inside a half opens every half before it (Gary, 2026-10-27): a reader who jumps to the 4th on a
// fresh device and starts stepping has passed the halves they skipped, so the Due up and the arm open.
test('markAfterStep ratchets the mark to the half before the one being stepped, never back', () => {
  assert.equal(markAfterStep(-1, halfIndex(4, 'top')), halfIndex(3, 'bottom'))
  assert.equal(markAfterStep(-1, 0), -1)
  assert.equal(markAfterStep(9, halfIndex(4, 'top')), 9)
})
