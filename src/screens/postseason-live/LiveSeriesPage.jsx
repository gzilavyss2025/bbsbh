import '../../styles/35-postseason-series.css'
import '../../styles/postseason/series-parts.css'
import '../../styles/postseason/series-abs.css'
import '../../styles/postseason/series-live.css'
import { useMemo } from 'react'
import { usePostseasonBracket } from '../../hooks/postseason/usePostseasonBracket.js'
import { bestOfLine, cardLines, recordLine, roundTitle } from '../../api/postseason/text.js'
import { fetchUpcomingSeriesGames } from '../../api/postseason/upcoming.js'
import { loadNineKeys } from '../../api/nineKeys.js'
import { formerTeammatePairs, loadFormerTeammates } from '../../api/formerTeammates.js'
import { fetchSeriesRoster, rosterReadDate } from '../../api/postseason/roster.js'
import { loadSeriesStats, BATTING_CATEGORIES, SERIES_PITCHING_CATEGORIES } from '../../api/postseasonSeries.js'
import { fetchGameCardsByPk, fetchSchedule } from '../../api/schedule.js'
import { computePlayOfTheGame } from '../../api/boxscore.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { usePastGameSignals } from '../../hooks/usePastGameSignals.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { dayShape } from '../../lib/postseason/dayShape.js'
import { gamePath } from '../../lib/route.js'
import { useNav } from '../../lib/nav.js'
import { monthDayName, toApiDate } from '../../lib/dates.js'
import { teamClubNameShort } from '../../lib/teams.js'
import { TeamLink } from '../../components/team/TeamLink.jsx'
import { TeamLogo } from '../../components/logo/TeamLogo.jsx'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { BackBtn } from '../../components/chrome/BackBtn.jsx'
import { AsyncGate } from '../../components/ui/AsyncGate.jsx'
import { GameResultFace } from '../../components/game/GameResultFace.jsx'
import { GameCard } from '../../components/game/GameCard.jsx'
import { SectionHead } from '../../components/ui/frame/SectionHead.jsx'
import { Card } from '../../components/ui/frame/Card.jsx'
import { Notice } from '../../components/ui/state/Notice.jsx'
import { seriesGameBuckets } from './selectors.js'
import { SeriesPlayOfTheGame, SeriesLeaderBoard, RosterCard } from '../../components/postseason/SeriesParts.jsx'
import { StillToPlay } from '../../components/postseason/StillToPlay.jsx'
import { SeriesStarters } from '../../components/postseason/SeriesStarters.jsx'
import { SeriesFlow } from '../../components/postseason/SeriesFlow.jsx'
import { SeriesTotals } from '../../components/postseason/SeriesTotals.jsx'
import { SeriesNineKeys } from '../../components/postseason/SeriesNineKeys.jsx'
import { SeriesAbsReport } from '../../components/postseason/SeriesAbsReport.jsx'
import { SeasonSeriesStrip } from '../../components/teamstats/SeasonSeriesStrip.jsx'
import { FormerTeammates } from '../../components/team/FormerTeammates.jsx'
import { seriesMark } from '../../lib/postseason/seriesMarks.js'
import { SeriesMark } from '../../components/postseason/SeriesMark.jsx'


// The record AS OF one logged game, in the same three wordings recordLine
// (text.js) uses for the series' current state — mirrored here rather than
// reused because a Series' `games` carry a winnerId, not two scores, so the
// tally itself is simpler than PostseasonSeriesPage.jsx's seriesStatusAfterGame.
function recordAfterGame(series, index) {
  const [a, b] = series.slots
  let aWins = 0
  let bWins = 0
  for (let i = 0; i <= index; i++) {
    const winnerId = series.games[i].winnerId
    if (winnerId === a.club?.id) aWins += 1
    else if (winnerId === b.club?.id) bWins += 1
  }
  const hi = Math.max(aWins, bWins)
  const lo = Math.min(aWins, bWins)
  const isClincher = series.decided && index === series.games.length - 1
  if (isClincher) return `${series.winner.abbreviation} won ${hi}–${lo}`
  if (aWins === bWins) return `Series tied ${hi}–${lo}`
  const leader = aWins > bWins ? a.club : b.club
  return `${leader?.abbreviation ?? ''} leads ${hi}–${lo}`
}

// Sweeps only the ALREADY-COUNTED games (before the cutoff) for their box
// scores, cards and win-probability signals — the same footing as
// PostseasonSeriesPage.jsx's loadSeries, minus the postseason-history.json
// read this page skips: `games` comes straight off the bracket Series. Never
// called with the cutoff game or an upcoming one — loadSeriesStats fetches a
// `/boxscore` per game, which for a still-live game would resolve its score.
async function loadGameLog(games, getSignals) {
  const [stats, cardsByPk, signalsEntries] = await Promise.all([
    loadSeriesStats(games),
    fetchGameCardsByPk(games.map((g) => g.gamePk)),
    Promise.all(
      games.map((g) =>
        getSignals(g.gamePk)
          .then((signals) => [g.gamePk, signals])
          .catch(() => [g.gamePk, null]),
      ),
    ),
  ])
  return { stats, cardsByPk, gameSignals: Object.fromEntries(signalsEntries) }
}

const EMPTY_LOG = { stats: null, cardsByPk: {}, gameSignals: {} }

// Live Postseason Series: a series still in progress, or a 2026 series that
// finished but has nowhere else to go yet — postseason-history.json only
// gets a season once its whole World Series is Final, via a hand-run script
// (trap 7, docs/api/postseason.md), so any 2026 series opens here regardless
// of `decided`. Same sections as the finished page (record, game-by-game log,
// series leaders, rosters), plus two this page alone needs: today's game
// (named, never scored) and the games still to play. The cutoff is this
// page's own `?d=` (asOf), capped at today by usePostseasonBracket — never
// Scores Unlocked, which does not apply to the postseason bracket (ADR-0087).
export function LiveSeriesPage({ seriesId, asOf }) {
  const back = () => window.history.back()
  const cutoffInput = asOf ?? toApiDate(new Date())
  // The season rides along in the id itself ({year}-{round}-{awayId}-{homeId}),
  // so there is no need to infer it from the cutoff's own year.
  const season = Number(String(seriesId).split('-')[0]) || undefined
  const { bracket, loading: bracketLoading, error: bracketError, cutoff } = usePostseasonBracket(cutoffInput, {
    season,
  })
  const series = bracket?.series.find((s) => s.id === seriesId) ?? null

  // Each club's declared roster: its active roster on the last date the
  // series played by the cutoff (api/postseason/roster.js has the why).
  // Before Game 1 day, its current roster stands in. A failed read falls
  // back to the box-score roster.
  const rosterDate = rosterReadDate(series, cutoff)
  const rosterClubIds = (series?.slots ?? []).map((slot) => slot.club?.id).filter(Boolean)
  const { data: declaredRosters } = useAsync(
    (signal) =>
      rosterDate && rosterClubIds.length
        ? Promise.all(rosterClubIds.map((id) => fetchSeriesRoster(id, series, cutoff, { signal }).catch(() => null)))
        : Promise.resolve(null),
    [rosterDate, rosterClubIds.join(',')],
  )

  // Today's game as the home slate draws it. The slate fetch's field list has
  // no score in it, and the card is handed no `liveLine`, so nothing here can
  // spoil the game; a failed read only drops the card.
  const navigate = useNav()
  const todayPk = series?.cutoffGame?.gamePk ?? null
  const { data: todayGame } = useAsync(
    () =>
      todayPk
        ? fetchSchedule(cutoffInput).then((rows) => rows.find((g) => g.gamePk === todayPk) ?? null)
        : Promise.resolve(null),
    [todayPk, cutoffInput],
  )

  const getSignals = usePastGameSignals()
  const games = series?.games ?? []
  const gamePks = games.map((g) => g.gamePk).join(',')
  const { loading: logLoading, error: logError, data: log } = useAsync(
    () => (games.length ? loadGameLog(games, getSignals) : Promise.resolve(EMPTY_LOG)),
    [gamePks],
  )

  // The three game buckets, sorted once: counted results, today's game, the
  // games still ahead (today excluded). Null-safe before the series loads.
  const buckets = useMemo(() => seriesGameBuckets(series), [series])
  const { favoriteTeamId } = useFavoriteTeam()

  // The park and announced probables of today's game and every DATED game
  // ahead. An "if necessary" game has no gamePk and is never asked for. The read
  // carries no result field (api/postseason/upcoming.js).
  const detailPks = [todayPk, ...buckets.upcoming.map((g) => g.gamePk)].filter(Boolean)
  const { data: details } = useAsync(
    () => fetchUpcomingSeriesGames(detailPks),
    [detailPks.join(',')],
  )
  // Regular-season ranks for the Nine Keys cut, and the former-teammate shard
  // for the two clubs (a static file; no shard for a matchup outside the
  // nightly build's day window, which just hides the card).
  const { data: nineKeys } = useAsync(() => loadNineKeys(), [])
  const { data: teammatesData } = useAsync(
    () => (rosterClubIds.length === 2 ? loadFormerTeammates(rosterClubIds[0], rosterClubIds[1]) : Promise.resolve(null)),
    [rosterClubIds.join(',')],
  )
  // Announced probables for the games AHEAD show only on today's page: on a
  // past `?d=` the schedule now names the starter who really pitched, picked
  // after that date. Today's own game keeps its probables either way.
  const showArms = cutoff === toApiDate(new Date())
  // The next game the page can describe: today's, else (on today's page) the
  // first DATED game ahead. Its announced starters feed the starters card and
  // mark the ladder's starters.
  const nextRow = buckets.today ?? (showArms ? buckets.upcoming.find((g) => g.gamePk) : null) ?? null
  const nextDetail = nextRow?.gamePk ? (details?.[nextRow.gamePk] ?? null) : null
  const startingKey = [nextDetail?.away?.id, nextDetail?.home?.id].filter(Boolean).join(',')
  const startingIds = useMemo(() => new Set(startingKey ? startingKey.split(',').map(Number) : []), [startingKey])
  const clubKey = rosterClubIds.join(',')
  const teammatePairs = useMemo(() => {
    const [a, b] = clubKey.split(',').map(Number)
    return formerTeammatePairs(teammatesData, a, b)
  }, [teammatesData, clubKey])
  const homeIdByPk = useMemo(
    () => Object.fromEntries(Object.entries(log?.cardsByPk ?? {}).map(([pk, c]) => [pk, c.home?.id])),
    [log],
  )

  useDocumentTitle(series ? `${bracket.season} ${series.name}` : null)

  const bracketGate = AsyncGate({
    loading: bracketLoading,
    error: bracketError,
    data: bracket,
    screenClass: 'psseries pslive',
    noun: 'series',
    onBack: back,
  })
  if (bracketGate) return bracketGate
  const seriesGate = AsyncGate({
    loading: false,
    error: null,
    data: series,
    screenClass: 'psseries pslive',
    noun: 'series',
    onBack: back,
  })
  if (seriesGate) return seriesGate

  const { results, today, upcoming } = buckets
  const { stats, cardsByPk, gameSignals } = log ?? EMPTY_LOG
  const hasBatting = stats && Object.values(stats.batting).some((v) => v.length > 0)
  const hasPitching = stats && Object.values(stats.pitching).some((v) => v.length > 0)
  const clubs = series.slots.map((slot) => slot.club).filter(Boolean)
  const rosterCards = clubs
    .map((club) => ({
      club,
      roster: declaredRosters?.[rosterClubIds.indexOf(club.id)] ?? stats?.rosters?.[club.id] ?? null,
    }))
    .filter(({ roster }) => roster)

  // WHEN AND WHERE. The game before today's (or before the first row ahead),
  // for the off-day and travel words.
  const lastCounted = results.at(-1) ?? null
  const afterCounted = lastCounted
    ? { date: lastCounted.date, venueId: cardsByPk?.[lastCounted.gamePk]?.venue?.id ?? null }
    : null
  const todayDetail = today?.gamePk ? (details?.[today.gamePk] ?? null) : null
  const todayWords = todayDetail
    ? [`Game ${today.gameNumber}`, todayDetail.venue.name, dayShape(afterCounted, { date: cutoff, venueId: todayDetail.venue.id })]
        .filter(Boolean)
        .join(' · ')
    : null
  const beforeUpcoming = today ? { date: cutoff, venueId: todayDetail?.venue.id ?? null } : afterCounted
  // Game 1's date bounds the leader sheets' rows to this series (with the
  // cutoff as their end); with no counted game there is no board to open.
  const seriesFrom = results[0]?.date ?? null
  const leaderDoors = (group) =>
    seriesFrom && {
      group,
      cutoff,
      from: seriesFrom,
      seriesName: series.name,
      roundTitle: roundTitle(series),
      opponentOf: (id) => clubs.find((c) => c.id !== id)?.id ?? null,
    }

  return (
    <div className="screen psseries pslive">
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="topbar">
        <h1 className="topbar__title">{series.name}</h1>
      </header>

      {/* The result hero, reusing the finished page's exact banner/ledger
          classes (.psseries__result etc.) — but the headline is recordLine's
          state ("Series tied 1–1", "CHC leads 2–1", or a decided
          series' own "TOR won 3–1": trap 7 means a decided 2026 series
          still opens here) rather than a clinch declaration, since this page
          may render before there IS one. Each club's win trace is the same
          inked-cell ledger idiom (.psseries__cell--won); winner/loser tinting
          applies only once the series actually is decided. */}
      <Card body="flush" className="psseries__result">
        <div className="psseries__banner">
          <h2 className="psseries__headline">{results.length === 0 ? bestOfLine(series) : recordLine(series)}</h2>
          <SeriesMark
            mark={seriesMark({ season: bracket.season, round: series.round, league: series.league })}
            height={40}
            decorative
            className="psseries__mark"
          />
        </div>
        <div className="psseries__ledger">
          {clubs.map((club) => {
            const wins = series.slots.find((slot) => slot.club?.id === club.id)?.wins ?? 0
            const isWinner = series.decided && series.winner?.id === club.id
            const isLoser = series.decided && series.eliminated?.id === club.id
            return (
              <div
                key={club.id}
                className={`psseries__team${isWinner ? ' psseries__team--winner' : ''}${isLoser ? ' psseries__team--loser' : ''}`}
              >
                <TeamLink id={club.id} className="psseries__teamlink">
                  <TeamLogo teamId={club.id} name={teamClubNameShort(club.id)} size={32} />
                  <span className="psseries__teamname">{teamClubNameShort(club.id)}</span>
                </TeamLink>
                <div className="psseries__cells" aria-hidden="true">
                  {results.map((g) => (
                    <span
                      key={g.gameNumber}
                      className={`psseries__cell${g.winnerId === club.id ? ' psseries__cell--won' : ''}`}
                    >
                      {g.winnerId === club.id ? g.gameNumber : ''}
                    </span>
                  ))}
                </div>
                <span className="psseries__wins">{wins}</span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Today's game — the home slate's own card, never scored. It is handed
          no score line, and no feed or box-score fetch ever runs for this
          gamePk on this page (root CLAUDE.md's spoiler rule). */}
      {today && todayGame && (
        <section className="psseries__today">
          <SectionHead look="label" note={todayWords}>
            Today
          </SectionHead>
          <GameCard
            game={todayGame}
            postseasonLine={cardLines(todayGame, bracket)}
            onSelect={() =>
              navigate(
                gamePath(
                  todayGame.officialDate,
                  todayGame.away.abbreviation,
                  todayGame.home.abbreviation,
                  'lineup1',
                  todayGame.gameNumber,
                ),
              )
            }
          />
        </section>
      )}

      {!series.decided && nextDetail && (
        <SeriesStarters
          head={today ? 'Starting pitchers' : 'Next game'}
          note={[`Game ${nextRow.gameNumber}`, today ? nextDetail.venue.name : monthDayName(nextDetail.date)]
            .filter(Boolean)
            .join(' · ')}
          game={nextDetail}
          season={bracket.season}
          cutoff={cutoff}
        />
      )}

      <StillToPlay
        games={upcoming}
        details={details}
        previous={beforeUpcoming}
        showArms={showArms}
        formatDate={monthDayName}
      />

      {results.length > 0 && clubs.length === 2 && (
        <SeriesFlow
          series={buckets}
          gameSignals={gameSignals}
          homeIdByPk={homeIdByPk}
          clubs={clubs}
          defaultId={clubs.some((c) => c.id === favoriteTeamId) ? favoriteTeamId : clubs[1].id}
        />
      )}

      {results.length > 0 && (
        <section className="psseries__games">
          <SectionHead look="label">Game by game</SectionHead>
          <Card as="div" body="flush" className="psseries__log">
            <div className="psseries__logbody">
              {results.map((g, i) => {
                const card = cardsByPk?.[g.gamePk]
                const signals = gameSignals?.[g.gamePk]
                const boxScorePath = card
                  ? gamePath(card.officialDate, card.away.abbreviation, card.home.abbreviation, 'boxscore', card.gameNumber)
                  : null
                const potg = signals ? computePlayOfTheGame(signals.winProb, signals.feed) : null
                const isClincher = series.decided && i === results.length - 1
                return (
                  <article key={g.gameNumber} id={`game-${g.gameNumber}`} className="psseries__entry" aria-label={`Game ${g.gameNumber}`}>
                    <span className="psseries__gamenum" aria-hidden="true">
                      {g.gameNumber}
                    </span>
                    <div className="psseries__entryhead">
                      <span className="psseries__gamedate">{monthDayName(g.date)}</span>
                      {card?.venue?.name && <span className="psseries__gamevenue">{card.venue.name}</span>}
                      <span className={`psseries__gamestatus${isClincher ? ' psseries__gamestatus--final' : ''}`}>
                        {recordAfterGame(series, i)}
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
                          gamePk={g.gamePk}
                          awayAbbr={card.away.abbreviation}
                          homeAbbr={card.home.abbreviation}
                        />
                      </>
                    ) : (
                      <Notice tone="error" size="compact" className="psseries__entryerror">Couldn’t load this game’s result.</Notice>
                    )}
                  </article>
                )
              })}
            </div>
          </Card>
        </section>
      )}

      {logLoading && !stats && results.length > 0 && <p className="hint">Loading the series so far…</p>}
      {logError && !stats && results.length > 0 && (
        <Notice tone="error" className="pslive__notice">Couldn’t load this series’ leaders and rosters.</Notice>
      )}

      {stats?.totals && clubs.length === 2 && <SeriesTotals totals={stats.totals} clubs={clubs} />}

      {(hasBatting || hasPitching) && (
        <div className="psseries__leaders">
          {hasBatting && (
            <SeriesLeaderBoard
              title="Series batting leaders"
              categories={BATTING_CATEGORIES}
              byCategory={stats.batting}
              doors={leaderDoors('hitting')}
            />
          )}
          {hasPitching && (
            <SeriesLeaderBoard
              title="Series pitching leaders"
              categories={SERIES_PITCHING_CATEGORIES}
              byCategory={stats.pitching}
              doors={leaderDoors('pitching')}
            />
          )}
        </div>
      )}

      {clubs.length === 2 && (
        <>
          <SeasonSeriesStrip
            viewingTeamId={clubs[1].id}
            opponentId={clubs[0].id}
            officialDate={cutoff}
            sportId={1}
            gameTypes="R"
            settled
            look="label"
            title="Regular season"
          />
          <SeriesNineKeys data={nineKeys} clubs={clubs} season={bracket.season} />
          <SeriesAbsReport
            season={bracket.season}
            clubIds={clubs.map((c) => c.id)}
            gamePks={games.map((g) => g.gamePk)}
            cutoff={cutoff}
          />
          <FormerTeammates
            pairs={teammatePairs}
            startingIds={startingIds}
            dayNight=""
            away={{ id: clubs[0].id, teamName: teamClubNameShort(clubs[0].id) }}
            home={{ id: clubs[1].id, teamName: teamClubNameShort(clubs[1].id) }}
          />
        </>
      )}

      {rosterCards.some(({ roster }) => roster.declared === false) && (
        <p className="hint">
          Each club names its postseason roster on the morning of Game 1. Until then, this is its current roster.
        </p>
      )}
      {rosterCards.length > 0 && (
        <div className="psseries__rosters">
          {rosterCards.map(({ club, roster }) => (
            <RosterCard key={club.id} teamId={club.id} roster={roster} />
          ))}
        </div>
      )}
    </div>
  )
}
