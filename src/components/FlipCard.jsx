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
export function FlipCard({ flipped, renderFront, renderBack }) {
  return (
    <div className={`flipcard${flipped ? ' flipcard--flipped' : ''}`}>
      <div className="flipcard__inner">
        <div className="flipcard__face flipcard__face--front" aria-hidden={flipped}>
          {renderFront()}
        </div>
        <div className="flipcard__face flipcard__face--back" aria-hidden={!flipped}>
          {flipped ? renderBack() : null}
        </div>
      </div>
    </div>
  )
}
