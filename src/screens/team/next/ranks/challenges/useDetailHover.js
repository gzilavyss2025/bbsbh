import { useRef } from 'react'
import { HOVER_CARD_QUERY, useMediaQuery } from '../../../../../hooks/useMediaQuery.js'
import { scheduleHoverHide, scheduleHoverShow } from '../../../../../lib/playerHoverStore.js'

// THE ABS CHALLENGES CARD'S HOVER TRIGGER: the same global player hover card
// PlayerLink opens (components/player/PlayerHoverCard.jsx), asked for with this
// card's own figures (`detail`, see challengeDetail.js) in place of the season
// line. The band, the delay, the place and the close on scroll are the card's.
//
// Desktop only, for the reason PlayerLink gives: a real mouse at the app's wide
// width (HOVER_CARD_QUERY). A touch device taps a face to pick it, and the
// picked face's name tab links to the player.
//
// `anchorProps` go on the element the card hangs from (a face, or a row's
// photo): the ref to measure and the mouse handlers. `focusProps` go on whatever
// holds keyboard focus, which may be a wider element (a row), so a keyboard
// reader gets the card too. Both are spread, as PlayerLink spreads its
// `hoverProps`, so a trigger subscribes to nothing and never re-renders on a
// hover.
export function useDetailHover(id, name, detail) {
  const ref = useRef(null)
  const hoverCapable = useMediaQuery(HOVER_CARD_QUERY)
  const show = (opts) => {
    if (!hoverCapable || !ref.current) return
    scheduleHoverShow(id, name, ref.current.getBoundingClientRect(), { ...opts, detail })
  }
  const hide = () => {
    if (hoverCapable) scheduleHoverHide(id)
  }
  return {
    anchorProps: { ref, onMouseEnter: () => show(), onMouseLeave: hide },
    focusProps: { onFocus: () => show({ immediate: true }), onBlur: hide },
  }
}
