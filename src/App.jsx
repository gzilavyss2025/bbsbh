import { lazy, Suspense, useEffect, useState } from 'react'
import { GameSelect } from './screens/GameSelect.jsx'
import { resolveGame } from './api/schedule.js'
import { useAsync } from './hooks/useAsync.js'
import { NavProvider } from './lib/nav.jsx'
import { Loader } from './components/Loader.jsx'
import {
  parseRoute,
  gamePath,
  matchupSlug,
  urlDateToApi,
  apiDateToUrl,
} from './lib/route.js'

function lazyNamed(loader, name) {
  return lazy(() => loader().then((module) => ({ default: module[name] })))
}

const AboutPage = lazyNamed(() => import('./screens/AboutPage.jsx'), 'AboutPage')
const GameView = lazyNamed(() => import('./screens/GameView.jsx'), 'GameView')
const LogoSheet = lazyNamed(() => import('./screens/LogoSheet.jsx'), 'LogoSheet')
const PlayerPage = lazyNamed(() => import('./screens/PlayerPage.jsx'), 'PlayerPage')
const ProspectsPage = lazyNamed(() => import('./screens/ProspectsPage.jsx'), 'ProspectsPage')
const RehabPage = lazyNamed(() => import('./screens/RehabPage.jsx'), 'RehabPage')
const MilestoneWatchPage = lazyNamed(
  () => import('./screens/MilestoneWatchPage.jsx'),
  'MilestoneWatchPage',
)
const AwardsHistoryPage = lazyNamed(
  () => import('./screens/AwardsHistoryPage.jsx'),
  'AwardsHistoryPage',
)
const PostseasonHistoryPage = lazyNamed(
  () => import('./screens/PostseasonHistoryPage.jsx'),
  'PostseasonHistoryPage',
)
const PostseasonLeadersPage = lazyNamed(
  () => import('./screens/PostseasonLeadersPage.jsx'),
  'PostseasonLeadersPage',
)
const PostseasonSeriesPage = lazyNamed(
  () => import('./screens/PostseasonSeriesPage.jsx'),
  'PostseasonSeriesPage',
)
const AllStarRostersPage = lazyNamed(
  () => import('./screens/AllStarRostersPage.jsx'),
  'AllStarRostersPage',
)
const AllStarLegacyPage = lazyNamed(
  () => import('./screens/AllStarLegacyPage.jsx'),
  'AllStarLegacyPage',
)
const StandingsPage = lazyNamed(() => import('./screens/StandingsPage.jsx'), 'StandingsPage')
const TeamPage = lazyNamed(() => import('./screens/TeamPage.jsx'), 'TeamPage')
const TeamLeadersPage = lazyNamed(
  () => import('./screens/TeamLeadersPage.jsx'),
  'TeamLeadersPage',
)
const LeadersPage = lazyNamed(() => import('./screens/LeadersPage.jsx'), 'LeadersPage')
const UmpirePage = lazyNamed(() => import('./screens/UmpirePage.jsx'), 'UmpirePage')
const UmpireRankingsPage = lazyNamed(
  () => import('./screens/UmpireRankingsPage.jsx'),
  'UmpireRankingsPage',
)
const ManagerPage = lazyNamed(() => import('./screens/ManagerPage.jsx'), 'ManagerPage')
const TopGamesPage = lazyNamed(() => import('./screens/TopGamesPage.jsx'), 'TopGamesPage')
const GameNotesDebugPage = lazyNamed(
  () => import('./screens/GameNotesDebugPage.jsx'),
  'GameNotesDebugPage',
)
const FirstScorebookPage = lazyNamed(
  () => import('./screens/FirstScorebookPage.jsx'),
  'FirstScorebookPage',
)
// Scorecard Lab deliberately contains full-reveal code. It is available only
// in development and is omitted from the production module graph.
const ScorecardLab = import.meta.env.DEV
  ? lazyNamed(() => import('./screens/ScorecardLab.jsx'), 'ScorecardLab')
  : null

// The current URL, path + query — player/team links carry a `?d=&s=` spoiler
// cutoff, so the query is part of route identity, not just the path.
function currentUrl() {
  return window.location.pathname + window.location.search
}

// Top-level router over the History API (no react-router — see lib/route.js).
// Anchored on the slate ('/') and the deep-linkable game section
// ('/{date}/{matchup}/{section}'), plus the many standalone pages (logos,
// leaders, standings, player/team/umpire/manager, postseason, …). lib/route.js's
// parseRoute is the authoritative, order-sensitive list of every route name.
// Every section of every game is a real, shareable URL; the back button walks
// the steps.
export default function App() {
  const [route, setRoute] = useState(() => parseRoute(currentUrl()))
  // The game object from the slate, carried into the game route so a same-session
  // open needs no resolve fetch. Cold loads / shared links resolve from the URL.
  // Stored with its slate date — the seed is only valid for the exact date +
  // matchup it was picked from (the same two clubs meet on many dates).
  const [seed, setSeed] = useState(null) // { game, date: MMDDYYYY }

  useEffect(() => {
    const onPop = () => setRoute(parseRoute(currentUrl()))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // `replace` swaps the current history entry instead of pushing — used to
  // normalize an out-of-range URL to the half actually shown, so Back doesn't
  // walk through bogus addresses.
  const go = (path, { replace = false } = {}) => {
    window.history[replace ? 'replaceState' : 'pushState']({}, '', path)
    setRoute(parseRoute(path))
  }

  // Open a game picked from the slate at a given section (the away lineup by
  // default; the card's "Box score" shortcut jumps straight to 'boxscore').
  const openGame = (game, dateStr, section = 'lineup1') => {
    const path = gamePath(
      dateStr,
      game.away.abbreviation,
      game.home.abbreviation,
      section,
      game.gameNumber,
    )
    setSeed({ game, date: apiDateToUrl(dateStr) })
    go(path)
  }

  let content
  if (route.name === 'logos') {
    content = <LogoSheet onBack={() => go('/')} />
  } else if (route.name === 'about') {
    content = <AboutPage onBack={() => go('/')} />
  } else if (route.name === 'prospects') {
    content = <ProspectsPage />
  } else if (route.name === 'rehab') {
    content = <RehabPage />
  } else if (route.name === 'milestones') {
    content = <MilestoneWatchPage />
  } else if (route.name === 'awards-history') {
    content = <AwardsHistoryPage />
  } else if (route.name === 'postseason-history') {
    content = <PostseasonHistoryPage />
  } else if (route.name === 'postseason-leaders') {
    content = <PostseasonLeadersPage />
  } else if (route.name === 'postseason-series') {
    content = <PostseasonSeriesPage seriesId={route.seriesId} />
  } else if (route.name === 'all-star-rosters') {
    content = <AllStarRostersPage />
  } else if (route.name === 'all-star-legacy') {
    content = <AllStarLegacyPage />
  } else if (route.name === 'standings') {
    content = <StandingsPage />
  } else if (route.name === 'player') {
    content = <PlayerPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team') {
    content = <TeamPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'umpire') {
    content = <UmpirePage id={route.id} />
  } else if (route.name === 'umpire-rankings') {
    content = <UmpireRankingsPage />
  } else if (route.name === 'manager') {
    content = <ManagerPage id={route.id} />
  } else if (route.name === 'top-games') {
    content = <TopGamesPage />
  } else if (route.name === 'game-notes-debug') {
    content = <GameNotesDebugPage />
  } else if (route.name === 'first-scorebook') {
    content = <FirstScorebookPage />
  } else if (route.name === 'scorecard-lab' && ScorecardLab) {
    content = <ScorecardLab />
  } else if (route.name === 'team-leaders') {
    content = <TeamLeadersPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'leaders') {
    content = (
      <LeadersPage
        scope={route.scope}
        orgId={route.orgId}
        asOf={route.asOf}
        sportId={route.sportId}
      />
    )
  } else if (route.name === 'game') {
    // Only reuse the seed when it matches the URL exactly — date AND matchup.
    // Matchup alone isn't identity: the same slug recurs across a whole series
    // (and a doubleheader's game 2 differs only in its '-2' suffix).
    const seedMatches =
      seed &&
      seed.date === route.date &&
      matchupSlug(
        seed.game.away.abbreviation,
        seed.game.home.abbreviation,
        seed.game.gameNumber,
      ) === route.matchup
    content = (
      <GameRoute
        route={route}
        seed={seedMatches ? seed.game : null}
        onSection={(section, opts) =>
          go(`/${route.date}/${route.matchup}/${section}`, opts)
        }
        onHome={() => go('/')}
      />
    )
  } else {
    // `route.date` is only set by the '/{MMDDYYYY}' home shape (null = today);
    // GameSelect pages between days by navigating those URLs itself (useNav),
    // so a browsed-to day is a real, shareable address and Back/Forward walk
    // the days you visited.
    content = (
      <GameSelect
        date={route.date ?? null}
        onPick={openGame}
        onShowLogos={() => go('/logos')}
      />
    )
  }

  // NavProvider hands every deep PlayerLink/TeamLink the History-API `go` so a
  // name anywhere can navigate without threading a prop through the tree.
  return (
    <NavProvider navigate={go}>
      <Suspense
        fallback={
          <div className="app">
            <div className="screen">
              <Loader />
            </div>
          </div>
        }
      >
        <div className="app">{content}</div>
      </Suspense>
    </NavProvider>
  )
}

// Resolves a game route (date + matchup) to a game object — instantly from the
// seed when present, otherwise by scanning the date's slate — then hands off to
// GameView. Keeps the URL as the single source of truth for which section shows.
function GameRoute({ route, seed, onSection, onHome }) {
  const apiDate = urlDateToApi(route.date)
  const resolved = useAsync(
    () => (seed ? Promise.resolve(seed) : resolveGame(apiDate, route.matchup)),
    [apiDate, route.matchup, seed],
  )

  if (resolved.loading) {
    return (
      <div className="screen">
        <Loader />
      </div>
    )
  }
  // A network failure is not "no such game" — resolveGame throws when every
  // level's schedule was unreachable, and that deserves a retry, not a shrug
  // about the schedule.
  if (resolved.error) {
    return (
      <div className="screen">
        <p className="hint hint--error" role="status">
          Couldn’t load the schedule. Check your connection and try again.
        </p>
        <button className="btn" onClick={resolved.reload}>
          Retry
        </button>
        <button className="btn btn--ghost" onClick={onHome}>
          Back to games
        </button>
      </div>
    )
  }
  if (!resolved.data) {
    return (
      <div className="screen">
        <p className="hint hint--error">
          Couldn’t find that game. It may not be on the schedule for that date.
        </p>
        <button className="btn" onClick={onHome}>
          Back to games
        </button>
      </div>
    )
  }

  return (
    <GameView
      game={resolved.data}
      section={route.section}
      onSection={onSection}
    />
  )
}
