import { TeamTreatmentMark } from '../logo/TeamTreatmentMark.jsx'
import { BaseState } from '../scoring/BaseState.jsx'

// The scorebug as the innings page's masthead: the same facts as Scorebug.jsx, laid out as the
// split header. Each club is a slanted half on its own tile colour (the slate card's versus
// split, held on) with its mark at the outer edge and its runs at the inner edge; the dark plate
// the halves lean around carries the inning, the bases and the outs; the pitcher and the batter
// are two bars under the strip. Pure presentational, like Scorebug: every value arrives already
// resolved and reveal-gated by ScorebugMount, and nothing here reads the feed.
//
// Taking the club marks' tap-to-sketch off this page is deliberate: the band is one object and a
// half that opened a modal would be the only control on it. The lineup pages' crest and the box
// score's masthead still open it.
const MARK = 40

// One spoken line for the plate: where the game is, the outs, and who is on. It says only what the
// plate shows, so it is as safe as the plate. Bare numbers would read as "0" and "0" with no club.
export function plateLabel({ final, top, inning, outs, bases }) {
  if (final) return 'Final'
  const on = ['first', 'second', 'third'].filter((b) => bases?.[b])
  return `${top ? 'Top' : 'Bottom'} ${inning}, ${outs} out, ${on.length ? `runners on ${on.join(' and ')}` : 'bases empty'}`
}

export function HeaderBug({
  awayName,
  homeName,
  awayTeamId,
  homeTeamId,
  awayTreatment,
  homeTreatment,
  season,
  awayRuns = 0,
  homeRuns = 0,
  inning,
  half, // 'top' | 'bottom'
  final = false, // game over AND revealed as over: the indicator reads F
  batter, // { order, last, line } | null
  pitcher, // { last, pitches } | null
  bases,
  outs = 0,
  over = false, // the half just ended: the name bars stay, dimmed
  onTeam = null, // (side) => void: a tap on a club's half opens how it scored (Gameday, 2026-10-29)
}) {
  const top = half === 'top'
  // The club at bat wears the marker underline, as on the console band; nobody bats once it is over.
  const batting = final ? null : top ? 'away' : 'home'
  return (
    <div className={`inhead${over ? ' inhead--over' : ''}`}>
      <div className="inhead__strip">
        <TeamTreatmentMark
          teamId={awayTeamId}
          name={awayName}
          treatment={awayTreatment}
          side="away"
          size={MARK}
          season={season}
          block="inhead__half"
          className={`inhead__half--away${batting === 'away' ? ' is-atbat' : ''}`}
        />
        <span className="inhead__runs inhead__runs--away" role="img" aria-label={`${awayName}: ${awayRuns}`}>
          {awayRuns}
        </span>
        <div className="inhead__center" role="img" aria-label={plateLabel({ final, top, inning, outs, bases })}>
          <div className="inhead__inning">
            {final ? (
              <span className="inhead__num" aria-label="Final">
                F
              </span>
            ) : (
              <>
                <span className={`inhead__tri ${top ? 'inhead__tri--up' : 'inhead__tri--down'}`} aria-hidden="true" />
                <span className="inhead__num">{inning}</span>
              </>
            )}
          </div>
          <BaseState bases={bases} size={44} />
          <div className="inhead__outs">
            {/* Two dots: a half ends the instant the third out lands, so a third could never light. */}
            {[0, 1].map((i) => (
              <span key={i} className={`inhead__outdot${i < outs ? ' is-out' : ''}`} />
            ))}
          </div>
        </div>
        <span className="inhead__runs inhead__runs--home" role="img" aria-label={`${homeName}: ${homeRuns}`}>
          {homeRuns}
        </span>
        <TeamTreatmentMark
          teamId={homeTeamId}
          name={homeName}
          treatment={homeTreatment}
          side="home"
          size={MARK}
          season={season}
          block="inhead__half"
          className={`inhead__half--home${batting === 'home' ? ' is-atbat' : ''}`}
        />
        {onTeam && ['away', 'home'].map((side) => (
          <button key={side} type="button" className={`inhead__teambtn inhead__teambtn--${side}`} aria-haspopup="dialog"
            aria-label="Scoring summary" onClick={() => onTeam(side)} />
        ))}
      </div>
      {(pitcher || batter) && (
        <div className="inhead__bars">
          {pitcher && (
            <div className="inhead__row inhead__row--pitcher">
              <span className="inhead__who">{pitcher.last}</span>
              <span className="inhead__val">
                <span className="inhead__lbl">P:</span>
                {pitcher.pitches}
              </span>
            </div>
          )}
          {batter && (
            <div className="inhead__row inhead__row--batter">
              <span className="inhead__who">{`${batter.order}. ${batter.last}`}</span>
              <span className="inhead__val">{batter.line ?? '—'}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
