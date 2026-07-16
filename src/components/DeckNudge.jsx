// A quiet "‹ ›" chevron pair for a header row, nudging a horizontally
// swipeable deck by one card via its existing scroll ref — a plain-text
// sibling to the "See all ›" / "‹ Back" chrome already used elsewhere
// (see .tlead__seeall, .inningnav), not a floating overlay button. CSS
// hides it under `@media (hover: hover) and (pointer: fine)` (index.css),
// so touch devices keep the bare swipe gesture; scrollBy on the same
// native-scroll ref means it never fights the deck's own scroll-snap.
export function DeckNudge({ scrollRef, cardStep, label }) {
  const nudge = (dir) => scrollRef.current?.scrollBy({ left: dir * cardStep, behavior: 'smooth' })
  return (
    <span className="decknudge">
      <button
        type="button"
        className="decknudge__btn"
        onClick={() => nudge(-1)}
        aria-label={`Scroll ${label} back`}
      >
        ‹
      </button>
      <button
        type="button"
        className="decknudge__btn"
        onClick={() => nudge(1)}
        aria-label={`Scroll ${label} forward`}
      >
        ›
      </button>
    </span>
  )
}
