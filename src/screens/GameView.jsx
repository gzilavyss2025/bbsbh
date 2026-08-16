import { lazy, Suspense, useState } from 'react'
import { useGameData } from '../hooks/useGameData.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useWakeLock } from '../hooks/useWakeLock.js'
import { useKeepAwakePreference } from '../hooks/preferences/useKeepAwakePreference.js'
import { sectionToStep, stepToSection } from '../lib/route.js'
import { selectGameStatus } from '../api/select.js'
import { TeamTreatmentMark } from '../components/logo/TeamTreatmentMark.jsx'
import { LogoModal } from '../components/logo/LogoModal.jsx'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { Loader } from '../components/ui/Loader.jsx'
import { LinkScope } from '../lib/nav.jsx'
import { humanDateWithYear } from '../lib/dates.js'
import { useScoresUnlocked } from '../hooks/useScoresUnlocked.js'
import { useCopy } from '../copy/copyContext.js'
import { formatResetTime } from '../lib/scoresUnlocked.js'

// GameView is itself a lazily-loaded route (App.jsx), but its three sections
// — lineups, innings, box score — are mutually exclusive per render (`step`)
// and each is a large module on its own. Splitting them further means opening
// a game to read a lineup never downloads the innings viewer or box score
// code until the user actually taps into that section.
const TeamInfo = lazy(() => import('./TeamInfo.jsx').then((m) => ({ default: m.TeamInfo })))
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
  useDocumentTitle(gameTitle(game, step, inning, half))
  const [sketching, setSketching] = useState(null) // 'away' | 'home' | null

  // All of this game's data fetching (feed, uniforms, managers, weather,
  // starter lines, win probability, pitcher roles, prospects, callouts,
  // broadcast, former teammates) lives in one hook — see useGameData for the
  // per-fetch sequencing/keying/caching rationale.
  // The spoilers-off pass is resolved first: while it's running, the feed poll
  // tightens its cadence so a live game you're watching stays current — see
  // useGameData's second argument.
  const { passActive, resetAt, spoilersOffFor, disable: endPass } = useScoresUnlocked()
  const {
    feedState,
    feed,
    officialDate,
    uniformBrief,
    managers,
    weather,
    starterLines,
    winProb,
    pitcherRoles,
    prospectsData,
    rookiesData,
    feverRadarData,
    savantPercentilesData,
    gameCallouts,
    broadcast,
    formerTeammatesData,
    careerMatchupsData,
    vsTeamSplitsData,
    highlightsData,
    runExpectancyData,
    workloadData,
    jerseyTreatments,
    started,
  } = useGameData(game, passActive, step)

  // Screen Wake Lock — keeps the phone's display on during a live game so it
  // stays readable propped up next to a scorebook (see useWakeLock). Opt-in
  // (battery cost of an always-on screen), persisted like the Game Score
  // preference; only actually held while the game is Live, released the rest
  // of the time (pregame staging, Final) regardless of the preference.
  const { keepAwake, setKeepAwake } = useKeepAwakePreference()
  const isLive = feed?.gameData?.status?.abstractGameState === 'Live'
  useWakeLock(keepAwake && isLive)

  // Should THIS game render plainly? Two ways to get there, and the difference
  // matters for what the chrome says (ADR-0026):
  //   - the pass is running right now — any game opened during the window is
  //     open, and the banner below offers the off switch;
  //   - or this game's day is one the user already consented to spoil, locked in
  //     when that day's pass expired. Nothing to turn off; that day is simply
  //     spoiled now, and saying otherwise would be a lie.
  // Consent itself lives on the slate — there is no per-game toggle, because
  // there is no longer a per-game mode to consent to.
  const { t: copy } = useCopy()
  const spoilersOff = spoilersOffFor(officialDate)

  // Where "Innings" returns to: the last half-inning page the user was on, so
  // hopping out to a lineup or the box score and back doesn't lose your place
  // mid-game. Structural only (a section name), never a score.
  // State, not a ref: the value is read during render (to build the nav's
  // "Innings" tab target), and a ref must never be read outside an event
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

  // The section tabs (LINEUPS / INNINGS / BOX). Rendered in place for the lineup
  // and box-score sections; for the innings view it's handed to InningViewer
  // instead, which sets it on the same row as the half-inning Back/Next nav on
  // the wide layout (one bar of chrome) and stacked on a phone.
  const sectionTabs = feed ? (
    <nav className="stepnav" aria-label="Game sections">
      {[
        {
          key: 'away',
          label: game.away.abbreviation || 'Away',
          active: step === 0,
          section: 'lineup1',
        },
        {
          key: 'home',
          label: game.home.abbreviation || 'Home',
          active: step === 1,
          section: 'lineup2',
        },
        {
          key: 'innings',
          label: 'Innings',
          active: step === 2,
          section: lastInningSection,
        },
        { key: 'box', label: 'Box', active: step === 3, section: 'boxscore' },
        // Fifth stop: the live #22 sheet, filled through the reveal mark —
        // last so the four scoring sections keep the order the "next" buttons
        // walk, same as before this tab pointed here.
        { key: 'scorecard', label: 'Scorecard', active: step === 6, section: 'scorecard' },
        // The preview poster (step 4) and the printable sheet (step 5)
        // deliberately have NO tab here. Not an omission: `.stepnav__btn` is
        // `flex: 1 1 0`, so a sixth or seventh stop divides a phone's row into
        // ever-narrower cells and wraps "Innings" onto two lines. Both doors
        // live on the two lineup pages instead (TeamInfo), which is where a
        // scorer is standing pre-first-pitch — the moment either one is worth
        // a tap.
      ].map((s) => (
        <button
          key={s.key}
          type="button"
          className={`stepnav__btn ${s.active ? 'is-active' : ''}`}
          aria-current={s.active ? 'page' : undefined}
          onClick={() => !s.active && onSection(s.section)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  ) : null

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

      {/* The spoilers-off strip, on EVERY section of the game (both lineups,
          innings, box score) — not just the innings view, so you can never be
          looking at an unsealed screen with nothing on it saying why. It is
          itself the off switch, the same "the banner is the toggle" convention
          the slate uses. Shown only while the pass is actually running: for a
          day that's already locked in there is nothing to switch off, so a strip
          offering to would be lying. */}
      {passActive && (
        <button
          type="button"
          className="modestrip"
          data-testid="spoilers-off-banner"
          onClick={endPass}
          aria-label="Turn off live scores"
        >
          {copy('scoresUnlocked.banner', { time: formatResetTime(resetAt) })}
        </button>
      )}

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
      {step !== 2 && sectionTabs}

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
      <AsyncStatus
        loading={feedState.loading}
        error={feedState.error}
        hasData={Boolean(feed)}
        errorMessage="Couldn’t load this game. Try again in a moment."
        onRetry={feedState.reload}
        staleErrorMessage="Couldn’t refresh — showing the last update."
      />

      {feed && step === 0 && (
        <Suspense fallback={<Loader />}>
        <TeamInfo
          feed={feed}
          side="away"
          manager={managers.data?.away}
          uniform={uniformBrief.away}
          treatment={jerseyTreatments.away}
          oppTreatment={jerseyTreatments.home}
          broadcast={broadcast.data}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          // The away side FACES the home starter.
          oppPitcherLine={starterLines.data?.home}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          feverRadarData={feverRadarData}
          savantPercentilesData={savantPercentilesData}
          formerTeammatesData={formerTeammatesData}
          careerMatchupsData={careerMatchupsData}
          workloadData={workloadData}
          callouts={gameCallouts}
          onNext={() => onSection('lineup2')}
          nextLabel="Home team ›"
          onPrintSheet={() => onSection('sheet')}
          onPreview={() => onSection('preview')}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
        />
        </Suspense>
      )}
      {feed && step === 1 && (
        <Suspense fallback={<Loader />}>
        <TeamInfo
          feed={feed}
          side="home"
          manager={managers.data?.home}
          uniform={uniformBrief.home}
          treatment={jerseyTreatments.home}
          oppTreatment={jerseyTreatments.away}
          broadcast={broadcast.data}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          oppPitcherLine={starterLines.data?.away}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          feverRadarData={feverRadarData}
          savantPercentilesData={savantPercentilesData}
          formerTeammatesData={formerTeammatesData}
          careerMatchupsData={careerMatchupsData}
          workloadData={workloadData}
          callouts={gameCallouts}
          onNext={() => onSection('top1')}
          nextLabel="Innings ›"
          onPrintSheet={() => onSection('sheet')}
          onPreview={() => onSection('preview')}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
        />
        </Suspense>
      )}
      {feed && step === 2 && (
        <Suspense fallback={<Loader />}>
        <InningViewer
          feed={feed}
          started={started}
          sectionNav={sectionTabs}
          inning={inning}
          half={half}
          onInning={(n, h, opts) => onSection(stepToSection(2, n, h), opts)}
          onBoxScore={() => onSection('boxscore')}
          onScorecard={() => onSection('scorecard')}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
          pitcherRoles={pitcherRoles.data}
          winProbability={winProb.data}
          winProbTreatment={jerseyTreatments}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          callouts={gameCallouts}
          vsTeam={vsTeamSplitsData}
          highlights={highlightsData}
          runExpectancy={runExpectancyData}
          workload={workloadData}
          managers={managers.data}
          uniforms={uniformBrief}
          scorebookWeather={weather.data}
          spoilersOff={spoilersOff}
          passActive={passActive}
        />
        </Suspense>
      )}
      {feed && step === 3 && (
        <Suspense fallback={<Loader />}>
        <BoxScore
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
          spoilersOff={spoilersOff}
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
            (api/scorecardGame.js's clamp — ADR-0009's pattern); `spoilersOff`
            substitutes the render mark under the Scores Unlocked pass exactly
            as the innings viewer does, persisting nothing (ADR-0026). */}
        <ScorecardPage
          feed={feed}
          managers={managers.data}
          uniformBrief={uniformBrief}
          spoilersOff={spoilersOff}
          onReload={feedState.reload}
          loading={feedState.loading}
          lastUpdated={feedState.lastUpdated}
        />
        </Suspense>
      )}

    </div>
    </LinkScope>
  )
}

// The game's masthead: two grayscale marks — away on the left, home on the
// right, an @ between — sized like the logos on the lineup pages, left-aligned
// in the page header, with the game's date and a Watch link side by side,
// right-aligned opposite them. Tapping a mark opens it enlarged for pencil
// sketching. The date and the Watch link are both structural, not
// score-revealing, so they render unconditionally (no seal).
function Masthead({
  away,
  home,
  date,
  gamePk,
  onSketch,
  isLive,
  keepAwake,
  onSetKeepAwake,
  treatment,
}) {
  return (
    <div className="masthead">
      <div className="masthead__teams">
        <MastheadLogo team={away} treatment={treatment?.away} side="away" onSketch={() => onSketch('away')} />
        {/* The same screen-print '@' the slate card uses (Big Shoulders
            Display, kraft-amber + navy a couple px out of register — see
            .gamecard__atmark), here an inline mark between the two logos
            rather than a faint background watermark. */}
        <span className="masthead__at" aria-hidden="true">
          <span className="masthead__at-ghost">@</span>
          <span className="masthead__at-ink">@</span>
        </span>
        <MastheadLogo team={home} treatment={treatment?.home} side="home" onSketch={() => onSketch('home')} />
      </div>
      <div className="masthead__side">
        {date && <span className="masthead__date">{humanDateWithYear(date)}</span>}
        {/* Only worth showing (and worth the tap) while the game can actually
            hold the lock — pregame/Final it would just sit there inert. */}
        {isLive && <KeepAwakeToggle on={keepAwake} onToggle={() => onSetKeepAwake(!keepAwake)} />}
        {gamePk && <WatchButton gamePk={gamePk} />}
      </div>
    </div>
  )
}

// Screen-wake-lock toggle, same switch convention as the Settings modal's
// Game Score pref (FavoriteTeamModal.jsx's favteamsheet__prefToggle) but
// compact enough to ride in the masthead next to Watch — this is a per-game,
// in-the-moment choice, not something worth burying in a separate modal.
function KeepAwakeToggle({ on, onToggle }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={on ? 'Keep screen awake: on' : 'Keep screen awake: off'}
      title="Keep the screen from sleeping during this live game"
      className={`awaketoggle${on ? ' is-on' : ''}`}
      onClick={onToggle}
    >
      <span className="awaketoggle__icon" aria-hidden="true">
        {on ? '☀' : '☾'}
      </span>
    </button>
  )
}

// Hands off to MLB.TV's own video player for this game — mlb.com's
// /tv/g{gamePk} route (confirmed live against mlb.com/tv: the page identifies
// itself as "MLB.TV Web"). Deliberately NOT /gameday/{gamePk} (an earlier
// version of this button used that): mlb.com's own
// /.well-known/apple-app-site-association lists "/tv/g*" as a path the MLB
// app registers for universal links but does NOT list "/gameday/*" at all —
// so a gameday link never actually opened the app, only Safari — and
// gameday is MLB's play-by-play/box-score tracker, i.e. exactly the kind of
// score-revealing page this app exists to seal, the opposite of what a
// "watch" button should hand off to. /tv/g* is registered, opens the app
// directly into the video player, and never routes through that tracker.
// Never spoiler-revealing on OUR side — it's a game identifier, not a score;
// once the user is watching, seeing the live broadcast (and its score) is
// the point of tapping Watch, not a leak from this app's own UI.
// The wordmark is MLB's own "MLBTV-19-ondark" asset (linked from
// mlb.com/live-stream-games), saved locally at public/icons/mlbtv-logo.svg
// rather than hotlinked — it already carries its own light badge shape,
// meant to sit on a dark surface like this pill's navy fill.
function WatchButton({ gamePk }) {
  return (
    <a
      className="watchbtn"
      href={`https://www.mlb.com/tv/g${gamePk}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Watch this game on MLB.TV"
    >
      <img className="watchbtn__logo" src="/icons/mlbtv-logo.svg" alt="Watch on MLB.TV" />
      <span className="watchbtn__ext" aria-hidden="true">↗</span>
    </a>
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

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

// Spoiler-safe tab title: team abbreviations plus a structural section label
// (lineup side, half-inning, box score) — the same information the URL's
// `section` already exposes, never anything score-revealing.
function gameTitle(game, step, inning, half) {
  const away = game.away.abbreviation || game.away.teamName || 'Away'
  const home = game.home.abbreviation || game.home.teamName || 'Home'
  const matchup = `${away} @ ${home}`
  if (step === 0) return `${matchup} · ${away} Lineup`
  if (step === 1) return `${matchup} · ${home} Lineup`
  if (step === 3) return `${matchup} · Box score`
  if (step === 4) return `${matchup} · Preview card`
  if (step === 5) return `${matchup} · Print sheet`
  if (step === 6) return `${matchup} · Scorecard`
  return `${matchup} · ${half === 'bottom' ? 'Bot' : 'Top'} ${ordinal(inning)}`
}

// The mark inside the masthead tile, sized so the EDGE_BLEED overscale
// TeamTreatmentMark applies (1.32) lands it at ~53px — 20% larger than the
// bare 44px logo this tile replaced. The tile itself is a little larger
// still, so the mark reads as printed on a uniform patch rather than filling
// a frame edge to edge.
const MASTHEAD_MARK = 40

function MastheadLogo({ team, treatment, side, onSketch }) {
  return (
    <button
      type="button"
      className="masthead__logo"
      onClick={onSketch}
      aria-label={`Enlarge ${team.name || 'team'} logo for sketching`}
    >
      <TeamTreatmentMark
        teamId={team.id}
        name={team.name}
        treatment={treatment}
        side={side}
        size={MASTHEAD_MARK}
        block="masthead__logobox"
      />
    </button>
  )
}
