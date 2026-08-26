import { lazy, Suspense, useEffect, useState } from 'react'
import { GameSelect } from './screens/GameSelect.jsx'
import { resolveGame } from './api/schedule.js'
import { useAsync } from './hooks/useAsync.js'
import { NavProvider } from './lib/nav.jsx'
import { isClerkEnabled } from './lib/clerkConfig.js'
import { Loader } from './components/ui/Loader.jsx'
import { SyncStatusProvider } from './components/sync/SyncStatusProvider.jsx'
import { PlayerHoverCard } from './components/player/PlayerHoverCard.jsx'
import { useMotionPreference } from './hooks/preferences/useMotionPreference.js'
import { useIdentityVersion } from './lib/identity/useIdentityVersion.js'
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

// Headless cross-device sync for the spoiled-day list (ADR-0026). Imports
// @clerk/clerk-react at its top, so — like RevealCloudSync and AccountButton —
// it is only ever dynamically imported, and only on a deploy that configures
// Clerk. Mounted app-wide rather than per screen: the consent it syncs is
// site-wide, not per game.
const SpoiledDaysCloudSync = isClerkEnabled
  ? lazy(() =>
      import('./components/sync/SpoiledDaysCloudSync.jsx').then((m) => ({
        default: m.SpoiledDaysCloudSync,
      })),
    )
  : null

// Headless cross-device sync for the Logbook's game stamps (ADR-0035). Same
// shape as the two above it: imports @clerk/clerk-react at its top, so it is
// only ever dynamically imported and only on a deploy that configures Clerk.
// App-wide rather than per screen, because a stamp minted in a box score has to
// publish even after the user navigates away from that game.
const StampsCloudSync = isClerkEnabled
  ? lazy(() =>
      import('./components/sync/StampsCloudSync.jsx').then((m) => ({
        default: m.StampsCloudSync,
      })),
    )
  : null

// Headless cross-device sync for the Game Log's named books — the cover half
// of ADR-0036. Same shape as StampsCloudSync right above it: imports
// @clerk/clerk-react at its top, so it is only ever dynamically imported and
// only on a deploy that configures Clerk. App-wide rather than per screen, for
// the same reason as StampsCloudSync: a book created or renamed inside the
// Logbook has to keep publishing even after the user navigates away from it.
const BooksCloudSync = isClerkEnabled
  ? lazy(() =>
      import('./components/sync/BooksCloudSync.jsx').then((m) => ({
        default: m.BooksCloudSync,
      })),
    )
  : null

// Headless cross-device sync for the My Tally preference document — the club,
// the slate's level, keep-awake, motion. Same shape as the two above: imports
// @clerk/clerk-react at its top, so it is only ever dynamically imported and
// only on a deploy that configures Clerk. App-wide because the level is changed
// on the slate and the club from the header, which are different screens.
const PreferencesCloudSync = isClerkEnabled
  ? lazy(() =>
      import('./components/sync/PreferencesCloudSync.jsx').then((m) => ({
        default: m.PreferencesCloudSync,
      })),
    )
  : null

// The shared-device guard for the three channels whose local state is one key
// per game, or none at all: the scoring frontier (ADR-0022), the box score's own
// bit (ADR-0049), and the days consented to (ADR-0026). Not a sync channel — it
// makes no request — but it lives with them because it acts on the same signal
// they do, the sign-in transition. Same dynamic-import shape for the same
// reason, since it reads Clerk's userId.
//
// App-wide is the whole point: all three are RENDER overrides, read
// synchronously as a scoring surface first paints, so a guard that waited for
// that surface's own network pull would decide after the score was on the page.
// Its own header has the full argument.
const OwnerGuards = isClerkEnabled
  ? lazy(() =>
      import('./components/sync/OwnerGuards.jsx').then((m) => ({ default: m.OwnerGuards })),
    )
  : null

const AboutPage = lazyNamed(() => import('./screens/AboutPage.jsx'), 'AboutPage')
const AdminCopyPage = lazyNamed(() => import('./screens/AdminCopy.jsx'), 'AdminCopyPage')
const ResearchDiaryPage = lazyNamed(
  () => import('./screens/research/ResearchDiaryPage.jsx'),
  'ResearchDiaryPage',
)
const ContenderDiaryPage = lazyNamed(
  () => import('./screens/contenders/ContenderDiaryPage.jsx'),
  'ContenderDiaryPage',
)
const ContractIdentityReviewPage = lazyNamed(
  () => import('./screens/admin/ContractIdentityReviewPage.jsx'),
  'ContractIdentityReviewPage',
)
const GameView = lazyNamed(() => import('./screens/GameView.jsx'), 'GameView')
const LogoSheet = lazyNamed(() => import('./screens/LogoSheet.jsx'), 'LogoSheet')
const PlayerPage = lazyNamed(() => import('./screens/PlayerPage.jsx'), 'PlayerPage')
const MorePage = lazyNamed(() => import('./screens/MorePage.jsx'), 'MorePage')
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
const PostseasonRacePage = lazyNamed(
  () => import('./screens/PostseasonRacePage.jsx'),
  'PostseasonRacePage',
)
const TradeDeadlinePage = lazyNamed(
  () => import('./screens/TradeDeadlinePage.jsx'),
  'TradeDeadlinePage',
)
const TradeDeadlineSeasonPage = lazyNamed(
  () => import('./screens/TradeDeadlineSeasonPage.jsx'),
  'TradeDeadlineSeasonPage',
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
const SalariesPage = lazyNamed(() => import('./screens/SalariesPage.jsx'), 'SalariesPage')
const FoulTrackerPage = lazyNamed(
  () => import('./screens/FoulTrackerPage.jsx'),
  'FoulTrackerPage',
)
// The player hub's three other tabs. Each is its own route and its own loader —
// a tab must not pull another tab's data, the same rule the team hub keeps
// (ADR-0034). Its Overview is PlayerPage.jsx, the bare '/player/{id}', exactly
// as TeamPage.jsx is the team hub's. Lazily loaded like every other screen, so a
// visitor who opens one tab never downloads the other three.
const PlayerStatsTab = lazyNamed(
  () => import('./screens/player/PlayerStatsTab.jsx'),
  'PlayerStatsTab',
)
const PlayerAnalyticsTab = lazyNamed(
  () => import('./screens/player/PlayerAnalyticsTab.jsx'),
  'PlayerAnalyticsTab',
)
const PlayerHistoryTab = lazyNamed(
  () => import('./screens/player/PlayerHistoryTab.jsx'),
  'PlayerHistoryTab',
)
const TeamPage = lazyNamed(() => import('./screens/TeamPage.jsx'), 'TeamPage')
const TeamLeadersPage = lazyNamed(
  () => import('./screens/TeamLeadersPage.jsx'),
  'TeamLeadersPage',
)
// The team hub's four new tabs. Each is its own route and its own loader — a
// tab must not pull another tab's data, which is half the reason the team page
// was split at all (see .scratch/team-page-ia/PRD.md). Lazily loaded like every
// other screen, so a visitor who opens one tab never downloads the other four.
const RosterTab = lazyNamed(() => import('./screens/team/RosterTab.jsx'), 'RosterTab')
const GamesTab = lazyNamed(() => import('./screens/team/GamesTab.jsx'), 'GamesTab')
const NumbersTab = lazyNamed(() => import('./screens/team/NumbersTab.jsx'), 'NumbersTab')
const ContractsTab = lazyNamed(() => import('./screens/team/ContractsTab.jsx'), 'ContractsTab')
const MinorsTab = lazyNamed(() => import('./screens/team/MinorsTab.jsx'), 'MinorsTab')
// Stamp In (ADR-0042) — NOT a sixth tab. A standalone page under the team's
// address, reached only from the Schedule card's button on the Games tab, and
// lazily loaded like every other screen so nobody who never opens it pays for
// it (or for its own stylesheet).
const StampInPage = lazyNamed(() => import('./screens/team/StampInPage.jsx'), 'StampInPage')
const TeamPhotosPage = lazyNamed(() => import('./screens/team/TeamPhotosPage.jsx'), 'TeamPhotosPage')
const TeamTransactionsPage = lazyNamed(
  () => import('./screens/team/TeamTransactionsPage.jsx'),
  'TeamTransactionsPage',
)
const LeadersPage = lazyNamed(() => import('./screens/LeadersPage.jsx'), 'LeadersPage')
const UmpirePage = lazyNamed(() => import('./screens/UmpirePage.jsx'), 'UmpirePage')
const UmpireRankingsPage = lazyNamed(
  () => import('./screens/UmpireRankingsPage.jsx'),
  'UmpireRankingsPage',
)
const SituationalRecordsPage = lazyNamed(
  () => import('./screens/SituationalRecordsPage.jsx'),
  'SituationalRecordsPage',
)
// The five broadcast report pages (src/screens/around-the-game/). Lazy like every
// other screen, and they SHARE one stylesheet
// (styles/68-around-the-game.css) which each of them imports — see that
// file's header for why one partial rather than four.
const AttendancePage = lazyNamed(
  () => import('./screens/around-the-game/AttendancePage.jsx'),
  'AttendancePage',
)
const PacePage = lazyNamed(() => import('./screens/around-the-game/PacePage.jsx'), 'PacePage')
const FarmSystemPage = lazyNamed(
  () => import('./screens/around-the-game/FarmSystemPage.jsx'),
  'FarmSystemPage',
)
const BullpenPage = lazyNamed(() => import('./screens/around-the-game/BullpenPage.jsx'), 'BullpenPage')
const DoubleheadersPage = lazyNamed(
  () => import('./screens/around-the-game/DoubleheadersPage.jsx'),
  'DoubleheadersPage',
)
const ManagerPage = lazyNamed(() => import('./screens/ManagerPage.jsx'), 'ManagerPage')
const GameNotesDebugPage = lazyNamed(
  () => import('./screens/GameNotesDebugPage.jsx'),
  'GameNotesDebugPage',
)
// Unlisted animation QA page — no score/reveal content and nothing to save, so
// unlike the two DEV-gated curation surfaces below it ships, reachable only by
// direct URL (see lib/route.js).
const AnimationLab = lazyNamed(() => import('./screens/AnimationLab.jsx'), 'AnimationLab')
const BetweenInningsLab = lazyNamed(
  () => import('./screens/BetweenInningsLab.jsx'),
  'BetweenInningsLab',
)
const WordmarkLab = lazyNamed(() => import('./screens/WordmarkLab.jsx'), 'WordmarkLab')
const FirstScorebookPage = lazyNamed(
  () => import('./screens/FirstScorebookPage.jsx'),
  'FirstScorebookPage',
)
const LogbookPage = lazyNamed(() => import('./screens/LogbookPage.jsx'), 'LogbookPage')
const LogbookStatsPage = lazyNamed(
  () => import('./screens/LogbookStatsPage.jsx'),
  'LogbookStatsPage',
)
const GamePhotosPage = lazyNamed(
  () => import('./screens/GamePhotosPage.jsx'),
  'GamePhotosPage',
)
// My Tally — the private settings/account destination. Clerk-free at its top
// level on purpose: the page has to render, whole, on a deploy that configures
// no account at all, so everything that touches @clerk/clerk-react sits behind
// its own dynamic import one level down (see screens/profile/ProfilePage.jsx).
const ProfilePage = lazyNamed(() => import('./screens/profile/ProfilePage.jsx'), 'ProfilePage')
// Scorecard Lab deliberately contains full-reveal code. It is available only
// in development and is omitted from the production module graph.
const ScorecardLab = import.meta.env.DEV
  ? lazyNamed(() => import('./screens/ScorecardLab.jsx'), 'ScorecardLab')
  : null
// The two curation surfaces are DEV-only, and for the same reason: their Save
// buttons post to vite.config.js's devDataSave() middleware, which exists only
// under `vite dev`. In a production build that endpoint is gone, so shipping
// them would ship buttons that can only fail — and, more to the point, the
// whole reason they exist (editing this repo's committed data files) is
// meaningless on a deployed copy. Gating them here is one of the four
// independent isolation layers in ADR-0029; lib/route.js still PARSES both
// names so a stray production URL falls through to the slate instead of the
// generic 3-segment game route.
const IdentityLab = import.meta.env.DEV
  ? lazyNamed(() => import('./screens/identity-lab/index.jsx'), 'IdentityLab')
  : null
const UniformNamesPage = import.meta.env.DEV
  ? lazyNamed(() => import('./screens/UniformNamesPage.jsx'), 'UniformNamesPage')
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
  // Applies the saved motion preference to <html>. One mount, app-wide.
  useMotionPreference()
  // Repaint when a club's identity overrides change — the hydrating fetch, or a
  // save from the team hub's gear. Subscribed HERE rather than on the team hub
  // because tuned identity paints everywhere (the slate's cards, the in-game
  // masthead, a Logbook stamp), and a narrower subscription would leave the rest
  // of an already-rendered app showing untuned art. It is an integer snapshot,
  // so React bails out unless the overlay actually moved — twice in a normal
  // session. See src/lib/identity/useIdentityVersion.js.
  useIdentityVersion()
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
  } else if (route.name === 'more') {
    content = <MorePage />
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
  } else if (route.name === 'postseason-race') {
    content = <PostseasonRacePage />
  } else if (route.name === 'trade-deadline') {
    content = <TradeDeadlinePage />
  } else if (route.name === 'trade-deadline-season') {
    content = <TradeDeadlineSeasonPage season={route.season} />
  } else if (route.name === 'all-star-rosters') {
    content = <AllStarRostersPage />
  } else if (route.name === 'all-star-legacy') {
    content = <AllStarLegacyPage />
  } else if (route.name === 'standings') {
    content = <StandingsPage />
  } else if (route.name === 'salaries') {
    content = <SalariesPage />
  } else if (route.name === 'fouls') {
    content = <FoulTrackerPage />
  } else if (route.name === 'admin') {
    content = (
      <AdminCopyPage onBack={() => go('/')} focus={route.focus} returnTo={route.returnTo} />
    )
  } else if (route.name === 'admin-research') {
    content = <ResearchDiaryPage />
  } else if (route.name === 'admin-contenders') {
    content = <ContenderDiaryPage />
  } else if (route.name === 'admin-contracts') {
    content = <ContractIdentityReviewPage />
  } else if (route.name === 'profile') {
    // Deliberately NOT gated on isClerkEnabled or on being signed in: settings
    // are settings, and every one of them works on this device with no account
    // at all. The account section is the only part that appears or disappears.
    content = <ProfilePage />
  } else if (route.name === 'player') {
    content = <PlayerPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'player-stats') {
    content = <PlayerStatsTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'player-analytics') {
    content = <PlayerAnalyticsTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'player-history') {
    content = <PlayerHistoryTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team') {
    content = <TeamPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'umpire') {
    content = <UmpirePage id={route.id} />
  } else if (route.name === 'umpire-rankings') {
    content = <UmpireRankingsPage />
  } else if (route.name === 'situational-records') {
    content = (
      <SituationalRecordsPage
        asOf={route.asOf}
        sportId={route.sportId}
        category={route.category}
        metric={route.metric}
        half={route.half}
        sort={route.sort}
        order={route.order}
      />
    )
  } else if (route.name === 'attendance') {
    content = <AttendancePage />
  } else if (route.name === 'pace') {
    content = <PacePage />
  } else if (route.name === 'farm-system') {
    content = <FarmSystemPage />
  } else if (route.name === 'bullpens') {
    content = <BullpenPage />
  } else if (route.name === 'doubleheaders') {
    content = <DoubleheadersPage />
  } else if (route.name === 'manager') {
    content = <ManagerPage id={route.id} />
  } else if (route.name === 'game-notes-debug') {
    content = <GameNotesDebugPage />
  } else if (route.name === 'animation-lab') {
    content = <AnimationLab />
  } else if (route.name === 'between-innings-lab') {
    content = <BetweenInningsLab />
  } else if (route.name === 'wordmark-lab') {
    content = <WordmarkLab />
  } else if (route.name === 'first-scorebook') {
    content = <FirstScorebookPage />
  } else if (route.name === 'logbook') {
    // `season: null` means "newest season with stamps" — only the local
    // collection knows which that is, so LogbookPage resolves it (see route.js).
    // `bookId` is absent on the two original routes ('/logbook',
    // '/logbook/{season}') and present only on the additive
    // '/logbook/book/{id}[/{season}]' routes — LogbookPage.jsx's own resolver
    // treats "absent" as "let the book count decide" (ADR-0036's multi-book
    // addendum).
    // `creating` is '/logbook/new' — a mode of this same resolver, so no other
    // book is ever mounted beside the one being started.
    content = <LogbookPage season={route.season} placing={route.placing} bookId={route.bookId ?? null} creating={route.creating ?? false} />
  } else if (route.name === 'logbook-stats') {
    // Spans every season, so it takes no season param — see route.js for why
    // this branch has to parse ahead of the numeric-season one. `bookId` is
    // the same additive/optional hand-off as the 'logbook' branch above.
    content = <LogbookStatsPage bookId={route.bookId ?? null} />
  } else if (route.name === 'photos') {
    // Keyed on the deep-linked gamePk so navigating between `/photos` and
    // `/photos/{gamePk}` (e.g. the page's own footer link back to the plain
    // browse view) remounts with fresh state instead of reusing the same
    // instance's stale useState seed.
    content = <GamePhotosPage key={route.gamePk ?? 'browse'} initialGamePk={route.gamePk ?? null} />
  } else if (route.name === 'scorecard-lab' && ScorecardLab) {
    content = <ScorecardLab />
  } else if (route.name === 'identity-lab' && IdentityLab) {
    content = <IdentityLab />
  } else if (route.name === 'uniform-names' && UniformNamesPage) {
    content = <UniformNamesPage />
  } else if (route.name === 'team-leaders') {
    content = <TeamLeadersPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-roster') {
    content = <RosterTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-games') {
    content = <GamesTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-numbers') {
    content = <NumbersTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-contracts') {
    content = <ContractsTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-minors') {
    content = <MinorsTab id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-stamp-in') {
    content = <StampInPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-photos') {
    content = <TeamPhotosPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
  } else if (route.name === 'team-transactions') {
    content = <TeamTransactionsPage id={route.id} asOf={route.asOf} sportId={route.sportId} />
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
    // `route.date` and `route.sportId` are only set when the URL says so — a
    // missing date is today and a missing league is MLB, which together make
    // the bare '/' the one canonical home slate (ADR-0056). GameSelect
    // navigates those URLs itself (useNav) when you page a day or tap a league,
    // so both are real, shareable addresses and Back/Forward walk what you
    // visited. `sportId` is left undefined rather than defaulted here — the
    // default lives on GameSelect's own signature, in one place.
    content = (
      <GameSelect
        date={route.date ?? null}
        sportId={route.sportId}
        onPick={openGame}
        onShowLogos={() => go('/logos')}
      />
    )
  }

  // NavProvider hands every deep PlayerLink/TeamLink the History-API `go` so a
  // name anywhere can navigate without threading a prop through the tree.
  return (
    <NavProvider navigate={go}>
      {/* The one global player hover card (desktop only — see PlayerLink.jsx).
          An external store like SyncStatusProvider below, not Context: a page
          can carry dozens of PlayerLinks, and this is the only component that
          re-renders when the hovered player changes. */}
      <PlayerHoverCard />
      {/* Mounted unconditionally — it touches no Clerk API of its own, and the
          sync receipt has to be able to say "this deploy has no account
          feature" rather than rendering nothing. It is an external store, so
          a sync report re-renders only what reads the status, never this
          subtree. */}
      <SyncStatusProvider enabled={isClerkEnabled}>
        {SpoiledDaysCloudSync && (
          <Suspense fallback={null}>
            <SpoiledDaysCloudSync />
          </Suspense>
        )}
        {StampsCloudSync && (
          <Suspense fallback={null}>
            <StampsCloudSync />
          </Suspense>
        )}
        {BooksCloudSync && (
          <Suspense fallback={null}>
            <BooksCloudSync />
          </Suspense>
        )}
        {PreferencesCloudSync && (
          <Suspense fallback={null}>
            <PreferencesCloudSync />
          </Suspense>
        )}
        {OwnerGuards && (
          <Suspense fallback={null}>
            <OwnerGuards />
          </Suspense>
        )}
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
      </SyncStatusProvider>
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
