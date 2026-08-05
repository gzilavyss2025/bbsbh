import { TeamTreatmentMark } from '../logo/TeamTreatmentMark.jsx'
import { BaseState } from '../scoring/BaseState.jsx'

// The persistent scorebug HUD (see docs/scorebug-spec.html for the visual
// target this was built from). Pure presentational — no feed access, no
// selector imports — every value arrives as a fully-resolved, already
// reveal-gated prop, the same discipline RollingLine.jsx keeps. The caller
// (InningViewer.jsx) owns deciding WHETHER to mount this at all (the
// `revealed || isNextToReveal` gate that keeps a jumped-to sealed half from
// ever reaching this component).
//
// `batter`/`pitcher` are both null between a half ending (3rd out) and the
// user actually navigating to the next one — nobody's "up" and nobody's
// "on the mound" in that gap, so both rows disappear rather than show stale
// or blank content; `inning`/`half` already point at what's coming next.
export function Scorebug({
  awayName,
  homeName,
  awayTeamId,
  homeTeamId,
  awayTreatment,
  homeTreatment,
  awayRuns = 0,
  homeRuns = 0,
  inning,
  half, // 'top' | 'bottom'
  batter, // { order, last, line } | null
  pitcher, // { last, pitches } | null
  bases,
  outs = 0,
  className = '',
}) {
  const top = half === 'top'
  // Between innings (see the doc above) there's no batter/pitcher row left
  // to anchor the card's own top padding/rounding to — `gamehud--blank` lets
  // the strip itself flow all the way to the top edge instead of leaving a
  // bare padded gap above it.
  const blank = !batter && !pitcher
  return (
    <div className={`gamehud ${blank ? 'gamehud--blank' : ''} ${className}`}>
      {batter && (
        <div className="gamehud__row gamehud__row--batter">
          <span className="gamehud__who">{`${batter.order}. ${batter.last}`}</span>
          <span className="gamehud__val">{batter.line ?? '—'}</span>
        </div>
      )}
      {pitcher && (
        <div className="gamehud__row gamehud__row--pitcher">
          <span className="gamehud__who">{pitcher.last}</span>
          <span className="gamehud__val">
            <span className="gamehud__lbl">P:</span>
            {pitcher.pitches}
          </span>
        </div>
      )}
      <div className="gamehud__strip">
        <div className="gamehud__marks">
          <TeamTreatmentMark
            teamId={awayTeamId}
            name={awayName}
            treatment={awayTreatment}
            side="away"
            size={24}
            block="gamehud__tile"
            className="gamehud__tile--away"
          />
          <span className="gamehud__runs">{awayRuns}</span>
          <TeamTreatmentMark
            teamId={homeTeamId}
            name={homeName}
            treatment={homeTreatment}
            side="home"
            size={24}
            block="gamehud__tile"
            className="gamehud__tile--home"
          />
          <span className="gamehud__runs">{homeRuns}</span>
        </div>
        <div className="gamehud__div" />
        <div className="gamehud__inninghalf">
          <span className={`gamehud__tri gamehud__tri--up ${top ? '' : 'gamehud__tri--dim'}`} />
          <span className="gamehud__innnum">{inning}</span>
          <span className={`gamehud__tri gamehud__tri--down ${top ? 'gamehud__tri--dim' : ''}`} />
        </div>
        <div className="gamehud__div" />
        <div className="gamehud__diamondwrap">
          <BaseState bases={bases} size={40} />
          <div className="gamehud__outs">
            {/* Only 2 dots: a half ends the instant the 3rd out happens, so
                outs is always 0/1/2 by the time this renders — a 3rd dot
                could never light up. */}
            {[0, 1].map((i) => (
              <span key={i} className={`gamehud__outdot ${i < outs ? 'gamehud__outdot--filled' : ''}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
