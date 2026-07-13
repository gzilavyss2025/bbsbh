import { TeamLogo } from './TeamLogo.jsx'
import { useNav } from '../lib/nav.js'
import { teamPath } from '../lib/route.js'
import {
  teamLocationName,
  teamClubName,
  teamFullName,
  favoriteAccentColor,
} from '../lib/teams.js'

// The clubs NOT playing on the slate's date, shown below the games as small
// gameday-styled cards — same framed, overscaled logo tile the slate matchup
// cards use (see .gamecard__logobox), scaled down. Tapping a card opens that
// team's page, carrying the date/level as the spoiler-safe cutoff (teamPath's
// `d`/`s`) just like every other in-app team link. MLB only, and the caller
// only renders it when the slate actually has games (an empty All-Star-break
// day isn't an "off day" for all 30 clubs). Sits above the Day Recap on a past
// day, below the games on a current one — its one fixed home in the list.
export function OffDaySection({ teamIds, favoriteTeamId, dateStr, sportId }) {
  const navigate = useNav()
  if (!teamIds?.length) return null
  return (
    <section className="offday" aria-label="Teams with an off day">
      <h2 className="offday__banner">Off Day</h2>
      <ul className="offday__grid">
        {teamIds.map((id) => (
          <li key={id}>
            <OffDayCard
              id={id}
              pinned={id === favoriteTeamId}
              onOpen={() => navigate(teamPath(id, { d: dateStr, s: sportId }))}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

// One club's off-day tile: the framed logo over its location/mascot name, the
// same two-line treatment as a slate card's team. The favorite team's tile
// gets the pinned accent (border tint + star) via the --pin-accent inline var,
// exactly like .gamecard--pinned.
function OffDayCard({ id, pinned, onOpen }) {
  const location = teamLocationName(id)
  const mascot = teamClubName(id)
  const full = teamFullName(id)
  const style = pinned ? { '--pin-accent': favoriteAccentColor(id) } : undefined
  return (
    <button
      type="button"
      className={`offdaycard ${pinned ? 'offdaycard--pinned' : ''}`}
      style={style}
      onClick={onOpen}
      aria-label={`${full} — off day, open team page`}
    >
      <span className="offdaycard__logobox">
        <TeamLogo teamId={id} name={mascot || full} size={40} />
      </span>
      <span className="offdaycard__name">
        {location && <span className="offdaycard__loc">{location}</span>}
        <span className="offdaycard__mascot">{mascot || full}</span>
      </span>
      {pinned && (
        <span className="offdaycard__pin" aria-hidden="true">
          ★
        </span>
      )}
    </button>
  )
}
