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
export function SealBox({ children, forceRevealed = false, onReveal }) {
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

  if (!shown) {
    return (
      <button
        type="button"
        className="sealbox cover"
        onClick={() => setRevealed(true)}
        aria-label="Tap to reveal inning totals"
      >
        <span className="cover__lock" aria-hidden="true">
          🔒
        </span>
        <span className="cover__main">Tap to reveal</span>
      </button>
    )
  }

  // Value computed lazily, only now. Nothing above this line put it in the DOM.
  return <div className="statgrid">{children()}</div>
}
