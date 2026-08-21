// Pure viewport geometry for the player hover card — kept out of the
// component so the clamp/flip math is checkable without a DOM (same reason
// playDiamondGeometry.js and passportLayout.js are their own files: "a
// component that types a coordinate has put it somewhere nothing can
// check").

export const CARD_WIDTH = 300
export const VIEWPORT_MARGIN = 10
const TRIGGER_GAP = 10
const LEFT_NUDGE = 18 // the card sits slightly left of the trigger's own edge, matching the caret's offset in its CSS
const ESTIMATED_CARD_HEIGHT = 210 // a card with the level/rehab pill line — the taller of the two shapes

// `rect` is the trigger's own getBoundingClientRect(); `viewport` is
// {width, height} (window.innerWidth/innerHeight in the real caller — passed
// in rather than read here so this stays pure and testable). Returns fixed
// -position CSS: clamped horizontally so the 300px card never runs past
// either viewport edge, and flipped ABOVE the trigger when there isn't room
// below but there is above.
export function playerHoverCardPosition(rect, viewport) {
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.left - LEFT_NUDGE, viewport.width - CARD_WIDTH - VIEWPORT_MARGIN),
  )
  const below = rect.bottom + TRIGGER_GAP
  const fitsBelow = below + ESTIMATED_CARD_HEIGHT <= viewport.height - VIEWPORT_MARGIN
  const above = rect.top - TRIGGER_GAP - ESTIMATED_CARD_HEIGHT
  const flipUp = !fitsBelow && above >= VIEWPORT_MARGIN
  const top = Math.max(VIEWPORT_MARGIN, flipUp ? above : below)
  return { left, top, flipped: flipUp }
}
