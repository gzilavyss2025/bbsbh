// Unit coverage for the spoiler-gate primitives — the pure math the whole
// reveal invariant rests on. These were previously exercised only by the
// two-gamePk e2e specs; a flipped comparison here would silently widen what's
// shown before a reveal, so the boundary is worth pinning directly.
import assert from 'node:assert/strict'
import test from 'node:test'
import { halfIndex, selectPrePitchChanges } from '../src/api/select.js'
import { safeToShowEntering } from '../src/api/enteringHalf.js'

test('halfIndex is a total order over half-innings, top before bottom', () => {
  assert.equal(halfIndex(1, 'top'), 0)
  assert.equal(halfIndex(1, 'bottom'), 1)
  assert.equal(halfIndex(2, 'top'), 2)
  assert.equal(halfIndex(9, 'bottom'), 17)
  // Extra innings just keep counting — no wraparound at regulation.
  assert.equal(halfIndex(10, 'top'), 18)
  assert.ok(halfIndex(10, 'top') > halfIndex(9, 'bottom'))
})

test('safeToShowEntering allows only up to the user’s own next half', () => {
  // Revealed through the top of the 1st (index 0): the bottom (its next half)
  // is safe; the top of the 2nd (one further out) is not.
  assert.equal(safeToShowEntering(0, 1, 'bottom'), true)
  assert.equal(safeToShowEntering(0, 2, 'top'), false)
  // Nothing revealed yet (-1): only the very first half is the next one.
  assert.equal(safeToShowEntering(-1, 1, 'top'), true)
  assert.equal(safeToShowEntering(-1, 1, 'bottom'), false)
  // Infinity is the already-fully-revealed context (box score inside its seal).
  assert.equal(safeToShowEntering(Infinity, 20, 'bottom'), true)
})

test('selectPrePitchChanges self-gates to the reached half', () => {
  const feed = {
    gameData: {
      players: { ID100: { lastFirstName: 'Doe, John', primaryNumber: '42', pitchHand: { code: 'R' } } },
    },
    liveData: {
      plays: {
        allPlays: [
          {
            about: { inning: 3, halfInning: 'top' },
            playEvents: [
              { isPitch: false, details: { eventType: 'pitching_substitution' }, player: { id: 100 } },
              { isPitch: true },
            ],
          },
        ],
      },
    },
  }

  // halfIndex(3, 'top') === 4, so the change is safe only once revealedThrough
  // reaches 3 (the half becomes the next one to reveal).
  assert.deepEqual(selectPrePitchChanges(feed, 3, 'top', 2), [])
  const atBoundary = selectPrePitchChanges(feed, 3, 'top', 3)
  assert.equal(atBoundary.length, 1)
  assert.equal(atBoundary[0].eventType, 'pitching_substitution')
  // Default (no revealedThrough passed) preserves the pre-existing behavior of
  // every current caller: compute unconditionally.
  assert.equal(selectPrePitchChanges(feed, 3, 'top').length, 1)
})
