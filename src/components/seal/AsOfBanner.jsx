import { humanDate } from '../../lib/dates.js'
import { useNav } from '../../lib/nav.js'

// Shown atop a player/team/leaders page whenever the URL carries the `?d=&s=`
// as-of cutoff (see lib/route.js) — the page is showing that club or player as
// they stood ENTERING that day, not as they stand now.
//
// The copy used to read "Stats frozen as of {date} to avoid spoiling a game",
// because until 2026-08-06 the cutoff was stamped automatically onto every link
// out of a game and the banner's job was to explain an imposition. It isn't one
// any more: `GameView` no longer injects `?d=`, stats pages open live, and a
// dated URL is now something a reader asked for (or was sent). So this says what
// the page IS rather than apologising for what it is hiding — see ADR-0034's
// "The cutoff is opt-in now".
//
// It is still the only way back to live, which is why it renders on every page
// that honours the cutoff rather than only on the ones reached from a game.
export function AsOfBanner({ asOf }) {
  const navigate = useNav()
  if (!asOf) return null
  // Drops the whole query, cutoff and level hint together. The level hint is
  // only ever a shortcut for the fetch layer — the page re-resolves it from the
  // player or club itself — so losing it costs a request, never an answer.
  const goLive = () => navigate(window.location.pathname, { replace: true })
  return (
    <div className="asof-banner" role="note">
      {/* "entering" is not a flourish — every loader cuts at `dayBefore(asOf)`,
          so these are the numbers this player or club carried INTO that day,
          with nothing from the day itself folded in. */}
      <span className="asof-banner__text">Stats entering {humanDate(asOf)}</span>
      <button type="button" className="asof-banner__btn" onClick={goLive}>
        Show current
      </button>
    </div>
  )
}
