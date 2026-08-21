import { useRef } from 'react'
import { useNav, useLinkScope, nameFromChildren } from '../../lib/nav.js'
import { playerPath } from '../../lib/route.js'
import { useMediaQuery, HOVER_CARD_QUERY } from '../../hooks/useMediaQuery.js'
import { scheduleHoverShow, scheduleHoverHide } from '../../lib/playerHoverStore.js'

// Wraps a player's name (already rendered as children) in a plain, no-underline
// button that navigates to their page. SPOILER-SAFE for the reason that
// matters: it injects no stat or score into the DOM at the link site — the
// player page fetches its own. It carries only the id plus whatever
// `LinkScope` holds, which off a game is the level hint alone; a link out of a
// game no longer stamps an as-of cutoff (ADR-0034's amendment), so a player
// page opened from a lineup card shows current stats, same as from search.
// When `id` is missing (a name selector occasionally lacks one), it
// renders the children as plain text in a same-class span, so the row keeps its
// layout and there's never a dead link. The dotted underline appears only on
// hover/focus (see .plink in index.css) — the scorebook never sprouts web-links.
//
// `ariaLabel` is REQUIRED of a caller whose children are art alone — a
// Headshot and nothing else. `Headshot` carries `aria-hidden` and an empty
// `alt` on purpose (it is decoration beside a name, and announcing the same
// player twice is worse than announcing him once), so a portrait-only link
// with no label announces as a bare "button" with no name at all. Same prop,
// same reason, as TeamLink's — which had it from the start; this one didn't,
// so its logo-only callers had no way to name themselves even if they tried.
// e2e/invariants/accessible-names.spec.js is the guard.
// `name` is what puts the person's name in the address bar rather than a bare
// id (route.js, ADR-0057). It defaults to the children when they are already a
// plain string, which is the ordinary case here — the link IS the name — so
// almost no caller has to say anything. A caller whose children are ART (a
// headshot, a club mark) has no string to borrow and should pass `name`
// explicitly; without it the link still works, just at the bare-id address.
export function PlayerLink({ id, name, className = '', ariaLabel, children }) {
  const navigate = useNav()
  const { asOf, sportId } = useLinkScope()
  const btnRef = useRef(null)
  // Desktop-only (see HOVER_CARD_QUERY's own header): a real mouse, at the
  // app's own "wide" width. Read once per render rather than gating inside
  // the handlers below — the handlers still no-op on a stale `true` from the
  // instant before a resize, since the global card requires an active id it
  // never receives from a query that's already false by then.
  const hoverCapable = useMediaQuery(HOVER_CARD_QUERY)
  if (!id) {
    return <span className={className}>{children}</span>
  }
  const displayName = name ?? nameFromChildren(children)
  const showHoverCard = (opts) => {
    if (!hoverCapable || !btnRef.current) return
    scheduleHoverShow(id, displayName, btnRef.current.getBoundingClientRect(), opts)
  }
  const hideHoverCard = () => {
    if (!hoverCapable) return
    scheduleHoverHide(id)
  }
  return (
    <button
      ref={btnRef}
      type="button"
      className={`plink ${className}`}
      aria-label={ariaLabel}
      onClick={() => navigate(playerPath(id, { name: displayName, d: asOf, s: sportId }))}
      onMouseEnter={() => showHoverCard()}
      onMouseLeave={hideHoverCard}
      onFocus={() => showHoverCard({ immediate: true })}
      onBlur={hideHoverCard}
    >
      {children}
    </button>
  )
}
