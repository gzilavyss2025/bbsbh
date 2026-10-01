import { lastAppearanceCells, lastAppearanceHeading } from '../../../lib/pitcherCard/card.js'
import { useRouteLink } from '../../../lib/nav.js'
import { StatGrid } from './SeasonLines.jsx'

// "Last appearance · Tue 9/29 vs PHI · WC Gm 1", the date and opponent linking
// to that game's box score, then his line in the box score's columns. Days of
// rest on the right, for starters only. No decision: in a series, a W or an L
// says how an earlier game ended. A level or year tag when that game was not
// at this game's level or season.
export function LastAppearance({ last, season, sportId, rest }) {
  const routeLink = useRouteLink()
  const { when, round, tag, path } = lastAppearanceHeading(last, season, sportId)
  return (
    <div className="pcard__sec">
      <div className="pcard__lasthead">
        <span className="pcard__lbl pcard__lbl--ink">
          Last appearance · <a className="pcard__gamelink" {...routeLink(path)}>{when}</a>
          {round && ` · ${round}`}
          {tag && ` · ${tag}`}
        </span>
        {rest && <span className="pcard__lbl">{rest}</span>}
      </div>
      <StatGrid cells={lastAppearanceCells(last)} />
    </div>
  )
}
