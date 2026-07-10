import { useState } from 'react'

// Blackjack-style card flip for a past, Final game: the front is whatever
// spoiler-free content the caller renders (typically an unmodified GameCard);
// the back is only ever computed/fetched once the user actually flips it.
//
// Two bits of state, deliberately separate:
//   `revealed` — one-directional, exactly like SealBox's reveal (see
//     ADR-0001/0002): flips true on the first tap and never resets, gating
//     whether the back face's render function has ever been invoked at all.
//     `onReveal` fires exactly once, the moment this happens — the caller's
//     hook for kicking off the back face's fetch, so nothing is fetched for a
//     card nobody ever flips.
//   `showingBack` — freely toggles once revealed. Unlike a SealBox, a flip is
//     naturally bidirectional: flipping back to the front doesn't need to
//     forbid flipping again, so this isn't folded into the reveal itself.
//
// `renderFront`/`renderBack` are render functions (not elements) so the back
// face's content is genuinely never in the DOM before reveal — same spoiler
// guarantee as SealBox's `children` render-function pattern, just with a 3D
// transition standing in for the instant swap.
export function FlipCard({ renderFront, renderBack, onReveal }) {
  const [revealed, setRevealed] = useState(false)
  const [showingBack, setShowingBack] = useState(false)

  const flipToBack = () => {
    if (!revealed) {
      setRevealed(true)
      onReveal?.()
    }
    setShowingBack(true)
  }
  const flipToFront = () => setShowingBack(false)

  return (
    <div className={`flipcard${showingBack ? ' flipcard--flipped' : ''}`}>
      <div className="flipcard__inner">
        <div className="flipcard__face flipcard__face--front" aria-hidden={showingBack}>
          {renderFront({ flip: flipToBack })}
        </div>
        <div className="flipcard__face flipcard__face--back" aria-hidden={!showingBack}>
          {revealed ? renderBack({ flipBack: flipToFront }) : null}
        </div>
      </div>
    </div>
  )
}
