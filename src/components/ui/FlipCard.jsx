// Blackjack-style card flip for a past, Final game: the front is whatever
// spoiler-free content the caller renders (typically an unmodified GameCard);
// the back is only ever computed/fetched once the game has actually been
// revealed.
//
// Fully controlled by `flipped` — a single, page-level "reveal all games"
// action decides when every card turns over (see GameSelect.jsx), not a tap
// on the card itself (tapping a card always navigates to the real game
// instead — the flip is a separate, explicit action, never a side effect of
// browsing). Reveal is still one-directional in effect (the caller only ever
// flips `flipped` false→true, never back), matching SealBox's ADR-0001/0002
// spoiler guarantee: `renderBack` is a render function invoked only while
// `flipped` is true, so the back face's content is genuinely never in the DOM
// before reveal — same guarantee, a 3D transition standing in for the instant
// swap.
//
// `keepBack` is for a card whose back face is NOT a reveal (the player page's Team history badge,
// #2779): the back stays mounted, so both faces share one height and the back does not blank out
// while it turns away. The face turned away is `inert`, so its controls take no focus or tap.
// Never pass it for a card whose back is a spoiler.
export function FlipCard({ flipped, renderFront, renderBack, keepBack = false }) {
  return (
    <div className={`flipcard${flipped ? ' flipcard--flipped' : ''}`}>
      <div className="flipcard__inner">
        <div className="flipcard__face flipcard__face--front" aria-hidden={flipped} inert={keepBack && flipped ? true : undefined}>
          {renderFront()}
        </div>
        <div className="flipcard__face flipcard__face--back" aria-hidden={!flipped} inert={keepBack && !flipped ? true : undefined}>
          {flipped || keepBack ? renderBack() : null}
        </div>
      </div>
    </div>
  )
}
