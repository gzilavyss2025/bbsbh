// A REVEALED HALF STEPS LIKE A LIVE ONE (issue #1539, ADR-0043's amendment).
//
// Before this, a half already revealed when the reader arrived — a reload, a
// direct link, Scores Unlocked, Stamp In, the reader's own stamp — opened
// STACKED, every card at once, and the bar's "Next at-bat" was gone. These pin
// the three decisions useFocusMode now makes from plain booleans, with no feed
// in reach: windowed until the reader asks for the whole half, a read-back
// half starting on its FIRST at-bat, and the bar stepping only inside what is
// already revealed.
import assert from 'node:assert/strict'
import test from 'node:test'
import { focusWindowed, holdsAdvance, readsBack, stepsAhead } from '../src/components/inning/focus/focusView.js'
import { CLOSE_SEQUENCE_MS, STEP_HOLD_MS } from '../src/components/inning/focus/beats.js'

test('a revealed half is windowed until "See the whole half"', () => {
  assert.equal(focusWindowed(false, false), true)
  assert.equal(focusWindowed(false, true), false)
  // A sealed half is always one at-bat at a time.
  assert.equal(focusWindowed(true, false), true)
  assert.equal(focusWindowed(true, true), true)
})

test('only a half revealed on arrival, and not being played, reads back from at-bat 1', () => {
  assert.equal(readsBack(false, false), true)
  // Sealed when seen (stepping it live, or the post-half hold): follow the newest.
  assert.equal(readsBack(true, false), false)
  // The half the game is in right now, open under the pass: follow the newest.
  assert.equal(readsBack(false, true), false)
})

test('the bar steps a half read back, windowed, until its last at-bat', () => {
  const base = { windowed: true, sealedSeen: false, cursor: 0, steps: 5 }
  assert.equal(stepsAhead(base), true)
  assert.equal(stepsAhead({ ...base, cursor: 3 }), true)
  assert.equal(stepsAhead({ ...base, cursor: 4 }), false)
  // The whole half laid out: nothing to step.
  assert.equal(stepsAhead({ ...base, windowed: false }), false)
  // A sealed half's bar reveals; the post-half hold keeps its advance, even
  // with the cursor paged back (the live loop, unchanged). Both were seen sealed.
  assert.equal(stepsAhead({ ...base, sealedSeen: true }), false)
  // Before PlayByPlay reports a count.
  assert.equal(stepsAhead({ ...base, steps: 0 }), false)
})

test('stepping a half read back onto its last at-bat holds the advance', () => {
  // The bar's "Next at-bat ›" becomes the next-half advance in the same slot,
  // so a fast second tap must not fall through to it.
  assert.equal(holdsAdvance({ next: 4, steps: 5, sealedSeen: false }), true)
  assert.equal(holdsAdvance({ next: 3, steps: 5, sealedSeen: false }), false)
  // A half seen sealed keeps its live bar exactly: no new hold there.
  assert.equal(holdsAdvance({ next: 4, steps: 5, sealedSeen: true }), false)
})

test('the hold after the last at-bat is a short literal', () => {
  assert.ok(STEP_HOLD_MS > 0 && STEP_HOLD_MS < CLOSE_SEQUENCE_MS)
})
