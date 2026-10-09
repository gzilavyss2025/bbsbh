import { useEffect, useState } from 'react'

// The one wide step (ADR-0108): below it the app is the phone-first single
// column; at/above it screens widen and split into two columns (see
// styles/25-wide-layout.css and the widths table in tokens/layout.css — keep
// them in sync; check-media-widths reads CSS only, not this file). Exported so
// GameView can swap the two lineup pages for the combined spread at exactly
// the width the CSS starts laying columns.
export const WIDE_QUERY = '(min-width: 740px)'

// The postseason bracket rail's own gate (BracketRail.jsx). The bracket's tree
// is 358px wide, 70 more than the wire rail's column, and beside it the game
// grid's 360px cards need a games column of at least that much — which a
// window just over WIDE_QUERY does not have. Below this, a wide screen keeps
// the bracket's fold above the cards instead.
export const BRACKET_RAIL_QUERY = '(min-width: 1000px)'

// The player hover card's own gate — "desktop" as this app already means it
// (WIDE_QUERY's width) PLUS an actual mouse (hover: hover, pointer: fine), so
// a wide touchscreen tablet — which would otherwise fire a synthetic
// mouseenter on tap with no real "leave" — never triggers a fetch-on-hover.
export const HOVER_CARD_QUERY = '(min-width: 740px) and (hover: hover) and (pointer: fine)'

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mq = window.matchMedia(query)
    const onChange = () => setMatches(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
