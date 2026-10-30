import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useGameData } from '../hooks/useGameData.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useWakeLock } from '../hooks/useWakeLock.js'
import { usePreferences } from '../hooks/preferences/usePreferences.js'
import { canonicalSection, gameSeriesHref, sectionToStep, stepToSection } from '../lib/route.js'
import { selectGameStatus } from '../api/select.js'
import { selectHasNoPlayByPlay } from '../api/gamerecord/played.js'
import { Door } from '../components/ui/control/Door.jsx'
import { EmptyState } from '../components/ui/state/EmptyState.jsx'
import { catchUpPlan, catchUpRevealTo } from '../hooks/useRevealProgress.js'
import { LogoModal } from '../components/logo/LogoModal.jsx'
import { GameUniformsContext } from '../components/logo/uniformContexts.js'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { Masthead, MatchBand, MastheadSide } from './gameview/Masthead.jsx'
import { LineupJumpBar } from './lineup/next/LineupJumpBar.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { Loader } from '../components/ui/Loader.jsx'
import { GameLoader, GameLoaderHold } from '../components/game/versus/GameLoader.jsx'
import { LinkScope } from '../lib/nav.jsx'
import { useRouteLink } from '../lib/nav.js'
import { ordinal } from '../lib/format.js'
import { useGameRound } from '../hooks/postseason/useGameRound.js'
import { titleWithRound } from '../lib/postseason/gameRound.js'
import { seriesMarkForFeed } from '../lib/postseason/seriesMarks.js'
import { SeriesMark } from '../components/postseason/SeriesMark.jsx'
import { usePostseasonBracket } from '../hooks/postseason/usePostseasonBracket.js'
import { seriesForGame } from '../api/postseason/bracket.js'
import { gameStatusAfter } from '../api/postseason/text.js'
import { gameSectionTabs } from './lineup/gameSections.js'

// GameView is itself a lazily-loaded route (App.jsx), but its three sections
// — lineups, innings, box score — are mutually exclusive per render (`step`)
// and each is a large module on its own. Splitting them further means opening
// a game to read a lineup never downloads the innings viewer or box score
// code until the user actually taps into that section.
const importLineupNextPage = () =>
  import('./lineup/next/LineupNextPage.jsx').then((m) => ({ default: m.LineupNextPage }))
const LineupNextPage = lazy(importLineupNextPage)
// Starts the lineup page's code with the game's data, so the loader rarely waits on it alone.
importLineupNextPage()
const InningViewer = lazy(() =>
  import('./InningViewer.jsx').then((m) => ({ default: m.InningViewer })),
)
const BoxScore = lazy(() => import('./BoxScore.jsx').then((m) => ({ default: m.BoxScore })))
// The preview-image studio (step 4). Split the hardest of the four: it pulls in
// the whole canvas painter and the umpire accuracy reader, and most visits to a
// game never open it.
const GamePreview = lazy(() =>
  import('./GamePreview.jsx').then((m) => ({ default: m.GamePreview })),
)
// The printable pre-pitch scorecard (step 5). Split for the same reason as the
// poster above it: it brings its own stylesheet, and a visit that never prints
// tonight's sheet should never download either.
const ScoreSheetPage = lazy(() =>
  import('./sheet/ScoreSheetPage.jsx').then((m) => ({ default: m.ScoreSheetPage })),
)
// The live scorecard (step 6): the #22 sheet inked as far as the user's own
// reveal mark, editable cell by cell. Split like the sheet above it — most
// visits to a game never open it, and it pulls the whole grid builder in.
const ScorecardPage = lazy(() =>
  import('./scorecard/ScorecardPage.jsx').then((m) => ({ default: m.ScorecardPage })),
)

// Container for a selected game. Fetches the feed (and both managers) once, then
// shows the section named by the URL: away info → home info → inning viewer.
// The chrome is two grayscale team marks (away @ home) that open the sketch
// modal; a small site mark up top returns to the slate. Which section shows is
// driven entirely by `section` / `onSection` so every step is a real URL.
export function GameView({ game, section, onSection }) {
  const { step, inning, half } = sectionToStep(section)
  // An old half address (express-top5, inning4) opens its half, then becomes the address the app
  // writes (top5), replaced so Back never revisits it.
  const canonical = canonicalSection(section)
  useEffect(() => {
    if (canonical) onSection(canonical, { replace: true })
  }, [canonical]) // eslint-disable-line react-hooks/exhaustive-deps
  const [sketching, setSketching] = useState(null) // 'away' | 'home' | null

  // All of this game's data fetching (feed, uniforms, managers, weather,
  // starter lines, win probability, pitcher roles, prospects, callouts,
  // broadcast, former teammates) lives in one hook — see useGameData for the
  // per-fetch sequencing/keying/caching rationale.
  const {
    feedState,
    feed,
    officialDate,
    uniformBrief,
    uniformFigure,
    managers,
    weather,
    starterLines,
    winProb,
    prospectsData,
    rookiesData,
    gameCallouts,
    broadcast,
    formerTeammatesData,
    careerMatchupsData,
    vsTeamSplitsData,
    highlightsData,
    workloadData,
    jerseyTreatments,
    started,
  } = useGameData(game, step)

  // An old played game with no plays has no half-inning pages worth a tap
  // (selectHasNoPlayByPlay): "Innings ›" goes to the box score, and a direct
  // load of a half shows one line instead of InningViewer. No SealBox renders.
  const noPlays = selectHasNoPlayByPlay(feed)
  const round = useGameRound(feed)
  useDocumentTitle(gameTitle(game, step, inning, half, round))

  // Screen Wake Lock — keeps the phone's display on during a live game so it
  // stays readable propped up next to a scorebook (see useWakeLock). Opt-in
  // (battery cost of an always-on screen), persisted like the Game Score
  // preference; only actually held while the game is Live, released the rest
  // of the time (pregame staging, Final) regardless of the preference.
  const { keepAwake, set } = usePreferences()
  const setKeepAwake = (value) => set('keepAwake', Boolean(value))
  const isLive = feed?.gameData?.status?.abstractGameState === 'Live'
  useWakeLock(keepAwake && isLive)


  // Where "Gameday" returns to: the last half-inning page the user was on, so
  // hopping out to a lineup or the box score and back doesn't lose your place
  // mid-game. Structural only (a section name), never a score.
  // State, not a ref: the value is read during render (to build the nav's
  // "Gameday" tab target), and a ref must never be read outside an event
  // handler/effect — reading one during render isn't reactive and can tear
  // under concurrent rendering. The update itself is computed during render
  // (React's documented "adjust state while rendering" escape hatch) rather
  // than an effect, since it only depends on this render's own props.
  const [lastInningSection, setLastInningSection] = useState('top1')
  if (step === 2) {
    const currentInningsSection = stepToSection(2, inning, half)
    if (currentInningsSection !== lastInningSection) {
      setLastInningSection(currentInningsSection)
    }
  }

  const sketchTeam = sketching ? game[sketching] : null
  const seriesMark = seriesMarkForFeed(feed)
  // The band taps through to its series' live page, heading into this game's
  // own date (gameSeriesHref). The id comes from the bracket, the one place
  // that knows Game 1's clubs, and the bracket is read only for a postseason
  // game. It is cutoff-gated (api/spoiler-manifest.json): results strictly
  // BEFORE this game's date, so nothing here knows how this game went. Until
  // it loads, or if it fails, the band is a plain band.
  const { bracket: seriesBracket } = usePostseasonBracket(seriesMark ? officialDate : null)
  const seriesHit = seriesForGame(seriesBracket, feed?.gamePk)
  const seriesPage = gameSeriesHref(seriesHit?.series, officialDate)
  // "Game 2 · Braves Lead 1–0", beside the mark. Empty until the bracket loads.
  // After the final, once this box score is open (its reveal reports it: `boxShown`), the line counts
  // this game too (Gary, 2026-10-28). The winner is read only then, so the lineup pages and a sealed
  // box score keep the count from before the game.
  // The box score's reveal hands up the winner itself (BoxScore's `Opened`); nothing here reads a score.
  const [boxShown, setBoxShown] = useState(null)
  const onBoxOpened = useCallback((winner) => setBoxShown({ pk: feed?.gamePk ?? null, winner }), [feed?.gamePk])
  const winnerId = step === 3 && boxShown != null && boxShown.pk === feed?.gamePk ? boxShown.winner : null
  const seriesStatus = gameStatusAfter(seriesHit?.series, seriesHit?.gameNumber, winnerId)
  const routeLink = useRouteLink()

  // CATCH UP TO LIVE (ADR-0055) — the extra button on the home lineup page for
  // a reader who opened a game already in progress. `catchUpPlan` decides
  // whether the offer is worth drawing and where it lands (hooks/
  // useRevealProgress.js, beside the ratchet it uses); this screen only does
  // the two things it already owns, the reveal and the navigation.
  const catchUp = useMemo(() => catchUpPlan(feed), [feed])

  const onCatchUp = catchUp
    ? () => {
        catchUpRevealTo(feed.gamePk, catchUp.idx - 1)
        onSection(stepToSection(2, catchUp.inning, catchUp.half))
      }
    : null

  // The section tabs (LINEUPS / INNINGS / BOX). Rendered in place for the lineup
  // and box-score sections; for the innings view it's handed to InningViewer
  // instead, which sets it on the same row as the half-inning Back/Next nav on
  // the wide layout (one bar of chrome) and stacked on a phone.
  const tabs = gameSectionTabs(game, step, lastInningSection)
  // The innings page takes the lineup pages' jump bar; the box score and scorecard keep the outline row.
  const sectionTabs = !feed ? null : step === 2 ? (
    <LineupJumpBar
      tabs={tabs}
      onSection={onSection}
      aside={<MastheadSide date={officialDate} gamePk={game.gamePk} isLive={isLive} keepAwake={keepAwake} onSetKeepAwake={setKeepAwake} />}
    />
  ) : (
    <nav className="stepnav" aria-label="Game sections">
      {/* No Scorecard tab here (Gary, 2026-10-28); the scorecard page itself keeps its own. */}
      {tabs.filter((s) => s.key !== 'scorecard' || s.active).map((s) => (
        <button
          key={s.key}
          type="button"
          className="btn btn--control stepnav__btn"
          aria-current={s.active ? 'page' : undefined}
          onClick={() => !s.active && onSection(s.section)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  )

  // The lineup pages carry their own hero, jump bar and dock (docs/lineup-redesign.md), so the
  // masthead, series band and section tabs are left out once the game has loaded.
  const ownChrome = Boolean(feed) && (step === 0 || step === 1)
  const lineupNext = {
    game,
    tabs,
    onSection,
    isLive,
    keepAwake,
    onSetKeepAwake: setKeepAwake,
    officialDate,
    onSketch: setSketching,
    // The postseason series the game belongs to (mark, tally, page), read once above for the band.
    series: seriesMark
      ? { mark: seriesMark, gameNumber: seriesHit?.gameNumber ?? null, status: seriesStatus, href: seriesPage }
      : null,
  }

  return (
    // A link out of a game carries the LEVEL hint and nothing else. It used to
    // carry `asOf={started ? officialDate : null}` too, stamping `?d=` on every
    // player/team/leaders link so those pages opened frozen to "entering today".
    //
    // That was the spoiler rule reaching a long way past the surfaces it exists
    // to protect. A season stat line is not a score: it moves by fractions, it
    // is the same number the back of a baseball card has carried for a century,
    // and reading one tells you nothing about how the game you are scoring is
    // going. Freezing it by default made a whole section of the app quietly
    // wrong — a player page reached from a game showed different numbers than
    // the same page reached from search — in exchange for very little.
    //
    // So stats pages now open LIVE, always. `?d=` still parses and still
    // freezes (see route.js), so an already-shared link resolves the way its
    // sender meant it to; it is simply no longer stamped on by default. Nothing
    // about the game itself is affected — the slate, the lineup pages, the
    // innings viewer and the box score are unchanged and stay sealed.
    <LinkScope sportId={game.sportId}>
    <div className="screen">
      <SiteHeader />

      {!ownChrome && (step === 2 ? (
        // The innings page draws its own masthead (the scorebug, InningsHeader) once it has a feed.
        !noPlays && feed ? null : <MatchBand away={game.away} home={game.home} date={officialDate} onSketch={setSketching} treatment={jerseyTreatments} />
      ) : (
        <Masthead
          away={game.away}
          home={game.home}
          date={officialDate}
          gamePk={game.gamePk}
          onSketch={setSketching}
          isLive={isLive}
          keepAwake={keepAwake}
          onSetKeepAwake={setKeepAwake}
          treatment={jerseyTreatments}
        />
      ))}

      {/* A postseason game's series mark, on a navy band under the masthead —
          on both lineup pages and the box score, so the game reads as October
          before a name is read. Not on the innings view, where a phone's
          height belongs to the half being scored. A round name, never a
          score; null for a regular-season game or a season with no art. */}
      {seriesMark && !ownChrome && (step === 0 || step === 1 || step === 3) &&
        (seriesPage ? (
          <a className="gameseries gameseries--link" aria-label={`${seriesMark.alt}: open the series page`} {...routeLink(seriesPage)}>
            <SeriesMark mark={seriesMark} height={40} decorative />
            {seriesStatus && <span className="gameseries__status">{seriesStatus}</span>}
          </a>
        ) : (
          <div className="gameseries">
            <SeriesMark mark={seriesMark} height={40} />
            {seriesStatus && <span className="gameseries__status">{seriesStatus}</span>}
          </div>
        ))}

      {/* Delayed/suspended/postponed is structural game state, not a score —
          safe to render unconditionally, same as the masthead date above. Sits
          above the seal on every section of this game so it stays visible no
          matter where the user has navigated to. */}
      {feed && <GameStatusBanner status={selectGameStatus(feed)} />}

      {/* Every game section, one tap away — the same four stops the "next"
          buttons walk in order, so you can flip around the way you flip
          scorebook pages instead of only marching forward. On the innings view
          the tabs ride down into InningViewer's nav row instead (see below), so
          they share one line with Back/Next on the wide layout. */}
      {(step !== 2 || noPlays) && !ownChrome && sectionTabs}

      {sketchTeam && (
        <LogoModal
          teamId={sketchTeam.id}
          name={sketchTeam.name}
          onClose={() => setSketching(null)}
        />
      )}

      {/* Cold-load failure (never got a feed) collapses to a retry card; a
          refresh failure with a feed already in hand (useAsync retains the
          last-good feed) instead flags a non-blocking stale-refresh notice so
          one flaky request at a live game doesn't tear down the view. */}
      <GameLoaderHold active={feedState.loading && !feed} game={game} treatment={jerseyTreatments} />
      <AsyncStatus
        loading={false}
        error={feedState.error}
        hasData={Boolean(feed)}
        errorMessage="Couldn’t load this game. Try again in a moment."
        onRetry={feedState.reload}
        staleErrorMessage="Couldn’t refresh — showing the last update."
      />

      {feed && step === 0 && (
        <Suspense fallback={<GameLoader settled game={game} treatment={jerseyTreatments} />}>
        <LineupNextPage
          {...lineupNext}
          feed={feed}
          side="away"
          manager={managers.data?.away}
          uniform={uniformBrief.away}
          uniformFigure={uniformFigure.away ?? null}
          treatment={jerseyTreatments.away}
          oppTreatment={jerseyTreatments.home}
          broadcast={broadcast.data}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          // The away side FACES the home starter.
          oppPitcherLine={starterLines.data?.home}
          vsTeam={vsTeamSplitsData}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          formerTeammatesData={formerTeammatesData}
          careerMatchupsData={careerMatchupsData}
          workloadData={workloadData}
          callouts={gameCallouts}
          onNext={() => onSection('lineup2')}
          // The home club by its name, "Rays ›" (Gary, 2026-10-28).
          nextLabel={`${feed?.gameData?.teams?.home?.clubName || 'Home team'} ›`}
          nextTeamId={feed?.gameData?.teams?.home?.id ?? null}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
        />
        </Suspense>
      )}
      {feed && step === 1 && (
        <Suspense fallback={<GameLoader settled game={game} treatment={jerseyTreatments} />}>
        <LineupNextPage
          {...lineupNext}
          feed={feed}
          side="home"
          manager={managers.data?.home}
          uniform={uniformBrief.home}
          uniformFigure={uniformFigure.home ?? null}
          treatment={jerseyTreatments.home}
          oppTreatment={jerseyTreatments.away}
          broadcast={broadcast.data}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          oppPitcherLine={starterLines.data?.away}
          vsTeam={vsTeamSplitsData}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          formerTeammatesData={formerTeammatesData}
          careerMatchupsData={careerMatchupsData}
          workloadData={workloadData}
          callouts={gameCallouts}
          onNext={() => onSection(noPlays ? 'boxscore' : 'top1')}
          nextLabel={noPlays ? 'Box score ›' : 'Gameday ›'} // the section's own name (Gary, 2026-10-28)
          onCatchUp={onCatchUp}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
        />
        </Suspense>
      )}
      {feed && step === 2 && noPlays && (
        <EmptyState action={<Door onClick={() => onSection('boxscore')}>Box score</Door>}>
          There is no play-by-play in the record for this game.
        </EmptyState>
      )}
      {feed && step === 2 && !noPlays && (
        // While the viewer's chunk loads, the band stands in for the header it will draw.
        <Suspense fallback={<><MatchBand away={game.away} home={game.home} date={officialDate} treatment={jerseyTreatments} /><Loader /></>}>
        <GameUniformsContext.Provider value={uniformFigure}>
          <InningViewer
            feed={feed}
            started={started}
            sectionNav={sectionTabs}
            inning={inning}
            half={half}
            onInning={(n, h, opts) => onSection(stepToSection(2, n, h), opts)}
            onBoxScore={() => onSection('boxscore')}
            onLineup={(side) => onSection(side === 'home' ? 'lineup2' : 'lineup1')}
            gameStatus={selectGameStatus(feed)}
            refreshFailed={Boolean(feedState.error)}
            onReload={feedState.reload}
            loading={feedState.loading}
            lastUpdated={feedState.lastUpdated}
            winProbTreatment={jerseyTreatments}
            callouts={gameCallouts}
            vsTeam={vsTeamSplitsData}
            highlights={highlightsData}
            workload={workloadData}
            onSketch={setSketching}
          />
        </GameUniformsContext.Provider>
        </Suspense>
      )}
      {feed && step === 3 && (
        <Suspense fallback={<Loader />}>
        <BoxScore
          onOpened={onBoxOpened}
          feed={feed}
          managers={managers.data}
          uniforms={uniformBrief}
          scorebookWeather={weather.data}
          winProbability={winProb.data}
          winProbTreatment={jerseyTreatments}
          callouts={gameCallouts}
          vsTeam={vsTeamSplitsData}
          highlights={highlightsData}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
          onSection={onSection}
        />
        </Suspense>
      )}
      {feed && step === 4 && (
        <Suspense fallback={<Loader />}>
        <GamePreview
          feed={feed}
          starterLines={starterLines.data}
          broadcast={broadcast.data}
          callouts={gameCallouts}
          treatments={jerseyTreatments}
        />
        </Suspense>
      )}
      {feed && step === 5 && (
        <Suspense fallback={<Loader />}>
        {/* Every value on this sheet comes from api/select.js, the spoiler-free
            module — the feed, the managers and the outdoor weather reading are
            the same three inputs the lineup pages above already take. Nothing
            reveal-only is threaded in, and nothing may be: see
            screens/sheet/sheetModel.js. */}
        <ScoreSheetPage
          feed={feed}
          managers={managers.data}
          scorebookWeather={weather.data}
        />
        </Suspense>
      )}
      {feed && step === 6 && (
        <Suspense fallback={<Loader />}>
        {/* The live scorecard fills only through the user's own reveal mark
            (api/scorecardGame.js's clamp — ADR-0009's pattern); a stamp on
            this game substitutes the render mark exactly as the innings viewer
            does, persisting nothing (ADR-0048). */}
        <ScorecardPage
          feed={feed}
          managers={managers.data}
          uniformBrief={uniformBrief}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
          round={round} treatment={jerseyTreatments}
        />
        </Suspense>
      )}

    </div>
    </LinkScope>
  )
}

// Delayed/suspended/postponed banner, shown between the masthead and the
// step nav. `status` is selectGameStatus's output; renders nothing for a
// normal scheduled/live/final game. Appends the free-text reason ("Rain")
// when the feed carries one.
function GameStatusBanner({ status }) {
  if (!status?.label) return null
  return (
    <div className="game-status-banner" role="status">
      <span className="game-status-banner__text">
        {status.label}
        {status.reason && <span className="game-status-banner__reason"> — {status.reason}</span>}
      </span>
    </div>
  )
}

// Spoiler-safe tab title: team abbreviations plus a structural section label
// (lineup side, half-inning, box score) — the same information the URL's
// `section` already exposes, never anything score-revealing.
function gameTitle(game, step, inning, half, round = '') {
  const away = game.away.abbreviation || game.away.teamName || 'Away'
  const home = game.home.abbreviation || game.home.teamName || 'Home'
  const matchup = `${away} @ ${home}`
  const section =
    step === 0 ? `${away} Lineup`
    : step === 1 ? `${home} Lineup`
    : step === 3 ? 'Box score'
    : step === 4 ? 'Preview card'
    : step === 5 ? 'Print sheet'
    : step === 6 ? 'Scorecard'
    : `${half === 'bottom' ? 'Bot' : 'Top'} ${ordinal(inning)}`
  return titleWithRound(matchup, section, round)
}

