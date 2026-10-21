import { Fragment } from 'react'
import '../../../../styles/worldseries/glove.css'
import { gloveFigure } from '../../../../lib/postseason/worldseries/scouting/gloveLegs.js'
import { ComparisonFigure, ComparisonLedger, ComparisonLegend, NO_FIGURE } from './ComparisonLedger.jsx'

// GLOVE AND LEGS (#2316): defense and baserunning of the two Series clubs, side by side, on the
// Tale of the tape rows. `rows` is gloveLegsModel's output (never null here). The club that leads a
// measure wears the leader mark; a tie or a missing figure marks nobody and a missing one draws a
// gap. Regular-season club totals: an open surface (ADR-0034), no score. Names no club.
function Val({ r, side }) {
  const v = r[side]
  if (v == null) return NO_FIGURE
  const leads = r.lead === side
  return (
    <ComparisonFigure lead={leads}>
      {gloveFigure(r, v)}
    </ComparisonFigure>
  )
}

export function GloveLegs({ rows, clubIds }) {
  return (
    <ComparisonLedger
      title="Glove and legs"
      note="Defense and baserunning · higher is better"
      clubIds={clubIds}
      measureLabel="Measure"
      className="ww-glove"
      footer={<ComparisonLegend lead="Highlighted figure leads" />}
    >
      {rows.map((r, i) => (
        <Fragment key={r.key}>
          {rows[i - 1]?.group !== r.group && (
            <tr className="ww-glove__group">
              <th scope="colgroup" colSpan={3}>{r.group}</th>
            </tr>
          )}
          <tr className="ww-comparison__row">
            <th scope="row">
              {r.label}
              {r.unit === 'ft/s' && <span className="ww-comparison__unit"> (ft/s)</span>}
            </th>
            <td><Val r={r} side="a" /></td>
            <td><Val r={r} side="b" /></td>
          </tr>
        </Fragment>
      ))}
    </ComparisonLedger>
  )
}
