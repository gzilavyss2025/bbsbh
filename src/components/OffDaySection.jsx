import { TeamLogo } from './TeamLogo.jsx'
import { BreakableLocation } from './BreakableLocation.jsx'
import { useNav } from '../lib/nav.js'
import { teamPath } from '../lib/route.js'
import { splitName } from '../lib/teamSplits.js'
import { teamClubNameShort, favoriteAccentColor } from '../lib/teams.js'

// The clubs NOT playing on the slate's date, shown below the games as small
// gameday-styled cards — same framed, overscaled logo tile the slate matchup
// cards use (see .gamecard__logobox), scaled down. Tapping a card opens that
// team's page with NO spoiler cutoff: teamPath's `d`/`s` hint exists to
// protect a game you followed the link from, but a club on this list has no
// game on `dateStr` — there's nothing here for a cutoff to protect, so
// passing one anyway just shows a "stats frozen" banner over nothing. Any
// level — each `team` carries its own name/mascot straight from statsapi (see
// fetchTeams), so this needs no MLB-only static id map. The caller only
// renders it when the slate actually has games (an empty All-Star-break day
// isn't an "off day" for a whole league). Sits above the Day Recap on a past
// day, below the games on a current one — its one fixed home in the list.
export function OffDaySection({ teams, favoriteTeamId, favoriteAffiliateIds }) {
  const navigate = useNav()
  if (!teams?.length) return null
  return (
    <section className="offday" aria-label="Teams with an off day">
      <h2 className="offday__banner">Off Day</h2>
      <ul className="offday__grid">
        {teams.map((team) => (
          <li key={team.id}>
            <OffDayCard
              team={team}
              pinned={team.id === favoriteTeamId || !!favoriteAffiliateIds?.has(team.id)}
              onOpen={() => navigate(teamPath(team.id))}
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
// exactly like .gamecard--pinned. favoriteAccentColor is MLB-only and returns
// null for a MiLB id — the CSS var then just falls back to the default
// pinned tint (see .offdaycard--pinned's color-mix fallback).
function OffDayCard({ team, pinned, onOpen }) {
  const { id, name: full } = team
  // Same hand-maintained splits the slate cards use, so the Athletics render
  // as "It's Just / Athletics" rather than the API's duplicated
  // "Athletics / Athletics"; any team missing from that table falls back to
  // stripping `teamName` (the mascot) off the end of the full name.
  const { location, mascot } = splitName(full, team.teamName)
  // The mascot line uses the brand-approved short form where a nickname would
  // otherwise wrap on the tight tile (Arizona -> "D-backs", MLB only); every
  // other club — including all of MiLB — falls back to the split mascot.
  const shortMascot = teamClubNameShort(id) || mascot
  const accent = pinned ? favoriteAccentColor(id) : null
  const style = accent ? { '--pin-accent': accent } : undefined
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
        {location && <BreakableLocation text={location} className="offdaycard__loc" />}
        <span className="offdaycard__mascot">{shortMascot || full}</span>
      </span>
      {pinned && (
        <span className="offdaycard__pin" aria-hidden="true">
          ★
        </span>
      )}
    </button>
  )
}
