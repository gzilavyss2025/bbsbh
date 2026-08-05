import { createPortal } from 'react-dom'

// Renders a `.scrim` dialog into <body> instead of wherever it was declared.
//
// Why any of this is needed: the app's dialog contract leans on `.scrim`
// being `position: fixed; z-index: 100` — comfortably above the fixed page
// chrome (`.pagenav`, z-index 20). That only holds when the scrim lands in
// the ROOT stacking context. A dialog opened from INSIDE a half-inning page
// does not: `.turnscene` (the page-turn scene, index.css) sets `isolation:
// isolate` on purpose, so an in-flight page turn can never paint over the
// floating bar — and the same isolation traps every descendant z-index under
// it, scrims included. `.turnscene__layer--active` also picks up
// `will-change: clip-path` mid-turn, which would additionally re-root a fixed
// child's containing block.
//
// The visible symptom was the highlight sheet (HighlightSheet.jsx): the
// floating Refresh pill and the reveal bar punched straight through the
// middle of the video, and the bottom of the clip — its own scrubber
// included — swallowed taps meant for the player.
//
// Portalling to <body> puts the dialog back in the root stacking context
// without touching `.turnscene`'s deliberate layering. React events still
// travel the React tree, so each dialog's backdrop-tap handler, Escape
// listener, and focus hand-off keep working exactly as written.
//
// Dialogs declared outside a half-inning page (BallparkModal, SiteMenu, …)
// are already in the root stacking context and don't need this — but wrapping
// one is harmless if a component ever moves.
export function ModalPortal({ children }) {
  return createPortal(children, document.body)
}
