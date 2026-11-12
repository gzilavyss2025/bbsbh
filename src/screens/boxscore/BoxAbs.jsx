import { selectChallengeState, gameHasAbs } from '../../api/challenges.js'
import { ordinal } from '../../lib/format.js'

// One club's whole-game ABS (Automated Ball-Strike) challenges, joined to the foot
// of its batting/pitching card on the box score (Gary, 2026-11-12): the calls it
// challenged while BATTING (its own half) and while PITCHING (the other club's
// half), one green/red pip per call, and a line when it spent its last one
// (ranOutAt, api/challenges.js). Renders only where the feed says the game runs
// the challenge system (gameHasAbs). Safe to walk the whole game (Infinity):
// the box score is already behind its own seal. Styles: box-score/abs-strip.css.
export function BoxAbs({ feed, sideKey, abbr }) {
  if (!gameHasAbs(feed)) return null
  const side = selectChallengeState(feed, Infinity, 'bottom')[sideKey]
  const batHalf = sideKey === 'away' ? 'top' : 'bottom'
  const cols = [
    ['Batting', side.outcomes.filter((o) => o.half === batHalf)],
    ['Pitching', side.outcomes.filter((o) => o.half !== batHalf)],
  ]
  return (
    <section className="bs__abs2" aria-label={`${abbr} ABS challenges`}>
      <span className="bs__abs2Title t-label t-label--bold">ABS challenges</span>
      {cols.map(([label, list]) => {
        const won = list.filter((o) => o.outcome === 'success').length
        return (
          <div className="bs__abs2Col" key={label}>
            <span className="t-label">{label}</span>
            {list.length ? (
              <span className="abs__pips" role="img" aria-label={`${label}: ${won} of ${list.length} overturned`}>
                {list.map((o, i) => (
                  <span key={i} className={`abs__pip abs__pip--${o.outcome === 'success' ? 'won' : 'lost'}`} aria-hidden="true" />
                ))}
              </span>
            ) : (
              <span className="sr-only">{`${label}: no challenges`}</span>
            )}
          </div>
        )
      })}
      {side.ranOut && (
        <p className="bs__abs2Out">
          Ran out of ABS challenges in{' '}
          <span aria-hidden="true">{side.ranOut.half === 'top' ? '▲' : '▼'}{side.ranOut.inning}</span>
          <span className="sr-only">{`the ${side.ranOut.half === 'top' ? 'top' : 'bottom'} of the ${ordinal(side.ranOut.inning)}`}</span>
        </p>
      )}
    </section>
  )
}
