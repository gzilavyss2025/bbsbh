import { seasonCells } from '../../../lib/pitcherCard/card.js'
import { SPORT_LABEL } from '../../../lib/teams.js'

// The season row (and, in a postseason game he has already pitched in, the
// postseason row under a thin rule, then his all-time postseason row when it
// covers more games). Seven equal columns, values over labels,
// no row label. The columns follow the role (lib/pitcherCard/card.js). Both
// lines end the day before this game (ADR-0088).
export function SeasonLines({ role, line, post, career, season, debut, sportId }) {
  if (!line || !role) {
    return debut ? (
      <div className="pcard__sec">
        <span className="pcard__lbl pcard__lbl--ink">{SPORT_LABEL[sportId] ?? 'MLB'} debut</span>
      </div>
    ) : null
  }
  return (
    <div className="pcard__sec">
      <StatGrid cells={seasonCells(role, line)} />
      {post && (
        <>
          <div className="pcard__postrule">
            <span className="pcard__lbl pcard__lbl--ink">{season} postseason</span>
          </div>
          <StatGrid cells={seasonCells(role, post, { postseason: true })} />
        </>
      )}
      {career && (
        <>
          <div className="pcard__postrule">
            <span className="pcard__lbl pcard__lbl--ink">All-time postseason</span>
          </div>
          <StatGrid cells={seasonCells(role, career, { postseason: true })} />
        </>
      )}
    </div>
  )
}

// One cell per column, the value over its label. Shared with LastAppearance.
export function StatGrid({ cells }) {
  return (
    <div className="pcard__grid" style={{ '--pcard-cols': cells.length }}>
      {cells.map((c) => (
        <span key={c.label} className="pcard__cell">
          <span className="pcard__val">{c.value}</span>
          <span className="pcard__lbl">{c.label}</span>
        </span>
      ))}
    </div>
  )
}
