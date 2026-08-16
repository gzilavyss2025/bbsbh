// BOTH HALVES OF THE APP'S MOTION CONTRACT, read at the moment of the gesture.
//
// `data-motion="reduced"` is the in-app preference (My Tally -> Scorebook
// experience -> Motion), applied to <html> by useMotionPreference.js in this
// directory; the media query is the OS setting the app has always followed. A
// reader who asks for less motion at either level means both.
//
// A PLAIN FUNCTION, NOT A HOOK, and that is the point. styles/01-base.css and
// the app's `@media (prefers-reduced-motion: reduce)` blocks already collapse
// every CSS animation to ~0ms, which is enough for anything whose only cost is
// a duration. It is NOT enough for the three things that read this instead:
//
//   • SealBox's tear, which delays the revealed panel's own fade — and a delay
//     is not a duration, so the tear is skipped outright rather than sped up.
//   • Focus mode's denotation hold (components/inning/focus/beats.js), a
//     setTimeout before the scorebook mark prints. A CSS rule cannot reach a
//     JS timer at all; without this check a reduced-motion reader would still
//     wait 180ms per at-bat, forty times a half.
//   • Focus mode's half-close sequence, which additionally holds the bar's
//     forward action for its own length.
//
// Each of those is started BY an event — a tap, a card arriving, a half
// committing — so reading the preference at that instant is exactly right and
// needs no subscription. A hook would re-render its whole tree on a change
// nobody is waiting to see; the innings screen is this app's hottest, and the
// preference changes on a different page.
export function motionIsReduced() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false
  if (document.documentElement.dataset.motion === 'reduced') return true
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}
