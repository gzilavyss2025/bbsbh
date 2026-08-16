import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { ModalPortal } from './ui/ModalPortal.jsx'
import { sealTearPolygons, sealTearSeed } from '../lib/sealTear.js'
import { motionIsReduced } from '../hooks/preferences/motionIsReduced.js'

// The core spoiler mechanism (see brief §7b — this behavior must not drift).
//
// A sealed value is NEVER in the render tree until reveal. `children` is a
// render function that produces the revealed content; it is only invoked in
// the revealed branch, so before reveal there is no fetched-then-hidden DOM
// node holding a score.
//
// Reveal is one-directional: once revealed it stays revealed (a stray
// double-tap can't flash-and-rehide). Global reveal is driven via
// `forceRevealed`. Re-sealing on inning navigation is handled by the parent
// remounting this component with a fresh key.
// `onReveal` (optional) fires exactly once, the moment this box becomes
// revealed — by tap or by the global flag. It runs after reveal, so anything it
// reads (e.g. this half's linescore, to feed the running line) is still only
// touched post-reveal, honoring the spoiler rule.
// `label` names what the cover hides ("Tap to reveal the box score") — it is
// the sealed button's accessible name, so keep it spoiler-free and specific.
// `coverless`: render NOTHING while sealed instead of the kraft cover button —
// for a surface that reveals from elsewhere (the innings view's bottom-bar
// button). The spoiler guard is unchanged: children are still only invoked once
// revealed, so nothing sealed reaches the DOM; only the tap-target cover is
// dropped. A `coverless` box has no cover, so it has no tear either — see
// SealTear below.
// `gamePk`/`halfIndex` seed the tear path and nothing else. They are identity,
// not game state: passing them tells this component which cover it is drawing,
// never anything about what is under it.
//
// THE TEAR, AND WHY IT DOES NOT TOUCH ANY OF THE ABOVE (ADR-0002).
//
// On a tap the cover tears in half and the two halves peel out of frame. Every
// part of that animation lives on a COPY of the cover — kraft texture, the
// drawn mark, the words "Tap to reveal" — and the cover has never held data.
// The revealed panel still mounts from `children()` in the revealed branch, on
// the same frame it always did, neither earlier nor later.
//
// It is deliberately NOT a cross-fade between cover and panel. A cross-fade
// needs both in the tree at once with the panel fading UP from behind the
// cover, which means rendering the sealed content while the box is still
// sealed — the exact thing ADR-0002 exists to forbid. Here the panel's fade is
// only a delayed start on the animation it already had (`.statgrid--tearing`),
// so the two gestures overlap without the cover ever gating the panel.
//
// Two smaller rules fall out of that, both load-bearing:
//   • The tear only ever runs on a real TAP, never on a `forceRevealed` mount.
//     A force-revealed box never drew a cover, so there is nothing to tear —
//     and Scores Unlocked (ADR-0026) would otherwise flap a torn seal over
//     every half at once.
//   • Under reduced motion nothing tears at all; the panel arrives exactly as
//     it does today. See `motionIsReduced` (hooks/preferences/), which used to
//     be a private copy in this file and is now shared with focus mode's own
//     JS-timed beats (components/inning/focus/beats.js, ADR-0046) — three
//     gestures, one reading of the contract.
export function SealBox({
  children,
  forceRevealed = false,
  onReveal,
  coverless = false,
  label = 'Tap to reveal inning totals',
  gamePk,
  halfIndex,
}) {
  const [revealed, setRevealed] = useState(false)
  const shown = revealed || forceRevealed

  // The in-flight tear, or null. Holds the torn cover's captured screen
  // rectangle and its two clip paths — no reveal state, and nothing that
  // outlives the animation.
  const [tear, setTear] = useState(null)
  // Whether this box tore at all, which — unlike `tear` — is never unset. The
  // panel's delayed fade hangs off this class, and dropping it when the halves
  // finish would re-time an animation still running underneath them, popping
  // the panel to near-full opacity mid-fade. State, not a ref, because it is
  // read while rendering.
  const [torn, setTorn] = useState(false)

  const onRevealRef = useRef(onReveal)
  // Keep the latest callback without re-running the reveal effect below on
  // every render a fresh `onReveal` identity arrives — assigned in a layout
  // effect (not during render) so it's current before that effect reads it.
  useLayoutEffect(() => {
    onRevealRef.current = onReveal
  })
  const fired = useRef(false)
  useEffect(() => {
    if (shown && !fired.current) {
      fired.current = true
      onRevealRef.current?.()
    }
  }, [shown])

  // Keyboard/AT continuity: the tap unmounts the focused cover button, which
  // would silently drop focus to <body>. Hand it to the revealed panel instead
  // — but only on an actual tap, never on a forceRevealed mount (navigating
  // between already-revealed halves must not yank focus to the panel).
  const tapped = useRef(false)
  const bodyRef = useRef(null)
  useEffect(() => {
    if (revealed && tapped.current) bodyRef.current?.focus()
  }, [revealed])

  if (!shown) {
    if (coverless) return null
    return (
      <button
        type="button"
        className="sealbox cover"
        onClick={(e) => {
          tapped.current = true
          // Measured off the live cover, before React drops it: the panel
          // underneath is a different height, so the torn halves have to
          // remember the tape's own box rather than inherit the panel's.
          const box = e.currentTarget.getBoundingClientRect()
          if (box.height > 0 && !motionIsReduced()) {
            setTorn(true)
            setTear({ box, paths: sealTearPolygons(sealTearSeed(gamePk, halfIndex)) })
          }
          setRevealed(true)
        }}
        aria-label={label}
      >
        <CoverFace />
      </button>
    )
  }

  // Value computed lazily, only now. Nothing above this line put it in the DOM.
  return (
    <div
      className={torn ? 'statgrid statgrid--tearing' : 'statgrid'}
      ref={bodyRef}
      tabIndex={-1}
    >
      {children()}
      {tear && <SealTear tear={tear} onDone={() => setTear(null)} />}
    </div>
  )
}

// The cover's face: kraft tape, a drawn seal mark, and the invitation to tap.
// Shared by the live cover and by both torn halves, so the tear splits the
// same object the user was looking at rather than a plain amber rectangle.
// Everything here is a constant — there is no prop to pass it a value, which
// is what keeps a torn half as data-free as the cover it copies.
function CoverFace() {
  return (
    <>
      <span className="cover__lock" aria-hidden="true">
        <LockMark />
      </span>
      <span className="cover__main">Tap to reveal</span>
    </>
  )
}

// The seal mark — a padlock drawn in the scorebook's own ink line, replacing
// the system padlock emoji this used to render. An emoji is a different
// typeface on every device (colour on one, flat glyph on another, a yellow
// cartoon on a third), so it was the one thing on the cover that never matched
// the paper it sat on. Drawn at 1em off `.cover__lock`'s type token and inked
// with `currentColor`, which the cover resolves to `--seal-ink`.
function LockMark() {
  return (
    <svg className="cover__mark" viewBox="0 0 24 24" role="presentation" focusable="false">
      <path d="M8 10.5V7.2a4 4 0 0 1 8 0v3.3" />
      <rect x="4.2" y="10.5" width="15.6" height="9.8" rx="2.4" />
      <path d="M12 14v2.9" />
    </svg>
  )
}

// The two halves of the torn cover, flying off.
//
// Portalled to <body> and positioned from the cover's captured screen
// rectangle. Both of those are for the same reason ModalPortal exists: a seal
// inside a half-inning page sits under `.turnscene`, which sets `isolation:
// isolate` and picks up `will-change: clip-path` mid-turn — either one would
// trap or re-root a fixed child. Out here the halves answer to the viewport
// alone, and the revealed panel's own box is left completely untouched: no
// wrapper, no positioning context, and no shared opacity (the panel fades in on
// its own animation, and a child of it would have faded with it).
//
// `onDone` fires on the first half to finish and unmounts the pair. The
// duration lives in the CSS alone — see `--dur-tear`.
function SealTear({ tear, onDone }) {
  const { box, paths } = tear
  return (
    <ModalPortal>
      <div
        className="sealtear"
        aria-hidden="true"
        onAnimationEnd={onDone}
        style={{
          top: `${box.top}px`,
          left: `${box.left}px`,
          width: `${box.width}px`,
          height: `${box.height}px`,
        }}
      >
        <span className="sealtear__half sealtear__half--top" style={{ clipPath: paths.top }}>
          <span className="sealtear__face">
            <CoverFace />
          </span>
        </span>
        <span className="sealtear__half sealtear__half--bottom" style={{ clipPath: paths.bottom }}>
          <span className="sealtear__face">
            <CoverFace />
          </span>
        </span>
      </div>
    </ModalPortal>
  )
}

// (`wantsReducedMotion` lived here. It is `motionIsReduced` in
// hooks/preferences/ now — same two reads, same reason, shared with focus
// mode's JS-timed beats so one gesture's answer cannot drift from another's.)
