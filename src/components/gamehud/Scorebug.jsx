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
      {/* `display: contents` by default (24-floating-nav-and-hud.css), so the
          docked card's own column stacking sees straight through this wrapper
          to the same two rows it always had. It becomes a real box only in the
          anchored console band (.gamehud--console), where the batter/pitcher
          pair has to sit as ONE column BESIDE the strip rather than stacked
          above it — two separate flex siblings can't be grouped by CSS alone.
          Same idiom as .innings__stage. */}
      <div className="gamehud__lines">
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
      </div>
      <div className="gamehud__strip">
        {/* Two stacks, away over home, not one four-cell grid. They were one
            grid — tile, runs, tile, runs across an 80%/20% split — which tied
            the club marks and the run numbers to a single share of the strip:
            widening the numbers narrowed the marks by exactly as much. As two
            flex children the marks take a fixed 40% and the numbers take what
            is left over, and each stack draws its own 2px rule between the
            clubs (24-floating-nav-and-hud.css). Same reading order, same two
            rows; the split is what makes the row proportions adjustable. */}
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
          <TeamTreatmentMark
            teamId={homeTeamId}
            name={homeName}
            treatment={homeTreatment}
            side="home"
            size={24}
            block="gamehud__tile"
            className="gamehud__tile--home"
          />
        </div>
        <div className="gamehud__runscol">
          <span className="gamehud__runs">{awayRuns}</span>
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
          <BaseState bases={bases} size={46} />
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
