// What useFocusMode (FocusControls.jsx) decides, as plain booleans and counts —
// no feed, no reveal-only module, nothing that can leak (ADR-0001). Pinned by
// test/focus-view.test.js.

// One at-bat at a time unless the reader opened the whole half ("See the
// whole half"). A sealed half is never stacked (ADR-0043's amendment, #1539).
export function focusWindowed(currentSealed, summaryOpen) {
  return currentSealed || !summaryOpen
}

// A half read back: revealed before the reader saw it sealed, and not the half
// the game is in now. It opens on its FIRST at-bat; any other half follows the
// newest (useFocusMode's `step` null).
export function readsBack(sealedSeen, halfLive) {
  return !sealedSeen && !halfLive
}

// The bar's "Next at-bat ›" on a half never seen sealed: a step to take inside
// what is already open. It moves the cursor only, never the reveal mark. A half
// seen sealed keeps its live bar — reveals, then the post-half advance.
export function stepsAhead({ windowed, sealedSeen, cursor, steps }) {
  return windowed && !sealedSeen && cursor < steps - 1
}
