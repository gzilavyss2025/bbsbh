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
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
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
import { GameResultFace } from '../components/GameResultFace.jsx'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
function monthDayYear(iso) {
  const [y, m, d] = (iso || '').split('-')
  return m ? `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}` : ''
}

// "Brewers lead 3-2" / "Series tied 2-2" / "Brewers win series 3-2" — the
// series record as of THIS game, not the final one (a game 3 mid-series
// still reads "tied", not the series' eventual outcome). `games` is already
// gameNumber-ordered (see gen-postseason-history.mjs), so tallying wins
// through `gameIndex` gives an exact running score. The postseason data only
// ever stores games actually played — a series stops the moment someone
// clinches — so the LAST game in the array is always the clinching game,
// with no best-of-N threshold to know per round (Division/Wild
// Card/Championship all differ). Rendered in normal case: the app's global
// ALL-CAPS invariant (see index.css) displays it as caps via CSS, not a
// manual .toUpperCase() here.
function seriesStatusAfterGame(games, gameIndex, teamAId, teamBId) {
  let aWins = 0
  let bWins = 0
  for (let i = 0; i <= gameIndex; i++) {
    const g = games[i]
    const winnerId = g.awayScore > g.homeScore ? g.awayTeamId : g.homeTeamId
    if (winnerId === teamAId) aWins += 1
    else if (winnerId === teamBId) bWins += 1
  }
  const leadWins = Math.max(aWins, bWins)
  const trailWins = Math.min(aWins, bWins)
  if (gameIndex === games.length - 1) {
    const winnerId = aWins > bWins ? teamAId : teamBId
    return `${teamClubNameShort(winnerId)} win series ${leadWins}-${trailWins}`
  }
  if (aWins === bWins) return `Series tied ${aWins}-${bWins}`
  const leaderId = aWins > bWins ? teamAId : teamBId
  return `${teamClubNameShort(leaderId)} lead ${leadWins}-${trailWins}`
}

// Resolves the URL's seriesId against postseason-history.json (cached
// in-memory, same fetch PostseasonHistoryPage/the old bracket modal already
// use), then sweeps that series' handful of games for batting/pitching
// totals (loadSeriesStats), resolves each game's box-score link
// (fetchGameCardsByPk) — the exact live-resolve PostseasonSeriesModal used to
// do, now owned by this page since the modal is retired in favor of direct
// navigation — and pulls each game's full feed + win probability
// (usePastGameSignals) to render it as the same "revealed" result card the
// slate shows for a past, Final game (GameResultFace), rather than a bare
// score line. `usePastGameSignals`' own header warns it's only safe inside a
// reveal because a same-day game might still be live; that concern doesn't
// apply here — postseason-history.json only ever stores COMPLETED series, so
// every game this page touches is already Final, same footing as
// loadSeriesStats' own boxscore fetches needing no SealBox.
async function loadSeries(seriesId, getSignals) {
  const history = await loadPostseasonHistory()
  const series = findSeriesById(history, seriesId)
  if (!series) return null
  const [stats, cardsByPk, signalsEntries] = await Promise.all([
    loadSeriesStats(series.games),
    fetchGameCardsByPk(series.games.map((g) => g.gamePk)),
    Promise.all(
      series.games.map((g) =>
        getSignals(g.gamePk)
          .then((signals) => [g.gamePk, signals])
          .catch(() => [g.gamePk, null]),
      ),
    ),
  ])
  return { series, stats, cardsByPk, gameSignals: Object.fromEntries(signalsEntries) }
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
  const getSignals = usePastGameSignals()
  const { loading, error, data } = useAsync(() => loadSeries(seriesId, getSignals), [seriesId])

  useDocumentTitle(data?.series ? `${data.series.year} ${data.series.label}` : null)

  const gate = AsyncGate({ loading, error, data, screenClass: 'psseries', noun: 'series', onBack: back })
  if (gate) return gate

  const { series, stats, cardsByPk, gameSignals } = data
  const { teamA, teamB, winnerTeamId, mvp, label, year, isWorldSeries, games } = series
  const winner = winnerTeamId === teamA.teamId ? teamA : teamB
  const loser = winnerTeamId === teamA.teamId ? teamB : teamA
  const isFav = (teamId) => favoriteTeamId != null && teamId === favoriteTeamId
  const favStyle = (teamId) => (isFav(teamId) ? { '--fav-accent': favoriteAccentColor(teamId) } : undefined)
  const hasBatting = Object.values(stats.batting).some((v) => v.length > 0)
  const hasPitching = Object.values(stats.pitching).some((v) => v.length > 0)
  // Who took each game, in order — feeds the hero ledger's per-game win cells.
  // Same away/home score comparison seriesStatusAfterGame already relies on.
  const gameWinnerIds = games.map((g) => (g.awayScore > g.homeScore ? g.awayTeamId : g.homeTeamId))

  return (
    <div className="screen psseries">
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="topbar">
        <h1 className="topbar__title">
          {year} {label}
        </h1>
      </header>

      {/* The series-result hero: a navy pennant band declaring the outcome
          ("Brewers win in 5" — the clincher count IS games.length, since the
          history file only ever stores games actually played), over a
          scorebook ledger — one row per club, per-game win cells (an inked
          cell = that club took that game, so the row scans like a series
          linescore), and the series-wins total as the big right-hand figure.
          The World Series trophy folds into the band instead of floating
          above the card. */}
      <section className="psseries__result">
        <div className="psseries__banner">
          <h2 className="psseries__headline">
            {teamClubNameShort(winner.teamId)} win in {games.length}
          </h2>
          {isWorldSeries && (
            <img
              src="/brand/world-series-trophy.png"
              alt=""
              className="psseries__trophy"
              aria-hidden="true"
            />
          )}
        </div>
        <div className="psseries__ledger">
          {[winner, loser].map((team) => {
            const wonSeries = team.teamId === winner.teamId
            return (
              <div
                key={team.teamId}
                className={`psseries__team psseries__team--${wonSeries ? 'winner' : 'loser'}${isFav(team.teamId) ? ' psseries__team--fav' : ''}`}
                style={favStyle(team.teamId)}
              >
                <TeamLink id={team.teamId} className="psseries__teamlink">
                  <TeamLogo teamId={team.teamId} name={teamClubNameShort(team.teamId)} size={36} />
                  <span className="psseries__teamname">{teamClubNameShort(team.teamId)}</span>
                </TeamLink>
                {/* Decorative game-by-game trace — the row's series-wins figure
                    and the banner headline already carry the result for
                    assistive tech. */}
                <div className="psseries__cells" aria-hidden="true">
                  {games.map((g, i) => {
                    const wonGame = gameWinnerIds[i] === team.teamId
                    return (
                      <span
                        key={g.gameNumber}
                        className={`psseries__cell${wonGame ? ' psseries__cell--won' : ''}`}
                      >
                        {wonGame ? g.gameNumber : ''}
                      </span>
                    )
                  })}
                </div>
                <span className="psseries__wins">{team.wins}</span>
              </div>
            )
          })}
        </div>
      </section>

      <div className="psseries__games">
        {games.map((g, i) => {
          const card = cardsByPk?.[g.gamePk]
          const signals = gameSignals?.[g.gamePk]
          const boxScorePath = card
            ? gamePath(card.officialDate, card.away.abbreviation, card.home.abbreviation, 'boxscore', card.gameNumber)
            : null
          return (
            <div key={g.gameNumber} className="psseries__gamewrap">
              <div className="psseries__gamehead">
                <span className="psseries__gametitle">
                  Game {g.gameNumber} <span className="psseries__gamedate">{monthDayYear(g.date)}</span>
                </span>
                <span className="psseries__gamestatus">
                  {seriesStatusAfterGame(games, i, teamA.teamId, teamB.teamId)}
                </span>
              </div>
              {signals && boxScorePath ? (
                <div className="psseries__facewrap">
                  <GameResultFace feed={signals.feed} winProb={signals.winProb} boxScorePath={boxScorePath} />
                </div>
              ) : (
                <p className="hint hint--error">Couldn’t load this game’s result.</p>
              )}
            </div>
          )
        })}
      </div>

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

      <div className="psseries__rosters">
        <RosterCard teamId={winner.teamId} roster={stats.rosters[winner.teamId]} />
        <RosterCard teamId={loser.teamId} roster={stats.rosters[loser.teamId]} />
      </div>
    </div>
  )
}

// One team's series roster — every player who dressed for at least one game
// of the series (see loadSeriesStats/rosterEntry), split into position
// players and pitchers. Deliberately no favoriteTeamId highlight here: this
// is a reference list of who was ON the roster, not a ranked/comparative
// board like the result banner or the leader sections above it.
function RosterCard({ teamId, roster }) {
  const positionPlayers = roster?.positionPlayers ?? []
  const pitchers = roster?.pitchers ?? []
  if (positionPlayers.length === 0 && pitchers.length === 0) return null
  return (
    <section className="psseries__rostercard">
      <div className="psseries__rosterhead">
        <TeamLogo teamId={teamId} name={teamClubNameShort(teamId)} size={24} />
        <span className="psseries__rosterteam">{teamClubNameShort(teamId)} roster</span>
      </div>
      {positionPlayers.length > 0 && (
        <RosterGroup title="Position players" rows={positionPlayers} />
      )}
      {pitchers.length > 0 && <RosterGroup title="Pitchers" rows={pitchers} />}
    </section>
  )
}

// Same bordered-card/hairline-divided row list as the Team page's Current
// Roster (.thub-roster/.thub-row — see RosterList in TeamPage.jsx): jersey
// number, name, a position badge, and a trailing chevron affordance. Kept as
// its own scoped `psseries__roster*` class family rather than importing
// TeamPage's classes directly (same convention AllStarRostersPage's
// `.allstarrosters__rows` already follows — a shared visual idiom, not a
// shared stylesheet dependency), since this row carries none of the Current
// Roster's live-context badges (WAR, All-Star star, injured mark, prospect/
// rookie pills) — none of that applies to a decades-old completed series.
function RosterGroup({ title, rows }) {
  return (
    <div className="psseries__rostergroup">
      <h4 className="psseries__rostergrouptitle">{title}</h4>
      <ul className="psseries__rosterlist">
        {rows.map((p) => (
          <li key={p.id} className="psseries__rosterrow">
            <span className="psseries__rosternum">{p.jersey}</span>
            <PlayerLink id={p.id} className="psseries__rostername">
              {p.name}
            </PlayerLink>
            <span className="psseries__rosterpos">{p.position}</span>
            <span className="psseries__rosterchev">›</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
