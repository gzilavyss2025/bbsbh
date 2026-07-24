import { useNav } from '../lib/nav.js'
import { Headshot } from './Headshot.jsx'
import { PlayerLink } from './PlayerLink.jsx'
import { TeamLink } from './TeamLink.jsx'
import { TeamLogo } from './TeamLogo.jsx'
import { ProspectPill } from './ProspectPill.jsx'
import { isMlbTeamId } from '../lib/teams.js'
import { scorePairsLine } from '../lib/resultCards.js'

// "Tyler Tolbert" -> ["Tyler", "Tolbert"] (everything after the first space).
// Used so the name wraps to two lines next to the bigger headshot, without a
// fixed split table.
function splitFirstLast(full) {
  const i = (full ?? '').indexOf(' ')
  return i === -1 ? [full ?? '', ''] : [full.slice(0, i), full.slice(i + 1)]
}

// The game a performance came from, as a plain score line ("MIL 10, STL 2")
// linking to that game's (already-sealed) box score — not a PlayerLink/
// TeamLink, so it navigates directly rather than through LinkScope. Only the
// slate's live Top Performers box (src/components/TopPerformersBox.jsx)
// attaches `entry.game` — a past-day recap's Winners/Losers and Statcast
// tiles already sit inside a single game's own context, so PerformerCard
// renders this line only when the field is present.
function GameScoreLink({ game }) {
  const navigate = useNav()
  if (!game) return null
  return (
    <button
      type="button"
      className="plink playercard__score"
      onClick={() => navigate(game.boxScorePath)}
    >
      {scorePairsLine([
        [game.awayAbbr, game.awayScore],
        [game.homeAbbr, game.homeScore],
      ])}
    </button>
  )
}

// One "baseball card" tile: headshot (with position floated on it as a small
// badge, same idiom as the former-teammates cards' .teammatecard__posbadge),
// name (a clickable PlayerLink), team logo + abbreviation + an optional
// prospect pill, stat line underneath, and an optional game-score line (see
// GameScoreLink above). Shared by the slate's live Top Performers box, the
// Statcast leaders box, the box score's Insights card, and each result card's
// Dominant Performance / Blowout / Extra-Innings pill — entry fields a given
// caller doesn't carry (prospectRank/orgProspectRank, game) simply render
// nothing, rather than growing a second "baseball card" style per caller.
export function PerformerCard({ entry }) {
  const [first, last] = splitFirstLast(entry.name)
  return (
    <li className="playercard">
      <span className="playercard__shotwrap">
        <Headshot
          personId={entry.id}
          name={entry.name}
          teamId={entry.parentOrgId ?? entry.teamId}
          isMlb={isMlbTeamId(entry.teamId)}
          className="playercard__shot"
        />
        {entry.position && <span className="playercard__posbadge">{entry.position}</span>}
      </span>
      <div className="playercard__body">
        <div className="playercard__name">
          <PlayerLink id={entry.id}>
            {first} {last && <br className="playercard__namebreak" />}
            {last}
          </PlayerLink>
        </div>
        <div className="playercard__team">
          <TeamLogo teamId={entry.teamId} name={entry.teamAbbr} size={16} />
          <TeamLink id={entry.teamId}>{entry.teamAbbr}</TeamLink>
          {(entry.prospectRank || entry.orgProspectRank) && (
            <ProspectPill
              rank={entry.prospectRank}
              orgRank={entry.orgProspectRank}
              orgTeamId={entry.parentOrgId}
              orgTeamName={entry.teamAbbr}
            />
          )}
        </div>
        <div className="playercard__stat">{entry.stat}</div>
        <GameScoreLink game={entry.game} />
      </div>
    </li>
  )
}
