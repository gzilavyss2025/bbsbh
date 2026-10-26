import { BaseState } from '../../../components/scoring/BaseState.jsx'
import { TeamTreatmentMark } from '../../../components/logo/TeamTreatmentMark.jsx'
import { plateLabel } from '../../../components/gamehud/HeaderBug.jsx'

// The mark's size inside its tile; the tile (.gdnext-band__mark) is a little larger so the
// overscaled art crops against its edge, as on the slate card and today's score bug.
const MARK = 32

// The band: score, half, bases, outs, the pitcher and his count. It takes HeaderBug's props, so
// ScorebugMount's reveal clamp stays the only gate on the score. It reuses today's score bug's
// type and parts (the `inhead__*` rules in styles/gameview/inning-head.css): each club's uniform
// tile and its runs, then the plate (inning arrow, bases, two out dots), then the pitcher. The
// count is not in the live snapshot yet: the hero slice (#2576) brings it.
export function GamedayBand({
  awayName, homeName, awayTeamId, homeTeamId, awayTreatment, homeTreatment, season,
  awayRuns = 0, homeRuns = 0, inning, half, final = false, pitcher, bases, outs = 0,
}) {
  const top = half === 'top'
  const club = (side, id, name, treatment, runs) => (
    <span className={`gdnext-band__club gdnext-band__club--${side}`} role="img" aria-label={`${name}: ${runs}`}>
      <TeamTreatmentMark teamId={id} name={name} treatment={treatment} side={side} size={MARK} season={season} block="gdnext-band__mark" />
      <span className="inhead__runs gdnext-band__runs">{runs}</span>
    </span>
  )
  return (
    <div className="gdnext-band">
      {club('away', awayTeamId, awayName, awayTreatment, awayRuns)}
      <div className="gdnext-band__plate" role="img" aria-label={inning != null ? plateLabel({ final, top, inning, outs, bases }) : undefined}>
        {inning != null && (
          <div className="inhead__inning">
            {final ? (
              <span className="inhead__num gdnext-band__num">F</span>
            ) : (
              <>
                <span className={`inhead__tri ${top ? 'inhead__tri--up' : 'inhead__tri--down'}`} aria-hidden="true" />
                <span className="inhead__num gdnext-band__num">{inning}</span>
              </>
            )}
          </div>
        )}
        <BaseState bases={bases} size={32} />
        <div className="inhead__outs">
          {/* Two dots, as on today's bug: a half ends the instant the third out lands. */}
          {[0, 1].map((i) => <span key={i} className={`inhead__outdot${i < outs ? ' is-out' : ''}`} />)}
        </div>
      </div>
      {club('home', homeTeamId, homeName, homeTreatment, homeRuns)}
      {pitcher && (
        <div className="gdnext-band__pitcher">
          <span className="inhead__who">{pitcher.last}</span>
          <span className="inhead__val">P {pitcher.pitches}</span>
        </div>
      )}
    </div>
  )
}
