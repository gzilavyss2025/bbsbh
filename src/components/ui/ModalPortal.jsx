import { createPortal } from 'react-dom'

// Renders a `.scrim` dialog into <body> instead of wherever it was declared.
//
// Why any of this is needed: the app's dialog contract leans on `.scrim`
// being `position: fixed; z-index: 100` — comfortably above the fixed page
// chrome (`.pagenav`, z-index 20). That only holds when the scrim lands in
// the ROOT stacking context. A dialog opened from INSIDE a stacking context
// (the old half-inning page's `.turnscene`, deleted in #2747, set `isolation:
// isolate` so an in-flight page turn could never paint over the floating bar)
// is trapped: the isolation holds every descendant z-index under it, scrims
// included, and a `will-change: clip-path` would also re-root a fixed child's
// containing block.
//
// The visible symptom was the highlight sheet (HighlightSheet.jsx): the
// floating Refresh pill and the reveal bar punched straight through the
// middle of the video, and the bottom of the clip — its own scrubber
// included — swallowed taps meant for the player.
//
// Portalling to <body> puts the dialog back in the root stacking context
// without depending on any ancestor's layering. React events still
// travel the React tree, so each dialog's backdrop-tap handler, Escape
// listener, and focus hand-off keep working exactly as written.
//
// SiteMenu wraps itself too: declared in the slate masthead, iOS Safari sized
// its scrim to the header rather than the viewport. Other dialogs declared
// outside a half-inning page (BallparkModal, …) are already in the root stacking context and don't need this — but wrapping
// one is harmless if a component ever moves.
export function ModalPortal({ children }) {
  return createPortal(children, document.body)
}
