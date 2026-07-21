import { selectDueUpNext } from '../api/dueup.js'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// A preview of the OTHER team's next half: the first few spots due up,
// same footing as the lineup card (jersey/position, no reveal-gated seal of
// its own — selectDueUpNext already returns null until it's safe to show,
// see its own header comment). Sits in the stat card's own column, below it,
// so it reads as "and coming up after this…" rather than competing with the
// win-probability chart for the narrower right-hand share of the row.
export function DueUpNextCard({ feed, inning, half, revealedThrough, awayAbbr, homeAbbr, awayId, homeId, awayName, homeName }) {
  const info = selectDueUpNext(feed, inning, half, revealedThrough)
  if (!info) return null
  const teamAbbr = info.battingSide === 'away' ? awayAbbr : homeAbbr
  const teamId = info.battingSide === 'away' ? awayId : homeId
  const teamName = info.battingSide === 'away' ? awayName : homeName

  return (
    <div className="dueup">
      <span className="dueup__title">
        <TeamLogo teamId={teamId} name={teamName} size={16} />
        Due up next — {teamAbbr}
      </span>
      <ol className="dueup__list">
        {info.batters.map((b) => (
          <li className="dueup__row" key={b.id}>
            <span className="dueup__slot">{b.slot}</span>
            <PlayerLink id={b.id} className="dueup__name">
              {b.last}
              {b.first ? `, ${b.first}` : ''}
            </PlayerLink>
            <span className="dueup__jersey">{b.jersey}</span>
            <span className="dueup__pos">{b.position}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
