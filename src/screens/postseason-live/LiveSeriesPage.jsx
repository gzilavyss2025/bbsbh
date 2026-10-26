import '../../styles/35-postseason-series.css'
import '../../styles/postseason/series-parts.css'
import '../../styles/postseason/series-abs.css'
import '../../styles/postseason/series-live.css'
import '../../styles/worldseries/home.css'
import '../../styles/worldseries/square.css'
import { Fragment, useMemo, useState } from 'react'
import { usePostseasonBracket } from '../../hooks/postseason/usePostseasonBracket.js'
import { cardLines, roundTitle } from '../../api/postseason/text.js'
import { fetchUpcomingSeriesGames } from '../../api/postseason/upcoming.js'
import { loadNineKeys } from '../../api/nineKeys.js'
import { formerTeammatePairs, loadFormerTeammates } from '../../api/formerTeammates.js'
import { fetchSeriesRoster, rosterReadDate } from '../../api/postseason/roster.js'
import { BATTING_CATEGORIES, SERIES_PITCHING_CATEGORIES } from '../../api/postseasonSeries.js'
import { fetchScheduleGame } from '../../api/schedule.js'
import { fetchMeetings } from '../../api/postseason/meetings.js'
import { computePlayOfTheGame } from '../../api/boxscore.js'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { EMPTY_LOG, useSeriesLog } from '../../hooks/postseason/useSeriesLog.js'
import { useWorldSeriesView } from '../../hooks/postseason/useWorldSeriesView.js'
import { useMediaQuery, WIDE_QUERY } from '../../hooks/useMediaQuery.js'
import { useFavoriteTeam } from '../../hooks/preferences/useFavoriteTeam.js'
import { seriesGroups } from '../../lib/postseason/worldseries/groups.js'
import { lcsRoundOf, seriesMode } from '../../lib/postseason/worldseries/mode.js'
import { dayShape } from '../../lib/postseason/dayShape.js'
import { recordAfterGame } from '../../lib/postseason/primer/recordAfter.js'
import { gamePath } from '../../lib/route.js'
import { useNav } from '../../lib/nav.js'
import { monthDayName, toApiDate } from '../../lib/dates.js'
import { teamClubNameShort } from '../../lib/teams.js'
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
import { Flow } from '../../components/worldseries/Flow.jsx'
import { ResultBanner } from './ResultBanner.jsx'
import { Hero } from '../../components/worldseries/Hero.jsx'
import { Reel } from '../../components/worldseries/Reel.jsx'
import { ScoutingReport } from '../../components/worldseries/ScoutingReport.jsx'
import { GroupJump, Group } from '../../components/worldseries/GroupJump.jsx'
import { Bullpen } from '../../components/worldseries/cards/Bullpen.jsx'
import { HomeRoad } from '../../components/worldseries/cards/HomeRoad.jsx'
import { HotBats } from '../../components/worldseries/cards/HotBats.jsx'
import { Tape } from '../../components/worldseries/cards/Tape.jsx'
import { Trip } from '../../components/worldseries/cards/Trip.jsx'
import { FilmRoom } from '../../components/worldseries/cards/scouting/FilmRoom.jsx'


// Live Postseason Series: a series still in progress, or a 2026 series that
// finished but has nowhere else to go yet — postseason-history.json only
// gets a season once its whole World Series is Final, via a hand-run script
// (trap 7, docs/api/postseason.md), so any 2026 series opens here regardless
// of `decided`. Same sections as the finished page (record, game-by-game log,
// series leaders, rosters), plus two this page alone needs: today's game
// (named, never scored) and the games still to play. The cutoff is this
// page's own `?d=` (asOf), capped at today by usePostseasonBracket, and
// nothing else moves it (ADR-0087).
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
        ? fetchScheduleGame(cutoffInput, todayPk)
        : Promise.resolve(null),
    [todayPk, cutoffInput],
  )

  const games = series?.games ?? []
  const { loading: logLoading, error: logError, data: log } = useSeriesLog(games)

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

  // The World Series gets the home page's pieces in jump-bar groups; every other round keeps the
  // original order. A decided Series keeps its banner (its headline names the winner).
  const mode = series?.round === 'worldseries' ? seriesMode(series) : null
  // The World Series page draws every block as a stamped card; the other rounds keep the sheet look.
  const ws = Boolean(mode)
  const wide = useMediaQuery(WIDE_QUERY)
  const view = useWorldSeriesView(mode, cutoff)
  const [scoutShown, setScoutShown] = useState(false)
  const [clubA, clubB] = view.clubIds ?? []
  // The clubs' regular-season meetings, read to the day before the cutoff (the Scouting band's own read).
  const { data: meetings } = useAsync(
    (signal) => (mode ? fetchMeetings({ clubA, clubB, slateDate: cutoff }, { signal }) : Promise.resolve(null)),
    [mode ? 1 : 0, clubA, clubB, cutoff],
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

  // Every section is a value, so the World Series layout (groups) and every other round
  // (the original order) draw the same parts.
  const resultBanner = <ResultBanner series={series} results={results} clubs={clubs} season={bracket.season} />
  const pair = clubs.length === 2
  // Today's game — the home slate's own card, never scored. It is handed no score line, and no
  // feed or box-score fetch ever runs for this gamePk on this page (root CLAUDE.md's spoiler rule).
  const todayEl = today && todayGame && (
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
      )
  const startersEl = !series.decided && nextDetail && (
        <SeriesStarters
          head={today ? 'Starting pitchers' : 'Next game'}
          note={[`Game ${nextRow.gameNumber}`, today ? nextDetail.venue.name : monthDayName(nextDetail.date)]
            .filter(Boolean)
            .join(' · ')}
          tag={[`Game ${nextRow.gameNumber}`, today ? null : monthDayName(nextDetail.date)].filter(Boolean).join(' · ')}
          stamped={ws}
          game={nextDetail}
          season={bracket.season}
          cutoff={cutoff}
          worldSeries={series.round === 'worldseries'}
        />
      )
  const stillEl = (
      <StillToPlay
        games={upcoming}
        details={details}
        previous={beforeUpcoming}
        showArms={showArms}
        formatDate={monthDayName}
        stamped={ws}
      />
  )
  const flowEl = results.length > 0 && clubs.length === 2 && (
        <SeriesFlow
          series={buckets}
          gameSignals={gameSignals}
          homeIdByPk={homeIdByPk}
          clubs={clubs}
          defaultId={clubs.some((c) => c.id === favoriteTeamId) ? favoriteTeamId : clubs[1].id}
          stamped={ws}
        />
      )
  const GamesWrap = ws ? Fragment : 'section'
  const gamesEl = results.length > 0 && (
        <GamesWrap {...(ws ? null : { className: 'psseries__games' })}>
          {!ws && <SectionHead look="label">Game by game</SectionHead>}
          <Card as="div" body="flush" className="psseries__log" {...(ws ? { frame: 'stamped', label: 'Game by game', labelAs: 'h3' } : null)}>
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
                            boxScorePath={boxScorePath}
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
        </GamesWrap>
  )
  const noticesEl = (
    <>
      {logLoading && !stats && results.length > 0 && <p className="hint">Loading the series so far…</p>}
      {logError && !stats && results.length > 0 && (
        <Notice tone="error" className="pslive__notice">Couldn’t load this series’ leaders and rosters.</Notice>
      )}
    </>
  )
  const totalsEl = stats?.totals && clubs.length === 2 && <SeriesTotals totals={stats.totals} clubs={clubs} stamped={ws} labelAs="h3" />
  const leadersEl = (hasBatting || hasPitching) && (
        <div className="psseries__leaders">
          {hasBatting && (
            <SeriesLeaderBoard
              title={ws ? 'Batting leaders' : 'Series batting leaders'}
              categories={BATTING_CATEGORIES}
              byCategory={stats.batting}
              doors={leaderDoors('hitting')}
              stamped={ws}
            />
          )}
          {hasPitching && (
            <SeriesLeaderBoard
              title={ws ? 'Pitching leaders' : 'Series pitching leaders'}
              categories={SERIES_PITCHING_CATEGORIES}
              byCategory={stats.pitching}
              doors={leaderDoors('pitching')}
              stamped={ws}
            />
          )}
        </div>
      )
  const stripEl = pair && (
          <SeasonSeriesStrip
            viewingTeamId={clubs[1].id}
            opponentId={clubs[0].id}
            officialDate={cutoff}
            sportId={1}
            gameTypes="R"
            settled
            look={ws ? 'stamped' : 'label'}
            title="Regular season"
          />
  )
  const nineEl = pair && (
          <SeriesNineKeys data={nineKeys} clubs={clubs} season={bracket.season} />
  )
  const absEl = pair && (
          <SeriesAbsReport
            season={bracket.season}
            clubIds={clubs.map((c) => c.id)}
            gamePks={games.map((g) => g.gamePk)}
            cutoff={cutoff}
            stamped={ws}
          />
  )
  const matesEl = pair && (
          <FormerTeammates
            pairs={teammatePairs}
            startingIds={startingIds}
            dayNight=""
            away={{ id: clubs[0].id, teamName: teamClubNameShort(clubs[0].id) }}
            home={{ id: clubs[1].id, teamName: teamClubNameShort(clubs[1].id) }}
            stamped={ws}
          />
  )
  const rostersEl = (
    <>
      {rosterCards.some(({ roster }) => roster.declared === false) && (
        <p className="hint">
          Each club names its postseason roster on the morning of Game 1. Until then, this is its current roster.
        </p>
      )}
      {rosterCards.length > 0 && (
        <div className="psseries__rosters">
          {rosterCards.map(({ club, roster }) => (
            <RosterCard key={club.id} teamId={club.id} roster={roster} stamped={ws} />
          ))}
        </div>
      )}
    </>
  )
  // WORLD SERIES LAYOUT: the hero on top, then the groups behind one jump bar. A group with no data
  // is not drawn and has no button. The rest of the page keeps its sections; the Scouting report
  // drops its own bar, Nine keys (this page has SeriesNineKeys) and Film room / Roster (drawn
  // under Compare and Rosters), and Today never shows a score (the cards read past games only).
  const { data: wsData, game, focusPk, umpire, parkOf, played } = view
  const lastPlayed = series.games.at(-1)
  const noteClub = view.clubIds?.includes(favoriteTeamId) ? favoriteTeamId : clubA
  const groups = seriesGroups({
    now: Boolean(todayEl || startersEl || upcoming.length),
    series: results.length > 0,
    scout: scoutShown,
    compare: pair,
    rosters: rosterCards.length > 0,
  })
  const has = (key) => groups.some((g) => g.key === key)
  const grouped = mode && (
    <>
      {series.decided ? (
        resultBanner
      ) : (
        <Hero
          mode={mode}
          game={game}
          slateDate={cutoff}
          wide={wide}
          played={played}
          umpire={umpire}
          splitsByClub={wsData?.hotBats ?? null}
          clubGames={wsData?.clubGames ?? null}
        />
      )}
      <GroupJump groups={groups} />
      {has('now') && (
        <Group id="now" label="Now">
          {todayEl}
          {startersEl}
          {stillEl}
        </Group>
      )}
      {has('series') && (
        <Group id="series" label="Series">
          {flowEl}
          {gamesEl}
          {wsData && <Reel series={series} slateDate={cutoff} clubGames={wsData.clubGames} lcsRound={(id) => lcsRoundOf(bracket, id)} />}
          {noticesEl}
          {totalsEl}
          {leadersEl}
        </Group>
      )}
      {/* Always mounted: the report tells us (onShown) whether it has any card to draw. */}
      <div hidden={!scoutShown}>
        <Group id="scout" label="Scout" bare>
          <ScoutingReport
            clubIds={view.clubIds}
            sides={[game?.awayId ?? clubA, game?.homeId ?? clubB]}
            slateDate={cutoff}
            dayType={mode.dayType}
            gamePk={focusPk}
            gameNumber={mode.gameNumber}
            game={game}
            plateUmpire={umpire}
            series={null}
            omit={['nine-keys', 'film-room']}
            jumpBar={false}
            onShown={setScoutShown}
          />
        </Group>
      </div>
      {has('compare') && (
        <Group id="compare" label="Compare">
          {/* The short cards flow in balanced columns; the Bullpen, two wide tables, takes the row. */}
          <Flow>
            {wsData && <Tape awayId={game?.awayId ?? clubA} homeId={game?.homeId ?? clubB} data={wsData} slateDate={cutoff} />}
            {wsData && <HotBats clubIds={view.clubIds} splitsByClub={wsData.hotBats} />}
            <Trip
              fromVenueId={lastPlayed ? parkOf[lastPlayed.gamePk]?.venue?.id : null}
              toVenueId={game?.venue?.id}
              firstPitch={game?.gameDate}
              wide={wide}
            />
            {wsData && <HomeRoad clubIds={view.clubIds} clubGames={wsData.clubGames} slateDate={cutoff} />}
          </Flow>
          {wsData && <Bullpen clubIds={view.clubIds} boxscoresByClub={wsData.boxscores} slateDate={cutoff} />}
          {stripEl}
          {meetings?.length > 0 && <FilmRoom meetings={meetings} compact={mode.dayType === 'game'} clubId={noteClub} />}
          {nineEl}
          {absEl}
          {matesEl}
        </Group>
      )}
      {has('rosters') && (
        <Group id="rosters" label="Rosters">
          {rostersEl}
        </Group>
      )}
    </>
  )

  return (
    <div className={`screen psseries pslive${ws ? ' psseries--ws' : ''}`}>
      <SiteHeader />
      <BackBtn onClick={back} />

      <header className="topbar">
        <h1 className="topbar__title">{series.name}</h1>
      </header>

      {grouped || (
        <>
          {resultBanner}
          {todayEl}
          {startersEl}
          {stillEl}
          {flowEl}
          {gamesEl}
          {noticesEl}
          {totalsEl}
          {leadersEl}
          {stripEl}
          {nineEl}
          {absEl}
          {matesEl}
          {rostersEl}
        </>
      )}
    </div>
  )
}
