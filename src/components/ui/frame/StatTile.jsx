import { ordinal } from '../../../lib/format.js'
import { statTileClassName } from '../../../lib/design/report/classes.js'
import { Card } from './Card.jsx'

// THE STAT TILE — one label, one big number, one caption, on a stamped Card
// (#1882; docs/player-redesign.md, section 3). The player page's hero row. The
// Card draws the frame and the fill; .stattile (system/stamped/stamped.css)
// is only the inside.
//
//   label    the stat's name ("HR", "AVG · 2026").
//   value    the number, as the caller formats it.
//   caption  one short line under the number ("680 PA"), or nothing.
//   rank     { rank, of? } for a league rank under the caption, or nothing (RankMark).
//   tone     'plain' (the default), 'tint', 'soft' (the graphite offset shadow, for a
//            small tile) or 'ink' for the lead tile.
//   look     'default', or 'band' (ADR-0112): the label rides an ink column head and
//            the figure is mono below it. The report pages' one tile. For three or
//            four figures that read together, use StatStrip instead.
//   lead     look="band" only: the lead tile of a row. One per row, at most.
//   stampIn  the tile drops into its shadow as it appears. Stagger a row with
//            --stamp-delay in `style`.
//   className  the caller's namespace, for its place in a row.
//
// Like Card, it computes and fetches nothing. The figure it shows is the
// caller's, so a reveal gate stays where the caller put it.
export function StatTile({ label, value, caption, rank, tone = 'plain', look = 'default', lead = false, stampIn = false, className = '', style }) {
  return (
    <Card
      as="div"
      frame="stamped"
      body="flush"
      tone={tone}
      stampIn={stampIn}
      className={statTileClassName({ look, lead, className })}
      style={style}
    >
      <p className="stattile__label">{label}</p>
      <p className="stattile__value">{value}</p>
      {caption != null && caption !== '' && <p className="stattile__caption">{caption}</p>}
      {rank && <RankMark rank={rank.rank} of={rank.of} />}
    </Card>
  )
}

// THE RANK MARK — "2 of 68" (a rate stat) or "6th" (a counting stat, no `of`) on its own line, no "#" (#1856). It draws only the text it is
// given, so a player with no rank passes none and leaves no gap. Styled once, in
// system/stamped/stamped.css; the tile is its first host.
function RankMark({ rank, of }) {
  return <p className="rankmark">{of ? `${rank} of ${of}` : ordinal(rank)}</p>
}
