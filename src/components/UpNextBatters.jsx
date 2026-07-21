import { selectDueUpNow } from '../api/dueup.js'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// Who's due up to face the entering pitcher, BEFORE any of this half is
// revealed — three headshot columns, same "entering the half" spoiler-safety
// footing as the lineup/defense reference just below it (selectDueUpNow's own
// lineupEntering-derived gate). Gone the moment the user starts revealing
// (HalfInning.jsx drops this alongside PrePitchChanges/the entering reference
// on startedRevealing) — once real at-bats are on screen, "who's due up" is
// just the top of the live play-by-play feed.
export function UpNextBatters({ feed, inning, half, revealedThrough, teamId }) {
  const info = selectDueUpNow(feed, inning, half, revealedThrough)
  if (!info) return null
  return (
    <div className="upnext">
      <span className="upnext__title">Due up</span>
      <div className="upnext__row">
        {info.batters.map((b) => (
          <div className="upnext__col" key={b.id}>
            <Headshot personId={b.id} name={b.last} teamId={teamId} className="upnext__shot" />
            <span className="upnext__name">
              <PlayerLink id={b.id}>{b.last}</PlayerLink>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
