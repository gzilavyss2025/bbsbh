// Unit coverage for selectSkippedBottomHalf and selectFinalHalfIndex
// (src/api/select.js) — two structural, isFinal-gated facts read straight off
// the linescore's per-half `runs` key PRESENCE, never its value.
//
// selectSkippedBottomHalf detects a home half that was never played because
// the away team made the last out with the game already decided (the common
// "walk-off that wasn't needed": home team already ahead entering what
// would've been the bottom of the last inning). Verified live: gamePk 824893
// (SD @ ATL), Final, inning 9's linescore entry carries a `home` object with
// hits/errors/leftOnBase but no `runs` key at all — the feed's own way of
// saying "never batted."
//
// selectFinalHalfIndex answers the companion question for the WHOLE game: the
// half-index of the last half actually played, scanning for the last row
// carrying a `runs` key on either side rather than trusting `innings.length`
// (which the live feed pads out to scheduledInnings).
import assert from 'node:assert/strict'
import test from 'node:test'
import { selectSkippedBottomHalf, selectFinalHalfIndex, halfIndex } from '../src/api/select.js'

function feedWithInning9Home(finalStatus, homeInning9) {
  return {
    gameData: { status: { abstractGameState: finalStatus } },
    liveData: {
      linescore: {
        innings: [
          { num: 8, home: { runs: 1, hits: 3, errors: 0, leftOnBase: 1 } },
          { num: 9, home: homeInning9, away: { runs: 0, hits: 2, errors: 0, leftOnBase: 2 } },
        ],
      },
    },
  }
}

test('true for a completed game whose last inning has no home runs field at all', () => {
  const feed = feedWithInning9Home('Final', { hits: 0, errors: 0, leftOnBase: 0 })
  assert.equal(selectSkippedBottomHalf(feed, 9), true)
})

test('false for a completed game whose last inning WAS played (runs: 0 present)', () => {
  const feed = feedWithInning9Home('Final', { runs: 0, hits: 0, errors: 0, leftOnBase: 0 })
  assert.equal(selectSkippedBottomHalf(feed, 9), false)
})

test('false while the game is still Live, even with no runs field yet — not decided', () => {
  // Same shape as the true-positive case above, but the game hasn't ended —
  // the home team just hasn't batted YET, which must never read as "skipped."
  const feed = feedWithInning9Home('Live', { hits: 0, errors: 0, leftOnBase: 0 })
  assert.equal(selectSkippedBottomHalf(feed, 9), false)
})

test('false for an inning with no linescore entry at all', () => {
  const feed = feedWithInning9Home('Final', { runs: 2, hits: 1, errors: 0, leftOnBase: 0 })
  assert.equal(selectSkippedBottomHalf(feed, 12), false)
})

// --------------------------------------------------------------------------
// selectFinalHalfIndex
// --------------------------------------------------------------------------

test('null while the game is still Live, even with a full-looking linescore', () => {
  const feed = feedWithInning9Home('Live', { runs: 3, hits: 1, errors: 0, leftOnBase: 0 })
  assert.equal(selectFinalHalfIndex(feed), null)
})

test('bottom of the last played inning when the home team batted', () => {
  const feed = feedWithInning9Home('Final', { runs: 0, hits: 0, errors: 0, leftOnBase: 0 })
  assert.equal(selectFinalHalfIndex(feed), halfIndex(9, 'bottom'))
})

test('top of the last played inning when the bottom was skipped (walk-off not needed)', () => {
  const feed = feedWithInning9Home('Final', { hits: 0, errors: 0, leftOnBase: 0 })
  assert.equal(selectFinalHalfIndex(feed), halfIndex(9, 'top'))
})

test('ignores scheduledInnings padding past the last row anyone actually batted in', () => {
  // A rain-shortened game: the live feed pads its linescore array out to
  // scheduledInnings with empty rows carrying no `runs` on either side.
  const feed = {
    gameData: { status: { abstractGameState: 'Final' } },
    liveData: {
      linescore: {
        innings: [
          { num: 1, home: { runs: 1 }, away: { runs: 0 } },
          { num: 2, home: {}, away: {} },
          { num: 3, home: {}, away: {} },
        ],
      },
    },
  }
  assert.equal(selectFinalHalfIndex(feed), halfIndex(1, 'bottom'))
})

test('null when the feed carries no innings at all', () => {
  assert.equal(selectFinalHalfIndex({ gameData: { status: { abstractGameState: 'Final' } } }), null)
})
