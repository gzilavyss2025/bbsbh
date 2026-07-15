import { loadAllStarRosters } from '../api/allStarRosters.js'
import { fetchGameCardsByPk } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { humanDate } from '../lib/dates.js'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { GameCard } from '../components/GameCard.jsx'
import { favoriteAccentColor } from '../lib/teams.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDay(iso) {
  const [, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}` : ''
}

// AL first, then NL — a fixed order so a season's row always reads the same
// way regardless of what order the source recipients arrived in (same
// convention as AwardsHistoryPage's groupByLeague, minus that page's
// leagueless MLB-wide bucket — every All-Star selection carries a league).
const LEAGUE_ORDER = ['AL', 'NL']
function groupByLeague(recipients) {
  return LEAGUE_ORDER.map((league) => ({
    league,
    recipients: recipients.filter((r) => r.league === league),
  })).filter((g) => g.recipients.length > 0)
}

// A season's full roster, AL then NL, pre-sorted position-first by the
// generator (gen-all-star-rosters.mjs's POSITION_ORDER) so the same slot
// (pitchers, then catchers, infield, outfield, DH) lands in the same place
// every year. `teamName` is the club's name AS OF that season (a season-
// scoped lookup in the generator, not the app's current-team table) — a
// 1933 Washington Senators pick reads as a Senator, not a Twin, even though
// the franchise id is the same.
function RosterLeagues({ recipients, favoriteTeamId }) {
  const groups = groupByLeague(recipients)
  if (!groups.length) return null
  return (
    <div className="allstarrosters__leagues">
      {groups.map((g) => (
        <div className="allstarrosters__league" key={g.league}>
          <span className="allstarrosters__leaguetag">{g.league}</span>
          <div className="allstarrosters__recipients">
            {g.recipients.map((r) => {
              const isFavorite = favoriteTeamId != null && r.teamId === favoriteTeamId
              const favStyle = isFavorite
                ? { '--fav-accent': favoriteAccentColor(r.teamId) }
                : undefined
              return (
                <span
                  className={`allstarrosters__recipient${isFavorite ? ' allstarrosters__recipient--fav' : ''}`}
                  style={favStyle}
                  key={r.playerId}
                >
                  {r.teamId ? (
                    <TeamLink id={r.teamId} className="allstarrosters__teamlink">
                      <TeamLogo teamId={r.teamId} name={r.teamName} size={16} />
                    </TeamLink>
                  ) : (
                    <TeamLogo teamId={r.teamId} name={r.teamName} size={16} />
                  )}
                  <PlayerLink id={r.playerId} className="allstarrosters__name">
                    {r.name}
                  </PlayerLink>
                  <span className="allstarrosters__team">{r.teamName}</span>
                  {r.position && <em className="allstarrosters__pos">{r.position}</em>}
                </span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// One season: the roster (above) plus, when the game itself resolved, the
// ordinary GameCard for it — tap the card for the lineups, "Box score ›" for
// the final. Deliberately reuses GameCard rather than printing the score as
// plain text: GameCard never renders a raw score even for a Final game (see
// its own header comment) — that's the app's one true invariant, and a game
// from 1955 gets no exemption a game from last week wouldn't. The score is
// one tap away, behind the same seal every other box score uses.
function RosterYear({ year, recipients, card, navigate, favoriteTeamId }) {
  return (
    <section className="allstarrosters__year">
      <span className="allstarrosters__yearnum">{year}</span>
      <div className="allstarrosters__body">
        {card && (
          <div className="allstarrosters__game">
            <GameCard
              game={card}
              dateLabel={humanDate(card.officialDate)}
              onSelect={() =>
                navigate(
                  gamePath(
                    card.officialDate,
                    card.away.abbreviation,
                    card.home.abbreviation,
                    'lineup1',
                    card.gameNumber,
                  ),
                )
              }
              onBoxScore={() =>
                navigate(
                  gamePath(
                    card.officialDate,
                    card.away.abbreviation,
                    card.home.abbreviation,
                    'boxscore',
                    card.gameNumber,
                  ),
                )
              }
            />
          </div>
        )}
        <RosterLeagues recipients={recipients} favoriteTeamId={favoriteTeamId} />
      </div>
    </section>
  )
}

// All-Star Rosters: every MLB All-Star Game roster, year over year back to
// 1933 — the standalone historical counterpart to a live game's lineup card.
// Data comes from scripts/gen-all-star-rosters.mjs, a hand-run precompute (a
// season's roster is decided once and never changes, same footing as
// awards-history.json/milb-history.json) — no SealBox needed for the roster
// itself, same as Awards History/League Leaders/WAR: who was NAMED to a
// squad carries no individual game's score. The game's final score stays
// sealed exactly like everywhere else in the app (see RosterYear above); only
// the roster membership is shown unsealed here. A recipient who played for
// the user's favoriteTeamId (useFavoriteTeam, same preference the slate/
// standings/leaders pages already highlight with) gets the same --fav-accent
// treatment as those surfaces.
export function AllStarRostersPage() {
  useDocumentTitle('All-Star Rosters')
  const navigate = useNav()
  const { favoriteTeamId } = useFavoriteTeam()
  const { loading, error, data } = useAsync(() => loadAllStarRosters(), [])
  const seasons = data?.seasons ?? []
  const rosters = data?.rosters ?? {}
  const games = data?.games ?? {}
  const updated = monthDay(data?.generatedAt?.slice(0, 10))

  const gamePks = Object.values(games)
  const gamePksKey = gamePks.join(',')
  const cardsAsync = useAsync(() => fetchGameCardsByPk(gamePks), [gamePksKey])
  const cards = cardsAsync.data ?? {}

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">All-Star Rosters</h1>
      </header>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={seasons.length > 0}
        errorMessage="Couldn’t load All-Star Rosters. Try again."
        emptyMessage="No All-Star roster history is available right now."
        emptyProse
      />

      {seasons.length > 0 && (
        <>
          <p className="hint">
            Every player named to an All-Star squad — including one who was
            selected but never played, replaced by an injury or a starter who
            pitched the Sunday before.
          </p>
          <div className="allstarrosters__list">
            {seasons.map((year) => {
              const gamePk = games[year]
              const card = gamePk ? cards[gamePk] : null
              return (
                <RosterYear
                  key={year}
                  year={year}
                  recipients={rosters[year] ?? []}
                  card={card}
                  navigate={navigate}
                  favoriteTeamId={favoriteTeamId}
                />
              )
            })}
          </div>
          {updated && <p className="hint prospects__caption">Updated {updated}.</p>}
        </>
      )}
    </div>
  )
}
