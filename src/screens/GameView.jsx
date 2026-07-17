import { useEffect, useRef, useState } from 'react'
import { useGameData } from '../hooks/useGameData.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useMediaQuery, WIDE_QUERY } from '../hooks/useMediaQuery.js'
import { sectionToStep, stepToSection } from '../lib/route.js'
import { selectGameStatus } from '../api/select.js'
import { TeamInfo, LineupSpread } from './TeamInfo.jsx'
import { InningViewer } from './InningViewer.jsx'
import { BoxScore } from './BoxScore.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { LogoModal } from '../components/LogoModal.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { LinkScope } from '../lib/nav.jsx'
import { humanDate } from '../lib/dates.js'

// Container for a selected game. Fetches the feed (and both managers) once, then
// shows the section named by the URL: away info → home info → inning viewer.
// The chrome is two grayscale team marks (away @ home) that open the sketch
// modal; a small site mark up top returns to the slate. Which section shows is
// driven entirely by `section` / `onSection` so every step is a real URL.
export function GameView({ game, section, onSection }) {
  const { step, inning, half } = sectionToStep(section)
  useDocumentTitle(gameTitle(game, step, inning, half))
  const [sketching, setSketching] = useState(null) // 'away' | 'home' | null
  // Tablet/desktop: the two lineup pages condense into one two-column spread
  // (LineupSpread) at the same breakpoint the CSS starts laying columns. The
  // lineup1/lineup2 URLs both show the spread, so links stay portable between
  // a phone and a desk.
  const wide = useMediaQuery(WIDE_QUERY)

  // All of this game's data fetching (feed, uniforms, managers, weather,
  // starter lines, win probability, pitcher roles, prospects, callouts,
  // broadcast, former teammates) lives in one hook — see useGameData for the
  // per-fetch sequencing/keying/caching rationale.
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
    gameCallouts,
    broadcast,
    formerTeammatesData,
    vsTeamSplitsData,
    highlightsData,
    runExpectancyData,
    started,
  } = useGameData(game)

  // Where "Innings" returns to: the last half-inning page the user was on, so
  // hopping out to a lineup or the box score and back doesn't lose your place
  // mid-game. Structural only (a section name), never a score.
  const lastInningSection = useRef('top1')
  useEffect(() => {
    if (step === 2) lastInningSection.current = stepToSection(2, inning, half)
  }, [step, inning, half])

  const sketchTeam = sketching ? game[sketching] : null

  // The section tabs (LINEUPS / INNINGS / BOX). Rendered in place for the lineup
  // and box-score sections; for the innings view it's handed to InningViewer
  // instead, which sets it on the same row as the half-inning Back/Next nav on
  // the wide layout (one bar of chrome) and stacked on a phone.
  const sectionTabs = feed ? (
    <nav className="stepnav" aria-label="Game sections">
      {(wide
        ? // Wide screens show both lineups on one spread, so the two team
          // tabs collapse into a single "Lineups" stop.
          [
            {
              key: 'lineups',
              label: 'Lineups',
              active: step === 0 || step === 1,
              section: 'lineup1',
            },
            {
              key: 'innings',
              label: 'Innings',
              active: step === 2,
              section: lastInningSection.current,
            },
            { key: 'box', label: 'Box', active: step === 3, section: 'boxscore' },
          ]
        : [
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
              section: lastInningSection.current,
            },
            { key: 'box', label: 'Box', active: step === 3, section: 'boxscore' },
          ]
      ).map((s) => (
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
    // Before first pitch there's nothing yet to spoil, so a link out of a
    // Preview game's lineups should show live/current stats rather than
    // freezing to "entering today" (that framing only makes sense once the
    // game — and the spoiler risk — has actually started).
    <LinkScope asOf={started ? officialDate : null} sportId={game.sportId}>
    <div className="screen">
      <SiteHeader />

      <Masthead
        away={game.away}
        home={game.home}
        date={officialDate}
        gamePk={game.gamePk}
        onSketch={setSketching}
      />

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

      {feed && (step === 0 || step === 1) && wide && (
        <LineupSpread
          feed={feed}
          managers={managers.data}
          uniforms={uniformBrief}
          broadcast={broadcast.data}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          starterLines={starterLines.data}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          formerTeammatesData={formerTeammatesData}
          callouts={gameCallouts}
          onNext={() => onSection('top1')}
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 0 && !wide && (
        <TeamInfo
          feed={feed}
          side="away"
          manager={managers.data?.away}
          uniform={uniformBrief.away}
          broadcast={broadcast.data}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          // The away side FACES the home starter.
          oppPitcherLine={starterLines.data?.home}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          formerTeammatesData={formerTeammatesData}
          callouts={gameCallouts}
          onNext={() => onSection('lineup2')}
          nextLabel="Home team ›"
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 1 && !wide && (
        <TeamInfo
          feed={feed}
          side="home"
          manager={managers.data?.home}
          uniform={uniformBrief.home}
          broadcast={broadcast.data}
          scorebookWeather={weather.data}
          scorebookWeatherLoading={weather.loading}
          oppPitcherLine={starterLines.data?.away}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          formerTeammatesData={formerTeammatesData}
          callouts={gameCallouts}
          onNext={() => onSection('top1')}
          nextLabel="Innings ›"
          onReload={feedState.reload}
          loading={feedState.loading}
        />
      )}
      {feed && step === 2 && (
        <InningViewer
          feed={feed}
          started={started}
          sectionNav={sectionTabs}
          inning={inning}
          half={half}
          onInning={(n, h, opts) => onSection(stepToSection(2, n, h), opts)}
          onBoxScore={() => onSection('boxscore')}
          onReload={feedState.reload}
          loading={feedState.loading}
          pitcherRoles={pitcherRoles.data}
          winProbability={winProb.data}
          prospectsData={prospectsData}
          rookiesData={rookiesData}
          callouts={gameCallouts}
          vsTeam={vsTeamSplitsData}
          highlights={highlightsData}
          runExpectancy={runExpectancyData}
        />
      )}
      {feed && step === 3 && (
        <BoxScore
          feed={feed}
          managers={managers.data}
          uniforms={uniformBrief}
          scorebookWeather={weather.data}
          winProbability={winProb.data}
          callouts={gameCallouts}
          vsTeam={vsTeamSplitsData}
          onReload={feedState.reload}
          loading={feedState.loading}
          onSection={onSection}
        />
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
function Masthead({ away, home, date, gamePk, onSketch }) {
  return (
    <div className="masthead">
      <div className="masthead__teams">
        <MastheadLogo team={away} onSketch={() => onSketch('away')} />
        <span className="masthead__at" aria-hidden="true">@</span>
        <MastheadLogo team={home} onSketch={() => onSketch('home')} />
      </div>
      <div className="masthead__side">
        {date && <span className="masthead__date">{humanDate(date)}</span>}
        {gamePk && <WatchButton gamePk={gamePk} />}
      </div>
    </div>
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
  return `${matchup} · ${half === 'bottom' ? 'Bot' : 'Top'} ${ordinal(inning)}`
}

function MastheadLogo({ team, onSketch }) {
  return (
    <button
      type="button"
      className="masthead__logo"
      onClick={onSketch}
      aria-label={`Enlarge ${team.name || 'team'} logo for sketching`}
    >
      <TeamLogo teamId={team.id} name={team.name} size={44} />
    </button>
  )
}
