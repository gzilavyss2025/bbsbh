// The pure, React-free core of the page-turn transition (see
// InningPageTurn.jsx) — direction/eligibility checks and the tiny state
// machine that sequences a forward navigation into preparing → turning →
// idle. Pulled out of the component so the invariants ("backward and locked
// destinations never animate", "a second forward tap while one is already in
// flight is a no-op", "a stale transaction can never commit") are testable
// without a DOM or a React renderer — same split as
// src/hooks/revealProgressCore.js.

// A destination is only a candidate for the curl if it's strictly ahead of
// where the viewer actually is and still within what's unlocked (extras that
// haven't opened yet, ADR-0008, are simply unreachable — never something to
// animate toward).
export function isForward(fromIdx, toIdx) {
  return toIdx > fromIdx
}

export function isEligibleForCurl({ fromIdx, toIdx, maxIdx }) {
  return isForward(fromIdx, toIdx) && toIdx <= maxIdx
}

// Whether an eligible forward request should actually animate, or fall back
// to the plain immediate commit InningViewer used before this feature
// existed. Every one of these is a hard requirement, not a preference: no
// backside-less flat-CSS fallback, no partial animation — a failing check
// takes the exact same path a locked/backward destination does.
export function shouldAnimateTurn({
  eligible,
  prefersReducedMotion,
  hasWAAPI,
  hasResizeObserver,
  withinHeightCap,
}) {
  return Boolean(
    eligible && !prefersReducedMotion && hasWAAPI && hasResizeObserver && withinHeightCap,
  )
}

// Monotonic counter for tagging each turn — no Date.now()/Math.random(), so
// commits from a stale turn (the user navigated away, or tapped again before
// the first settled) can be told apart from the current one by simple
// inequality rather than by timing.
export function nextTransactionId(current) {
  return current + 1
}

export const initialPageTurnState = { status: 'idle', targetIdx: null, transactionId: 0 }

// idle: nothing in flight, the real InningPage is the only thing rendered.
// preparing: a forward request has been accepted; InningPageTurn is about to
//   mount the preview layer + overlay (or, if shouldAnimateTurn said no, is
//   about to commit immediately instead — see reduce's START_TURN/COMMIT).
// turning: the WAAPI animations are actually running.
//
// First-request-wins: REQUEST_FORWARD is only honored from idle — a second
// tap mid-turn is dropped rather than restarting or queuing, so rapid taps on
// Next can't stack overlapping curls.
export function reduce(state, action) {
  switch (action.type) {
    case 'REQUEST_FORWARD': {
      if (state.status !== 'idle') return state
      return {
        status: 'preparing',
        targetIdx: action.toIdx,
        transactionId: nextTransactionId(state.transactionId),
      }
    }
    case 'START_TURN': {
      if (state.status !== 'preparing') return state
      return { ...state, status: 'turning' }
    }
    case 'COMMIT': {
      // A commit tagged with any transaction but the current one is stale —
      // e.g. a turn that was cancelled and superseded, whose WAAPI
      // `finished` promise resolves late. Ignoring it (rather than clearing
      // state out from under whatever's now in flight) is what makes
      // first-request-wins safe under rapid taps.
      if (action.transactionId !== state.transactionId) return state
      return { status: 'idle', targetIdx: null, transactionId: state.transactionId }
    }
    case 'CANCEL': {
      return { status: 'idle', targetIdx: null, transactionId: state.transactionId }
    }
    default:
      return state
  }
}
