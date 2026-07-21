import { selectDueUpNext } from '../api/dueup.js'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'

// A preview of the OTHER team's next half: the first few spots due up, same
// headshot-column presentation as UpNextBatters.jsx's own "Due up" card (no
// reveal-gated seal of its own — selectDueUpNext already returns null until
// it's safe to show, see its own header comment). Sits in the stat card's own
// column, below it, so it reads as "and coming up after this…" rather than
// competing with the win-probability chart for the narrower right-hand share
// of the row.
export function DueUpNextCard({ feed, inning, half, revealedThrough, awayId, homeId, awayName, homeName }) {
  const info = selectDueUpNext(feed, inning, half, revealedThrough)
  if (!info) return null
  const teamId = info.battingSide === 'away' ? awayId : homeId
  const teamName = info.battingSide === 'away' ? awayName : homeName

  return (
    <div className="dueup">
      <span className="dueup__title">
        <TeamLogo teamId={teamId} name={teamName} size={16} />
        Due up next for the {teamName}
      </span>
      <div className="dueup__row">
        {info.batters.map((b) => (
          <div className="dueup__col" key={b.id}>
            <Headshot personId={b.id} name={b.last} teamId={teamId} className="dueup__shot" />
            <span className="dueup__name">
              <PlayerLink id={b.id}>{b.last}</PlayerLink>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
