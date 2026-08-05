import { useCallback, useEffect, useState } from 'react'
import { useMediaQuery } from '../../hooks/useMediaQuery.js'

// The turn state of the passport book (PassportBook.jsx) — which spread is
// open, and whether a leaf is mid-flip.
//
// ===========================================================================
// Why this is NOT src/components/page-turn/
// ===========================================================================
// The app already has a page-turn transition (InningPageTurn.jsx, ADR-0024)
// and it was the first thing considered here. It doesn't fit a book, for
// three structural reasons rather than cosmetic ones:
//
//   1. It is forward-only by design. `isForward`/`isEligibleForCurl` in
//      pageTurnState.js exist because an inning you have not revealed is
//      unreachable (ADR-0008), so "backward" there means "no animation".
//      A book turns back as often as forward, and the backward turn is the
//      same physical motion played the other way — not a fallback.
//   2. Its whole reason for the preview layer is the spoiler rule: it mounts
//      real, possibly-still-sealed destination content underneath the
//      outgoing half and mutes its callbacks (`presentationOnly`) so a
//      preview can't ratchet `revealedThrough`. A passport page has nothing
//      sealed on it — every stamp on it is a game this user already finished
//      revealing (ADR-0035) — so that machinery is cost without a job.
//   3. It animates a clip-path wipe plus a decorative SVG curl on a
//      full-width, variable-height column. A book leaf is a fixed-aspect
//      panel hinged at the spine with a front and a back face, which is a
//      rotateY in a perspective scene, not a wipe.
//
// So: a new, much smaller hook, but deliberately built on the same three
// disciplines that file established — check `prefers-reduced-motion` in JS
// (not only in CSS), tag each turn with a monotonic id so a late settle from
// a superseded turn can't clear the current one, and leave no timer running
// past unmount.
//
// ===========================================================================
// The model: navigation commits FIRST, the leaf is the echo
// ===========================================================================
// `spread` moves to the destination the instant a turn is requested, and the
// leaf that animates carries the spread we just LEFT (`from`). The live DOM
// is therefore always the page the user is actually on — an interrupted,
// backgrounded, or unmounted turn can never strand the book on the wrong
// page, the leaf just stops. (InningPageTurn commits at the END of its turn
// because it must not advance the reveal mark early; nothing here has a
// reveal mark to advance.)

// The turn is driven by a CSS animation (see .passportbook__leaf), so the
// component reports completion via `onAnimationEnd` and this hook needs no
// timer of its own for the normal path. This backstop covers the paths where
// that event never arrives — the leaf is inside a `content-visibility` skip,
// the tab is hidden when the animation would have run, a browser drops the
// event on an interrupted compositor animation. Deliberately far longer than
// --dur-flip (450ms) so it can never pre-empt a real turn and cut it short.
const TURN_SAFETY_MS = 1200

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

const clamp = (n, lo, hi) => (n < lo ? lo : n > hi ? hi : n)

// `spreadCount` is how many openings the book has (PassportBook decides what
// an opening is — one page on a phone, two side by side on a desktop, plus
// the cover). `initial` is the opening to start on; the caller passes 0 for
// "closed, showing the cover".
export function usePageTurn({ spreadCount, initial = 0 } = {}) {
  // index.css's blanket reduced-motion rule collapses every animation to
  // ~0ms, which would make the leaf mount and unmount in the same frame —
  // harmless but pointless work, and it still paints a duplicate of the page
  // for one frame. Checking here means the leaf is never created at all.
  const prefersReducedMotion = useMediaQuery(REDUCED_MOTION_QUERY)

  const [state, setState] = useState(() => ({
    spread: Math.max(0, Math.trunc(initial) || 0),
    from: null,
    direction: null,
    turnId: 0,
  }))

  const maxSpread = Math.max(0, (Math.trunc(spreadCount) || 1) - 1)

  // Clamped at READ time rather than reconciled in an effect: the book's
  // opening count changes when the layout crosses the two-page breakpoint (a
  // rotation, a window drag), and an effect that chased it would render one
  // frame of an out-of-range spread first.
  const spread = clamp(state.spread, 0, maxSpread)

  // A leaf is in flight only if its source opening still exists AND motion is
  // still wanted. Both are DERIVED rather than pushed into state by an effect:
  // an opening that vanished under a re-layout has nothing truthful left to
  // show, and reduced motion switching on mid-flip (a system setting change,
  // an OS low-power mode) should stop the sheet now, not let the one animation
  // already running play out. The safety timer below is what tidies the state
  // itself afterwards.
  const from =
    prefersReducedMotion || state.from == null || state.from > maxSpread ? null : state.from

  const turnTo = useCallback(
    (target) => {
      setState((prev) => {
        const wanted = Number.isFinite(target) ? Math.trunc(target) : 0
        const to = clamp(wanted, 0, maxSpread)
        const current = clamp(prev.spread, 0, maxSpread)
        // "Must not animate when the target equals the current page" — and not
        // just skip the animation: return the SAME state object, so a stray
        // repeat call can't even cause a re-render, let alone restart a leaf
        // that is already in flight. This is also what makes Next on the last
        // opening (and Back on the cover) inert rather than a stutter.
        if (to === current) return prev
        if (prefersReducedMotion) {
          return { spread: to, from: null, direction: null, turnId: prev.turnId }
        }
        return {
          spread: to,
          from: current,
          direction: to > current ? 'forward' : 'back',
          // Bumped on every accepted turn. The component keys the leaf on this
          // so a second turn taken mid-flight remounts (and so replays) the CSS
          // animation from the top instead of continuing the old one, and
          // `settle` uses it to ignore a late completion from a turn that has
          // already been superseded.
          turnId: prev.turnId + 1,
        }
      })
    },
    [maxSpread, prefersReducedMotion],
  )

  const next = useCallback(() => turnTo(spread + 1), [turnTo, spread])
  const prev = useCallback(() => turnTo(spread - 1), [turnTo, spread])

  // End of the animation: drop the leaf. Ignores a completion tagged with any
  // turn but the current one.
  const settle = useCallback((turnId) => {
    setState((prev) => {
      if (prev.from == null) return prev
      if (turnId != null && turnId !== prev.turnId) return prev
      return { ...prev, from: null, direction: null }
    })
  }, [])

  // The backstop described at TURN_SAFETY_MS. Re-armed per turn (keyed on
  // turnId) and cleared by the cleanup on settle, on the next turn, and on
  // unmount — there is no path where a timer outlives this hook. It is also
  // what clears the state behind a leaf that was DERIVED away above (its
  // opening vanished, or reduced motion came on): that leaf is unmounted, so
  // its animationend will never arrive.
  useEffect(() => {
    if (state.from == null) return undefined
    const id = setTimeout(() => settle(state.turnId), TURN_SAFETY_MS)
    return () => clearTimeout(id)
  }, [state.from, state.turnId, settle])

  return {
    spread,
    // The opening being turned away from, or null when nothing is in flight.
    from,
    direction: from == null ? null : state.direction,
    turnId: state.turnId,
    turning: from != null,
    canPrev: spread > 0,
    canNext: spread < maxSpread,
    turnTo,
    next,
    prev,
    settle,
  }
}
