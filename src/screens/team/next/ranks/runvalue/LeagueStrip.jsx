import { signed } from '../../../../../api/around-the-game/runValue.js'
import { teamAbbr } from '../../../../../lib/teams.js'

// The league strip in the run value card's ink tile (#2295): one bar per club, best to worst, so
// "3 of 30" has a picture beside it. A bar's height is its club total against the biggest one in
// the league; above the line is a club above average, below it a club under. The viewed club is the
// marker bar, with its abbreviation over the strip. The bars are aria-hidden: the tile's rank text
// carries the same fact, and the captions under the strip name both ends.
export function LeagueStrip({ rows, teamId }) {
  if (!rows?.length) return null
  const top = Math.max(...rows.map((r) => Math.abs(r.total))) || 1
  const best = rows[0]
  const worst = rows[rows.length - 1]
  return (
    <div className="rvleague">
      <div className="rvleague__bars" aria-hidden="true">
        {rows.map((r, i) => {
          const mine = r.teamId === Number(teamId)
          const up = r.total >= 0
          return (
            <span key={r.teamId} className="rvleague__slot">
              <span
                className={`rvleague__bar rvleague__bar--${up ? 'up' : 'down'}${mine ? ' rvleague__bar--mine' : ''}`}
                style={{ '--h': Math.abs(r.total) / top, '--i': i }}
              />
              {mine ? <span className="rvleague__tag">{teamAbbr({ id: r.teamId })}</span> : null}
            </span>
          )
        })}
      </div>
      <p className="rvleague__captions">
        <span>
          {teamAbbr({ id: best.teamId })} {signed(best.total)}
        </span>
        <span>League, best to worst</span>
        <span>
          {teamAbbr({ id: worst.teamId })} {signed(worst.total)}
        </span>
      </p>
    </div>
  )
}
