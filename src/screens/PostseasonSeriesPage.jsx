import '../styles/35-postseason-series.css'
import { loadPostseasonHistory } from '../api/postseasonHistory.js'
import {
  loadSeriesStats,
  findSeriesById,
  BATTING_CATEGORIES,
  SERIES_PITCHING_CATEGORIES,
} from '../api/postseasonSeries.js'
import { fetchGameCardsByPk } from '../api/schedule.js'
import { computePlayOfTheGame } from '../api/boxscore.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { usePastGameSignals } from '../hooks/usePastGameSignals.js'
import { gamePath } from '../lib/route.js'
import { teamClubNameShort } from '../lib/teams.js'
import { TeamLink } from '../components/team/TeamLink.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { Headshot } from '../components/player/Headshot.jsx'
import { PlayerLink } from '../components/player/PlayerLink.jsx'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../components/ui/AsyncGate.jsx'
import { GameResultFace } from '../components/game/GameResultFace.jsx'
import { SectionHead } from '../components/ui/frame/SectionHead.jsx'
import { Card } from '../components/ui/frame/Card.jsx'
import { SeriesPlayOfTheGame, SeriesLeaderBoard, RosterCard } from '../components/postseason/SeriesParts.jsx'
import { monthDay } from '../components/postseason/monthDay.js'
import { SeriesMark } from '../components/postseason/SeriesMark.jsx'
import { seriesMarkForHistory } from '../lib/postseason/seriesMarks.js'


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
// past series' result carries no LIVE game's spoiler risk. Deliberately no
// favoriteTeamId highlight anywhere on this page (result banner, leader
// boards, or rosters) — every club that reached the same round is shown on
// equal footing.
export function PostseasonSeriesPage({ seriesId }) {
  const back = () => window.history.back()
  const getSignals = usePastGameSignals()
  const { loading, error, data } = useAsync(() => loadSeries(seriesId, getSignals), [seriesId])

  useDocumentTitle(data?.series ? `${data.series.year} ${data.series.label}` : null)

  const gate = AsyncGate({ loading, error, data, screenClass: 'psseries', noun: 'series', onBack: back })
  if (gate) return gate

  const { series, stats, cardsByPk, gameSignals } = data
  const { teamA, teamB, winnerTeamId, mvp, label, year, isWorldSeries, games } = series
  const winner = winnerTeamId === teamA.teamId ? teamA : teamB
  const loser = winnerTeamId === teamA.teamId ? teamB : teamA
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
      <Card body="flush" className="psseries__result">
        <div className="psseries__banner">
          <h2 className="psseries__headline">
            {teamClubNameShort(winner.teamId)} win in {games.length}
          </h2>
          {/* 2026 on: the round's own mark (null for a season with no art). */}
          <SeriesMark mark={seriesMarkForHistory(series)} height={40} decorative className="psseries__mark" />
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
                className={`psseries__team psseries__team--${wonSeries ? 'winner' : 'loser'}`}
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
      </Card>

      {/* Game-by-game log — the series as ONE continuous scorebook ledger
          rather than a stack of separate captioned cards: a double clay
          margin rule down the left (the red margin line every paper ledger
          carries), each game an entry indexed by the same inked number-cell
          idiom the result banner's win trace uses, so the banner's cells
          double as this log's index. Each entry heads with the date and the
          series record AS OF that game (seriesStatusAfterGame; the
          clincher's line inks in medal amber), then splits into the same
          "revealed" result card the slate shows for a past Final game
          (GameResultFace, de-chromed by the .psseries__facewrap overrides in
          index.css so it reads as lines IN the ledger) alongside a
          headshot-led Play of the Game panel (SeriesPlayOfTheGame) built from
          the SAME computePlayOfTheGame call GameResultFace makes internally
          — passing GameResultFace `hidePlayOfGame` so its own compact
          text-only version doesn't also render, and letting this roomier
          version fill the ledger row's wide second column instead of leaving
          it mostly-empty next to the short R/H/E block. The Series MVP
          (LCS/World Series only — earlier rounds carry no official MVP, and
          the band simply doesn't render) closes the log as a medal-amber
          award line under the clinching entry, the same --award-line trim
          the banner's seam wears. */}
      <section className="psseries__games">
        <SectionHead look="label">Game by game</SectionHead>
        <Card as="div" body="flush" className="psseries__log">
          <div className="psseries__logbody">
            {games.map((g, i) => {
              const card = cardsByPk?.[g.gamePk]
              const signals = gameSignals?.[g.gamePk]
              const boxScorePath = card
                ? gamePath(card.officialDate, card.away.abbreviation, card.home.abbreviation, 'boxscore', card.gameNumber)
                : null
              const isClincher = i === games.length - 1
              const potg = signals ? computePlayOfTheGame(signals.winProb, signals.feed) : null
              return (
                <article key={g.gameNumber} className="psseries__entry" aria-label={`Game ${g.gameNumber}`}>
                  {/* Decorative index stamp — the aria-label above already
                      names the game for assistive tech. */}
                  <span className="psseries__gamenum" aria-hidden="true">
                    {g.gameNumber}
                  </span>
                  <div className="psseries__entryhead">
                    <span className="psseries__gamedate">{monthDay(g.date)}</span>
                    <span
                      className={`psseries__gamestatus${isClincher ? ' psseries__gamestatus--final' : ''}`}
                    >
                      {seriesStatusAfterGame(games, i, teamA.teamId, teamB.teamId)}
                    </span>
                  </div>
                  {signals && boxScorePath ? (
                    <>
                      <div className="psseries__facewrap">
                        <GameResultFace
                          feed={signals.feed}
                          winProb={signals.winProb}
                          boxScorePath={boxScorePath}
                          hidePlayOfGame
                        />
                      </div>
                      <SeriesPlayOfTheGame
                        potg={potg}
                        awayAbbr={card.away.abbreviation}
                        homeAbbr={card.home.abbreviation}
                      />
                    </>
                  ) : (
                    <p className="hint hint--error">Couldn’t load this game’s result.</p>
                  )}
                </article>
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
        </Card>
      </section>

      {(hasBatting || hasPitching) && (
        <div className="psseries__leaders">
          {hasBatting && (
            <SeriesLeaderBoard title="Series batting leaders" categories={BATTING_CATEGORIES} byCategory={stats.batting} />
          )}
          {hasPitching && (
            <SeriesLeaderBoard
              title="Series pitching leaders"
              categories={SERIES_PITCHING_CATEGORIES}
              byCategory={stats.pitching}
            />
          )}
        </div>
      )}

      <div className="psseries__rosters">
        <RosterCard teamId={winner.teamId} roster={stats.rosters[winner.teamId]} />
        <RosterCard teamId={loser.teamId} roster={stats.rosters[loser.teamId]} />
      </div>
    </div>
  )
}
