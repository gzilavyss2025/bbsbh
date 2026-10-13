import { Card } from './Card.jsx'

// THE STAT TILE — one label, one big number, one caption, on a stamped Card
// (#1882; docs/player-redesign.md, section 3). The player page's hero row. The
// Card draws the frame and the fill; .stattile (system/stamped/stamped.css)
// is only the inside.
//
//   label    the stat's name ("HR", "AVG · 2026").
//   value    the number, as the caller formats it.
//   caption  one short line under the number ("680 PA"), or nothing.
//   tone     'plain' (the default), 'tint', or 'ink' for the lead tile.
//   stampIn  the tile drops into its shadow as it appears. Stagger a row with
//            --stamp-delay in `style`.
//   className  the caller's namespace, for its place in a row.
//
// Like Card, it computes and fetches nothing. The figure it shows is the
// caller's, so a reveal gate stays where the caller put it.
export function StatTile({ label, value, caption, tone = 'plain', stampIn = false, className = '', style }) {
  return (
    <Card
      as="div"
      frame="stamped"
      body="flush"
      tone={tone}
      stampIn={stampIn}
      className={`stattile ${className}`.trim()}
      style={style}
    >
      <p className="stattile__label">{label}</p>
      <p className="stattile__value">{value}</p>
      {caption != null && caption !== '' && <p className="stattile__caption">{caption}</p>}
    </Card>
  )
}
