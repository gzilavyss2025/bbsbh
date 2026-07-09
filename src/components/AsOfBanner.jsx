import { humanDate } from '../lib/dates.js'
import { useNav } from '../lib/nav.js'

// Shown atop a player/team/leaders page whenever the URL carries the `?d=&s=`
// spoiler-safe cutoff (see lib/route.js) — a link opened from a sealed game.
// Lets the user drop back to live/current stats without hand-editing the URL.
export function AsOfBanner({ asOf }) {
  const navigate = useNav()
  if (!asOf) return null
  const goLive = () => navigate(window.location.pathname, { replace: true })
  return (
    <div className="asof-banner" role="note">
      <span className="asof-banner__text">
        Stats frozen as of {humanDate(asOf)} to avoid spoiling a game
      </span>
      <button type="button" className="asof-banner__btn" onClick={goLive}>
        Go live
      </button>
    </div>
  )
}
