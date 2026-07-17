import { loadPostseasonHistory } from '../api/postseasonHistory.js'
import {
  loadSeriesStats,
  findSeriesById,
  BATTING_CATEGORIES,
  PITCHING_CATEGORIES,
} from '../api/postseasonSeries.js'
import { fetchGameCardsByPk } from '../api/schedule.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { useNav } from '../lib/nav.js'
import { gamePath } from '../lib/route.js'
import { teamClubNameShort, favoriteAccentColor } from '../lib/teams.js'
import { TeamLink } from '../components/TeamLink.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { Headshot } from '../components/Headshot.jsx'
import { PlayerLink } from '../components/PlayerLink.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { BackBtn } from '../components/BackBtn.jsx'
import { AsyncGate } from '../components/AsyncGate.jsx'
import { TeamLeaders } from '../components/TeamLeaders.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDayYear(iso) {
  const [y, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}

// Resolves the URL's seriesId against postseason-history.json (cached
// in-memory, same fetch PostseasonHistoryPage/the old bracket modal already
// use), then sweeps that series' handful of games for batting/pitching
// totals (loadSeriesStats) and resolves each game's box-score link
// (fetchGameCardsByPk) — the exact live-resolve PostseasonSeriesModal used to
// do, now owned by this page since the modal is retired in favor of direct
// navigation (tapping a bracket card routes straight here).
async function loadSeries(seriesId) {
  const history = await loadPostseasonHistory()
  const series = findSeriesById(history, seriesId)
  if (!series) return null
  const [stats, cardsByPk] = await Promise.all([
    loadSeriesStats(series.games),
    fetchGameCardsByPk(series.games.map((g) => g.gamePk)),
  ])
  return { series, stats, cardsByPk }
}

// Postseason Series: a single series' final result (winner/loser, series
// score), game-by-game scores linking to each game's box score, the round
// MVP where one exists, and batting/pitching leaders scoped to just that
// series (see api/postseasonSeries.js for why this is a live client-side
// aggregation rather than a precomputed file, unlike the career leaders
// page). No SealBox needed — same footing as Postseason History/Leaders: a
// past series' result carries no LIVE game's spoiler risk.
//
// `favoriteTeamId` gets the same --fav-accent highlight as Postseason
// Leaders/AwardsHistoryPage, on the result banner and in both leader boards —
// only relevant here when the user's team actually played in this series.
export function PostseasonSeriesPage({ seriesId }) {
  const back = () => window.history.back()
  const { favoriteTeamId } = useFavoriteTeam()
  const navigate = useNav()
  const { loading, error, data } = useAsync(() => loadSeries(seriesId), [seriesId])

  useDocumentTitle(data?.series ? `${data.series.year} ${data.series.label}` : null)

  const gate = AsyncGate({ loading, error, data, screenClass: 'psseries', noun: 'series', onBack: back })
  if (gate) return gate

  const { series, stats, cardsByPk } = data
  const { teamA, teamB, winnerTeamId, mvp, label, year, isWorldSeries, games } = series
  const winner = winnerTeamId === teamA.teamId ? teamA : teamB
  const loser = winnerTeamId === teamA.teamId ? teamB : teamA
  const isFav = (teamId) => favoriteTeamId != null && teamId === favoriteTeamId
  const favStyle = (teamId) => (isFav(teamId) ? { '--fav-accent': favoriteAccentColor(teamId) } : undefined)
  const hasBatting = Object.values(stats.batting).some((v) => v.length > 0)
  const hasPitching = Object.values(stats.pitching).some((v) => v.length > 0)

  return (
    <div className="screen psseries">
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="topbar">
        <h1 className="topbar__title">
          {year} {label}
        </h1>
      </header>

      {isWorldSeries && (
        <img
          src="/brand/world-series-trophy.png"
          alt=""
          className="psseries__trophy"
          aria-hidden="true"
        />
      )}

      <div className="psseries__result">
        <div className={`psseries__team psseries__team--winner${isFav(winner.teamId) ? ' psseries__team--fav' : ''}`} style={favStyle(winner.teamId)}>
          <TeamLink id={winner.teamId} className="psseries__teamlink">
            <TeamLogo teamId={winner.teamId} name={teamClubNameShort(winner.teamId)} size={40} />
            <span className="psseries__teamname">{teamClubNameShort(winner.teamId)}</span>
          </TeamLink>
        </div>
        <span className="psseries__score">
          {winner.wins}–{loser.wins}
        </span>
        <div className={`psseries__team psseries__team--loser${isFav(loser.teamId) ? ' psseries__team--fav' : ''}`} style={favStyle(loser.teamId)}>
          <TeamLink id={loser.teamId} className="psseries__teamlink">
            <TeamLogo teamId={loser.teamId} name={teamClubNameShort(loser.teamId)} size={40} />
            <span className="psseries__teamname">{teamClubNameShort(loser.teamId)}</span>
          </TeamLink>
        </div>
      </div>

      <ul className="psseries__games">
        {games.map((g) => {
          const awayWon = g.awayScore > g.homeScore
          const card = cardsByPk?.[g.gamePk]
          return (
            <li key={g.gameNumber}>
              <button
                type="button"
                className="psseries__game"
                disabled={!card}
                onClick={() =>
                  card &&
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
              >
                <span className="psseries__gamenum">Game {g.gameNumber}</span>
                <span className="psseries__gamedate">{monthDayYear(g.date)}</span>
                <span className={`psseries__gameline${awayWon ? ' psseries__gameline--awaywon' : ''}`}>
                  <TeamLogo teamId={g.awayTeamId} name="" size={16} />
                  <span className="psseries__gamescore">{g.awayScore}</span>
                  <span className="psseries__at">@</span>
                  <TeamLogo teamId={g.homeTeamId} name="" size={16} />
                  <span className="psseries__gamescore">{g.homeScore}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {mvp && (
        <div className="psseries__mvp">
          <Headshot personId={mvp.playerId} name={mvp.name} teamId={mvp.teamId} className="psseries__mvpshot" />
          <div className="psseries__mvpinfo">
            <span className="psseries__mvptag">Series MVP</span>
            <PlayerLink id={mvp.playerId} className="psseries__mvpname">
              {mvp.name}
            </PlayerLink>
          </div>
        </div>
      )}

      {hasBatting && (
        <TeamLeaders
          pool={[]}
          precomputed={stats.batting}
          categories={BATTING_CATEGORIES}
          limit={5}
          title="Series batting leaders"
          showTeamAbbr={false}
          favoriteTeamId={favoriteTeamId}
        />
      )}

      {hasPitching && (
        <TeamLeaders
          pool={[]}
          precomputed={stats.pitching}
          categories={PITCHING_CATEGORIES}
          limit={5}
          title="Series pitching leaders"
          showTeamAbbr={false}
          favoriteTeamId={favoriteTeamId}
        />
      )}
    </div>
  )
}
