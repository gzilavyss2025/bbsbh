import { isWorldSeriesKind } from '../../lib/worldSeries/calloutKind.js'
import { GameLink } from '../player/GameLink.jsx'

// A season-context call-out line — the leader / streak / situational-record
// fun fact (see api/callout-notes.js), marked off with a small star and the
// kraft-amber seal accent (a World Series note wears the trophy instead). Shared by the play-by-play at-bat card (one note at
// a time, where it fired) and the box score's Insights card (the whole game's
// notes rolled up in one list).
export function CalloutNote({ text, kind, link = null }) {
  return (
    <div className="pbp__callout">
      {isWorldSeriesKind(kind) ? (
        <img className="pbp__calloutmark pbp__calloutmark--ws" src="/brand/world-series-trophy-icon.png" alt="" aria-hidden="true" />
      ) : (
        <span className="pbp__calloutmark" aria-hidden="true">★</span>
      )}
      {link ? (
        <>
          {link.before}
          <GameLink path={link.path}>{link.label}</GameLink>
          {link.after}
        </>
      ) : text}
    </div>
  )
}
