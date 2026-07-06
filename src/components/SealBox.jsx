import { useState } from 'react'

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
export function SealBox({ children, forceRevealed = false }) {
  const [revealed, setRevealed] = useState(false)

  if (!revealed && !forceRevealed) {
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
        <span className="cover__sub">Covered so you don’t get spoiled</span>
      </button>
    )
  }

  // Value computed lazily, only now. Nothing above this line put it in the DOM.
  return <div className="statgrid">{children()}</div>
}
