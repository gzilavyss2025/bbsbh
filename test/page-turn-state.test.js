// Unit coverage for the React-free core of the page-turn transition
// (src/components/page-turn/pageTurnState.js). These are the invariants that
// keep the animation from ever becoming a second navigation mechanism: only
// a genuinely forward, unlocked destination is eligible, a second tap while
// one is already in flight is dropped rather than stacking, and a stale
// transaction's late-arriving commit can never clobber whatever's since
// taken its place.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isForward,
  isEligibleForCurl,
  shouldAnimateTurn,
  nextTransactionId,
  initialPageTurnState,
  reduce,
} from '../src/components/page-turn/pageTurnState.js'

// --------------------------------------------------------------------------
// isForward / isEligibleForCurl
// --------------------------------------------------------------------------
test('isForward is true only for a strictly later half-index', () => {
  assert.equal(isForward(2, 3), true)
  assert.equal(isForward(3, 2), false)
  assert.equal(isForward(3, 3), false)
})

test('isEligibleForCurl rejects backward and locked destinations', () => {
  assert.equal(isEligibleForCurl({ fromIdx: 2, toIdx: 3, maxIdx: 17 }), true)
  assert.equal(isEligibleForCurl({ fromIdx: 3, toIdx: 2, maxIdx: 17 }), false) // backward
  assert.equal(isEligibleForCurl({ fromIdx: 3, toIdx: 3, maxIdx: 17 }), false) // same half
  assert.equal(isEligibleForCurl({ fromIdx: 2, toIdx: 18, maxIdx: 17 }), false) // locked/extras not unlocked
})

test('isEligibleForCurl allows a multi-half forward jump within what is unlocked', () => {
  assert.equal(isEligibleForCurl({ fromIdx: 0, toIdx: 10, maxIdx: 17 }), true)
})

// --------------------------------------------------------------------------
// shouldAnimateTurn — every requirement is hard, not a preference
// --------------------------------------------------------------------------
test('shouldAnimateTurn is true only when every capability check passes', () => {
  const allGood = {
    eligible: true,
    prefersReducedMotion: false,
    hasWAAPI: true,
    hasResizeObserver: true,
    withinHeightCap: true,
  }
  assert.equal(shouldAnimateTurn(allGood), true)
  assert.equal(shouldAnimateTurn({ ...allGood, eligible: false }), false)
  assert.equal(shouldAnimateTurn({ ...allGood, prefersReducedMotion: true }), false)
  assert.equal(shouldAnimateTurn({ ...allGood, hasWAAPI: false }), false)
  assert.equal(shouldAnimateTurn({ ...allGood, hasResizeObserver: false }), false)
  assert.equal(shouldAnimateTurn({ ...allGood, withinHeightCap: false }), false)
})

// --------------------------------------------------------------------------
// nextTransactionId — monotonic, no Date.now()/Math.random()
// --------------------------------------------------------------------------
test('nextTransactionId always increments by one', () => {
  assert.equal(nextTransactionId(0), 1)
  assert.equal(nextTransactionId(41), 42)
})

// --------------------------------------------------------------------------
// reduce — idle -> preparing -> turning -> idle
// --------------------------------------------------------------------------
test('a forward request from idle opens a new turn', () => {
  const next = reduce(initialPageTurnState, { type: 'REQUEST_FORWARD', toIdx: 5 })
  assert.equal(next.status, 'preparing')
  assert.equal(next.targetIdx, 5)
  assert.equal(next.transactionId, 1)
})

test('START_TURN moves preparing to turning, keeping the same target/transaction', () => {
  const preparing = reduce(initialPageTurnState, { type: 'REQUEST_FORWARD', toIdx: 5 })
  const turning = reduce(preparing, { type: 'START_TURN' })
  assert.equal(turning.status, 'turning')
  assert.equal(turning.targetIdx, 5)
  assert.equal(turning.transactionId, preparing.transactionId)
})

test('START_TURN is a no-op outside preparing', () => {
  assert.deepEqual(reduce(initialPageTurnState, { type: 'START_TURN' }), initialPageTurnState)
})

test('first-request-wins: a second REQUEST_FORWARD while not idle is dropped', () => {
  const first = reduce(initialPageTurnState, { type: 'REQUEST_FORWARD', toIdx: 5 })
  const second = reduce(first, { type: 'REQUEST_FORWARD', toIdx: 9 })
  assert.deepEqual(second, first) // still targeting 5, same transaction
})

test('a matching COMMIT returns to idle and clears the target', () => {
  const preparing = reduce(initialPageTurnState, { type: 'REQUEST_FORWARD', toIdx: 5 })
  const turning = reduce(preparing, { type: 'START_TURN' })
  const committed = reduce(turning, { type: 'COMMIT', transactionId: turning.transactionId })
  assert.equal(committed.status, 'idle')
  assert.equal(committed.targetIdx, null)
})

test('a stale-transaction COMMIT is rejected, leaving the current turn untouched', () => {
  const preparing = reduce(initialPageTurnState, { type: 'REQUEST_FORWARD', toIdx: 5 })
  const turning = reduce(preparing, { type: 'START_TURN' })
  // A commit tagged with an older/foreign transaction id (e.g. a cancelled
  // turn's WAAPI `finished` promise resolving late) must not clear state out
  // from under the turn that's actually still in flight.
  const staleCommitted = reduce(turning, { type: 'COMMIT', transactionId: turning.transactionId - 1 })
  assert.deepEqual(staleCommitted, turning)
})

test('CANCEL always returns to idle regardless of status', () => {
  const preparing = reduce(initialPageTurnState, { type: 'REQUEST_FORWARD', toIdx: 5 })
  const cancelled = reduce(preparing, { type: 'CANCEL' })
  assert.equal(cancelled.status, 'idle')
  assert.equal(cancelled.targetIdx, null)
})

test('after CANCEL, a fresh REQUEST_FORWARD opens a new turn with a new transaction id', () => {
  const preparing = reduce(initialPageTurnState, { type: 'REQUEST_FORWARD', toIdx: 5 })
  const cancelled = reduce(preparing, { type: 'CANCEL' })
  const reopened = reduce(cancelled, { type: 'REQUEST_FORWARD', toIdx: 7 })
  assert.equal(reopened.status, 'preparing')
  assert.equal(reopened.targetIdx, 7)
  assert.equal(reopened.transactionId, preparing.transactionId + 1)
})
