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
  assert.deepEqual(out, { renderRevealedThrough: 3, renderUnlocked: 9, commitReveals: true })
})

// The other half of the pass's contract — the part a render mark alone cannot
// deliver. A half that renders revealed mounts its SealBox force-revealed, and
// SealBox fires onReveal on ANY transition to shown, flag included, not just a
// tap. If the caller keeps wiring that to `revealTo` while the pass is on, then
// merely LOOKING at a half ratchets the real mark — persisted, and cloud-synced
// to every signed-in device — which is exactly what ADR-0026 says can never
// happen. Browser-confirmed before the fix: opening /top1 under an active pass
// wrote `bbsbh:reveal:{gamePk}` = "0".
test('effectiveReveal stops committing reveals while the pass is on', () => {
  assert.equal(
    effectiveReveal({ scoresUnlocked: true, revealedThrough: -1, unlocked: 9, actualCount: 9 })
      .commitReveals,
    false,
  )
  // Off, reveals commit normally — the default path must be untouched.
  assert.equal(
    effectiveReveal({ scoresUnlocked: false, revealedThrough: -1, unlocked: 9, actualCount: 9 })
      .commitReveals,
    true,
  )
  // Still false for a user who has already revealed by hand: the pass suspends
  // RECORDING, it doesn't erase what was recorded — the render mark still covers
  // their real progress via the Math.max above.
  assert.equal(
    effectiveReveal({ scoresUnlocked: true, revealedThrough: 5, unlocked: 9, actualCount: 11 })
      .commitReveals,
    false,
  )
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

// --------------------------------------------------------------------------
// effectiveReveal — the stamped-game render override (ADR-0048)
//
// The THIRD departure inside the spoiler rule's scope, and it rides the same
// seam as the day pass for the same reason: a stamp says the user was there
// and already knows how it ended, so re-sealing a game they stamped protects
// them from nothing. Same contract as ADR-0026's pass — RENDER only, never a
// byte into the ratchet.
// --------------------------------------------------------------------------
test('effectiveReveal opens a stamped game with the day pass off', () => {
  // The whole point: no pass, no consented day, a game the user never revealed
  // by hand — and it still renders open, because they stamped it.
  const out = effectiveReveal({
    scoresUnlocked: false,
    stamped: true,
    revealedThrough: -1,
    unlocked: 9,
    actualCount: 11,
  })
  assert.equal(out.renderRevealedThrough, halfIndex(11, 'bottom')) // extras included
  assert.equal(out.renderUnlocked, 11)
})

// The ADR-0026 trap, inherited. A stamp unlock is a new force-reveal source,
// so it owes the same answer: a half that renders revealed mounts its SealBox
// force-revealed, SealBox fires onReveal on any transition to shown, and a
// caller still wired to `revealTo` would ratchet the REAL mark for every half
// the reader merely looked at — written to localStorage and cloud-synced to
// every device. Opening a stamped game must persist nothing.
test('effectiveReveal stops committing reveals for a stamped game', () => {
  assert.equal(
    effectiveReveal({ scoresUnlocked: false, stamped: true, revealedThrough: -1, unlocked: 9, actualCount: 9 })
      .commitReveals,
    false,
  )
})

// An unstamped game is the default path, and it must be byte-identical to what
// it was before this override existed — `stamped` absent and `stamped: false`
// alike. This is the regression guard: the overwhelming majority of games the
// user opens are unstamped, and they must still seal.
test('effectiveReveal is untouched for an unstamped game', () => {
  const base = { scoresUnlocked: false, revealedThrough: 3, unlocked: 9, actualCount: 11 }
  const expected = { renderRevealedThrough: 3, renderUnlocked: 9, commitReveals: true }
  assert.deepEqual(effectiveReveal(base), expected)
  assert.deepEqual(effectiveReveal({ ...base, stamped: false }), expected)
})

// The two overrides are independent inputs to one branch: either alone opens
// the game, and neither cancels the other.
test('effectiveReveal treats the pass and the stamp as independent openers', () => {
  const base = { revealedThrough: -1, unlocked: 9, actualCount: 9 }
  const open = { renderRevealedThrough: halfIndex(9, 'bottom'), renderUnlocked: 9, commitReveals: false }
  assert.deepEqual(effectiveReveal({ ...base, scoresUnlocked: true, stamped: false }), open)
  assert.deepEqual(effectiveReveal({ ...base, scoresUnlocked: false, stamped: true }), open)
  assert.deepEqual(effectiveReveal({ ...base, scoresUnlocked: true, stamped: true }), open)
})

// The stamp override never walks the render mark BACKWARD. A user who revealed
// further by hand than the override's floor keeps every half they reached.
test('effectiveReveal never walks a stamped game backward past real progress', () => {
  const { renderRevealedThrough } = effectiveReveal({
    scoresUnlocked: false,
    stamped: true,
    revealedThrough: 40, // absurdly far — a suspended game resumed, say
    unlocked: 9,
    actualCount: 9,
  })
  assert.equal(renderRevealedThrough, 40)
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
