import { useEffect, useRef, useState } from 'react'

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
export function SealBox({
  children,
  forceRevealed = false,
  onReveal,
  label = 'Tap to reveal inning totals',
}) {
  const [revealed, setRevealed] = useState(false)
  const shown = revealed || forceRevealed

  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal
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
    return (
      <button
        type="button"
        className="sealbox cover"
        onClick={() => {
          tapped.current = true
          setRevealed(true)
        }}
        aria-label={label}
      >
        <span className="cover__lock" aria-hidden="true">
          🔒
        </span>
        <span className="cover__main">Tap to reveal</span>
      </button>
    )
  }

  // Value computed lazily, only now. Nothing above this line put it in the DOM.
  return (
    <div className="statgrid" ref={bodyRef} tabIndex={-1}>
      {children()}
    </div>
  )
}
