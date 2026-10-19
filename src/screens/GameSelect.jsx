import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useNav } from '../lib/nav.js'
import { slatePath, teamPath } from '../lib/route.js'
import { fetchSchedule, allStarInfoFrom, fetchSeasonMeta, fetchNextGameDate, fetchTeams } from '../api/schedule.js'
import { fetchRosterIdsForTeams, fetchAffiliates } from '../api/team.js'
import { fetchGameJerseys } from '../api/uniforms.js'
import { fetchTopProspects, countProspectsByTeam } from '../api/prospects.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { useIntroFlag } from '../hooks/preferences/useIntroFlag.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { isPostseasonWindow } from '../lib/postseason/capSlateDate.js'
import { usePostseasonBracket } from '../hooks/postseason/usePostseasonBracket.js'
import { bracketOpensByItself, offDayAliveTeams } from '../lib/postseason/bracketDisplay.js'
import { cardLines } from '../api/postseason/text.js'
import { SPORT_IDS, LEVELS } from '../lib/teams.js'
import { selectGameStatus, selectHasResult } from '../api/select.js'
import { GameCard } from '../components/game/GameCard.jsx'
import { DerbyCard } from '../components/allstar/DerbyCard.jsx'
import { PostseasonBracket } from '../components/bracket/PostseasonBracket.jsx'
import { SeriesPrimer } from '../components/postseason/SeriesPrimer.jsx'
import { WorldSeriesHome } from '../components/worldseries/WorldSeriesHome.jsx'
import { worldSeriesMode } from '../lib/postseason/worldseries/mode.js'
import { usePrimer } from '../hooks/postseason/usePrimer.js'
import { BracketDock } from '../components/bracket/BracketDock.jsx'
import { TeamFilterStrip } from '../components/team/TeamFilterStrip.jsx'
import { SlateMasthead } from '../components/slatehead/SlateMasthead.jsx'
import { fetchLevelCounts } from '../api/slate/levelCounts.js'
import { ladderStops } from '../lib/slate/ladder.js'
import { SiteSearchButton } from '../components/chrome/SiteSearch.jsx'
import { SiteMenuButton } from '../components/chrome/SiteMenu.jsx'
import { LogbookButton } from '../components/chrome/LogbookButton.jsx'
import { goHome } from '../lib/home.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { SiteFooter } from '../components/chrome/SiteFooter.jsx'
import { FavoriteTeamModal } from '../components/account/FavoriteTeamModal.jsx'
import { OffDaySection } from '../components/team/OffDaySection.jsx'
import { WireDock } from '../components/transactions/WireDock.jsx'
import { WireRail } from '../components/transactions/WireRail.jsx'
import { OffseasonSlot } from '../components/offseason/OffseasonSlot.jsx'
import { WinterRail } from '../components/offseason/WinterRail.jsx'
import { useOffseason } from '../hooks/useOffseason.js'
import { useWinter } from '../hooks/useWinter.js'
import { LeaguePicker } from '../components/winter/LeaguePicker.jsx'
import { WINTER_SPORT_ID, isWinterSport } from '../lib/winter/leagues.js'
import { useMediaQuery, WIDE_QUERY, BRACKET_RAIL_QUERY } from '../hooks/useMediaQuery.js'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import {
  reorderLiveGames,
  reorderNationalBroadcasts,
  stackDoubleHeaders,
  stackSuspendedContinuation,
} from '../lib/resultCards.js'

// Same lazy pattern as SiteHeader.jsx: AccountButton (and ContinueScoring's
// use of Clerk hooks) imports @clerk/clerk-react at its top, so neither is
// ever fetched — let alone rendered — on a deploy without Clerk configured.
const AccountButton = isClerkEnabled
  ? lazy(() => import('../components/account/AccountButton.jsx').then((m) => ({ default: m.AccountButton })))
  : null
const ContinueScoring = isClerkEnabled
  ? lazy(() => import('../components/game/ContinueScoring.jsx').then((m) => ({ default: m.ContinueScoring })))
  : null
const MergeReceiptStrip = isClerkEnabled
  ? lazy(() =>
      import('../components/account/MergeReceiptStrip.jsx').then((m) => ({
        default: m.MergeReceiptStrip,
      })),
    )
  : null

// Neither the league nor the date persists anywhere. Both live in the URL
// ('/aaa/08152026'; a missing league means MLB and a missing date means today,
// so bare '/' is both), which is what lets one link name one slate for whoever
// opens it — ADR-0056. The league used to be a My Tally preference instead, and
// that made the app's shortest address mean a different day's league to every
// reader; a link to "today's Triple-A games" could not be sent at all.

// Testing escape hatch: `?nointro` on any slate URL suppresses the first-visit
// welcome modal for that load, so an automated test (or a manual spot-check)
// can hit the site with a cleared localStorage without the modal covering the
// screen. Only affects the modal — the favorite-team default still applies —
// and it's a one-load query flag, never persisted, so a shared link doesn't
// carry it forward.
function welcomeSuppressed() {
  try {
    return new URLSearchParams(window.location.search).has('nointro')
  } catch {
    return false
  }
}

// Screen 1: pick a game. A single level's slate for the chosen date, sorted
// soonest → latest (the favorite team pinned to the top), with a LIVE pill on
// any game in progress. Level is toggled with the thin buttons up top; no
// more search box.
export function GameSelect({
  date = null,
  sportId = SPORT_IDS.MLB,
  leagueId = null,
  onPick,
  onShowLogos,
}) {
  useDocumentTitle(null)
  const navigate = useNav()
  const { favoriteTeamId, hasClubOpinion, setFavoriteTeam } = useFavoriteTeam()
  // Replaces the old "has a club opinion" proxy for first-visit detection —
  // see src/lib/account/intro.js for why the two questions had to be
  // decoupled once the welcome modal grew a second step.
  const [introSeen, markIntroSeen] = useIntroFlag(hasClubOpinion)
  const [showWelcome, setShowWelcome] = useState(!introSeen && !welcomeSuppressed())

  // The displayed date comes from the URL (see App.jsx): bare '/' means today.
  // Paging navigates to the neighboring day's URL rather than bumping local
  // state, so every browsed-to day is a shareable address and the browser's
  // own Back/Forward retrace the days visited. Comparisons below lean on
  // YYYY-MM-DD ordering lexically — no offset math needed.
  const todayStr = toApiDate(new Date())
  // A future date is open in the postseason too (Gary, 2026-09-28, reversing
  // ADR-0087 decision 5): the forward arrow and a future `/{MMDDYYYY}` both
  // show that day's schedule. The bracket above it still reads heading into
  // today, never later (usePostseasonBracket caps its own cutoff).
  const dateStr = date ?? todayStr
  const isToday = dateStr === todayStr

  // The bracket above the cards (#1224, slice 5), and the cards' series
  // line (slice 4) off the same one bracket — MLB only, every date in
  // the postseason window, off days included. Keyed to the SLATE's own
  // YEAR, not today's: a browsed-to past postseason (`/10092025`) needs
  // THAT year's season row, not today's. Keyed on the year alone (not the
  // full date), so paging day to day within one postseason re-fetches
  // nothing.
  const bracketSeason = Number(dateStr.slice(0, 4))
  const bracketSeasonMeta = useAsync(
    () => (sportId === SPORT_IDS.MLB ? fetchSeasonMeta(bracketSeason) : Promise.resolve(null)),
    [sportId, bracketSeason],
  )
  // The bracket draws the 12-club format (2022 on): two Wild Card series per
  // league, each feeding one Division Series. An older postseason has a
  // different shape, so its slate stays the plain one.
  const inPostseasonWindow =
    sportId === SPORT_IDS.MLB && bracketSeason >= 2022 && isPostseasonWindow(dateStr, bracketSeasonMeta.data)
  const postseasonBracket = usePostseasonBracket(inPostseasonWindow ? dateStr : null)
  const wsMode = Boolean(worldSeriesMode(postseasonBracket.bracket)) // the World Series hero replaces the fold and primer (#1906)
  // The bracket stands in for the off-day banner and the empty-slate line
  // only when it can draw. A failed read falls back to the plain slate, never
  // to a blank page.
  const bracketCoversPage = inPostseasonWindow && !postseasonBracket.error

  // The league's roster moves have two presentations of the SAME feed, split at
  // the app's one layout breakpoint. Neither one stands above the game list any
  // more, which is the whole shape of the split: wide, the wire runs down the
  // RIGHT of the games as a sticky rail (WireRail); on a phone there is no
  // sideways room to give it, so it docks to the bottom edge instead
  // (WireDock). Either way the games keep the fold. Both draw a move through
  // MoveRow.jsx — the rail asks for its compact variant.
  const wide = useMediaQuery(WIDE_QUERY)
  // Every level gets the wire, not just MLB (issue #772's own scope grew to
  // cover it) — a level's own thirty clubs own their stories directly rather
  // than rolling up to an MLB parent; see leagueFeed.js's `scopeFor`.
  //
  // The wire follows the reader when they page back, rather than vanishing —
  // a rolling "last 3 days" window is a claim about NOW, which is wrong on a
  // browsed-to past day, but a single day's own moves are still that day's
  // moves regardless of when they're read. `singleDay` (passed to WireRail/
  // WireDock below) is what keeps the claim honest: off today it narrows the
  // feed to exactly the paged date, never a window running past it.
  // OFF ON THE WINTER TAB. `scopeFor` in api/transactions/leagueFeed.js builds
  // its club scope from a bare sportId=17 call, which answers with all seven
  // winter leagues — and a winter club has no roster wire worth reading in the
  // first place. Turning it off is the honest answer, not a missing feature.
  const showWire = !isWinterSport(sportId)
  // OCTOBER (Gary, 2026-10-01: "Rail + board"). In the postseason window the
  // MLB slate's rail and dock hold the BRACKET, and the wire steps aside: a
  // free-agent election is not news beside a Game 3. The wire stays on every
  // minor-league tab and on each club's page. The rail needs BRACKET_RAIL_QUERY
  // (its tree is wider than the wire's column); between that and WIDE_QUERY the
  // bracket keeps its fold above the cards. The dock holds it only on a day
  // with a postseason game — on a day without one the full bracket is already
  // the page (PostseasonBracket.jsx), and a dock would draw it twice.
  const october = bracketCoversPage
  const bracketRoom = useMediaQuery(BRACKET_RAIL_QUERY)
  const bracketInRail = october && wide && bracketRoom
  const bracketInDock =
    october && !wide && Boolean(postseasonBracket.bracket) &&
    (wsMode || !bracketOpensByItself(postseasonBracket.bracket, dateStr))
  const wireOn = showWire && !october
  // The dock renders nothing on a quiet window, and only IT knows that (the
  // answer arrives with the fetch). It reports back so the slate pads its floor
  // for a rail that actually exists — see .screen--wiredock in
  // 04a-wire-dock.css.
  const [dockPresent, setDockPresent] = useState(false)
  const docked = (wireOn && !wide && dockPresent) || bracketInDock
  // The rail's copy of that arrangement, with the default flipped. The dock
  // opts IN to bottom padding once it knows it exists; the rail's shell has to
  // be wide from first paint, because widening it a beat later would slide the
  // whole game grid sideways under the reader. So this starts true — the room
  // is reserved on what is known synchronously — and WireRail reports back only
  // to take it away, on a quiet window or a failed fetch. See WireRail.jsx.
  const [railPresent, setRailPresent] = useState(true)
  const railed = wireOn && wide && railPresent
  // The rail ends where the games end (WireRail.jsx's fit). It measures this
  // column rather than the viewport, so the ref is handed down explicitly — a
  // querySelector inside the rail would hide the dependency from the one file
  // that renders both halves.
  const gamesColRef = useRef(null)

  // Every slate move rewrites the whole address, league and day together, so
  // whichever one you changed the URL still names the exact page on screen.
  // Today is passed as null, which is how slatePath knows to leave the date
  // off (see its header).
  const goToSlate = (apiDate, level, league = null) =>
    navigate(slatePath(apiDate === todayStr ? null : apiDate, level, league))
  const goToDate = (apiDate) => goToSlate(apiDate, sportId, activeLeagueId)
  // A ladder stop carries a leagueId for the WINTER stop and null for the five
  // ordinary levels, because one stop covers four leagues (issue #1055).
  const pickLevel = (stop) => goToSlate(dateStr, stop.sportId, stop.leagueId)

  // IS THERE A SIXTH TAB TODAY? Read off each winter league's own published
  // schedule, never off the clock (hooks/useWinter.js). Fails closed in every
  // direction: until the calendar lands, and forever if it never does, the rail
  // is the five levels it has always been.
  const onWinter = isWinterSport(sportId)
  const winterBall = useWinter(dateStr, sportId, leagueId)
  // The URL's own league is used until the calendar can confirm or replace it,
  // so the first fetch on '/mex/12152025' asks for the Mexican league rather
  // than for a bare sportId=17 — which would answer with four other leagues'
  // games, three of which this app does not ship.
  const activeLeagueId = onWinter ? (winterBall.leagueId ?? leagueId ?? null) : null
  // The masthead's ladder draws WINTER last, after a dashed divider, off the
  // farm system's rail (lib/slate/ladder.js; the D1 handoff, 2026-10-18).
  const levels = useMemo(
    () =>
      winterBall.tabVisible
        ? [...LEVELS, { label: 'WINTER', sportId: WINTER_SPORT_ID, leagueId: winterBall.defaultLeagueId }]
        : LEVELS,
    [winterBall.tabVisible, winterBall.defaultLeagueId],
  )
  const slate = useAsync(
    () =>
      onWinter && !activeLeagueId
        ? Promise.resolve([])
        : fetchSchedule(dateStr, sportId, undefined, activeLeagueId),
    [dateStr, sportId, onWinter, activeLeagueId],
  )
  const { loading, error, data } = slate
  // Each level's game count for the ladder: one score-free call for all five
  // (api/slate/levelCounts.js), and the winter's off the calendar useWinter
  // already holds. Re-read on foreground, as the slate is, so a makeup added
  // or a game dropped since the first read moves the count too.
  const levelCounts = useAsync(() => fetchLevelCounts(dateStr), [dateStr], { refetchOnForeground: true })
  const stops = useMemo(
    () => ladderStops({ levels, counts: levelCounts.data, sportId, winterGames: winterBall.games }),
    [levels, levelCounts.data, sportId, winterBall.games],
  )

  // A COLD load — the first fetch for this date/level, with nothing on the page
  // under the loader yet. Only then does the loader reserve a screen (see
  // .screen--coldload in 03-slate-header.css). Deliberately not a bare
  // `loading`: on a day with NO games `hasData` never becomes true, so the live
  // poll re-renders the loader every refresh, and a permanent reserve would
  // wedge a screen-tall gap above the Off Day grid. useAsync keeps the last-good
  // `data` across a reload and nulls it on a deps change, which is exactly the
  // line wanted here — a date or level switch is a cold load again.
  const coldLoad = loading && !data

  // The favorite team is always an MLB club (FavoriteTeamModal only offers
  // those), so on a MiLB level its own game never appears — pin its current
  // affiliate at THIS level instead. Season keys off the slate's own date
  // (not "now") so paging near a year boundary still asks for the season the
  // displayed date actually falls in; fetchAffiliates degrades to [] offline.
  const season = Number(dateStr.slice(0, 4))
  // An AFL club reports `parentOrgName: "Office of the Commissioner"` — it is a
  // composite of six or seven organisations and an affiliate of nothing, and
  // the same is true of every club in the three winter leagues. So there is no
  // club here for a favourite to resolve to, and asking would spend a fetch to
  // be told so.
  const affiliates = useAsync(
    () =>
      sportId === SPORT_IDS.MLB || onWinter
        ? Promise.resolve([])
        : fetchAffiliates(favoriteTeamId, season),
    [favoriteTeamId, season, sportId, onWinter],
  )
  const favoriteAffiliateIds = useMemo(
    () => new Set((affiliates.data ?? []).map((a) => a.id)),
    [affiliates.data],
  )

  // A back-to-back twin bill collapses to one card until game 1 starts —
  // see stackDoubleHeaders for why game 2's scheduled time is a placeholder
  // rather than a time. Applied BEFORE everything downstream (jersey/broadcast
  // batching, the reorder passes) so the
  // whole screen agrees on how many cards this day has.
  const stackedDh = useMemo(() => stackDoubleHeaders(data ?? []), [data])
  // A second stacking pass for a suspended game's same-day continuation
  // (see stackSuspendedContinuation's header) — runs on stackedDh's output
  // so the two passes never fight over the same gamePk.
  const stackedSuspended = useMemo(() => stackSuspendedContinuation(stackedDh.games), [stackedDh])
  const sorted = useMemo(
    () => sortGames(stackedSuspended.games, favoriteTeamId, favoriteAffiliateIds),
    [stackedSuspended, favoriteTeamId, favoriteAffiliateIds],
  )
  // The series primer (ADR-0087): off unless the rail is up.
  const primer = usePrimer({
    enabled: bracketInRail,
    postseason: postseasonBracket,
    slateDate: dateStr,
    isToday,
    games: data,
    favoriteTeamId,
  })

  // A same-day alternate/City Connect posting doesn't reach jerseysData
  // (public/data/jerseys.json) until tomorrow night's cron — one batched live
  // uniforms/game call for today's whole slate closes that gap, the same fix
  // #448 gave the in-game masthead (useGameData.js's liveJerseyTreatment),
  // just batched across every card instead of piggybacking on a per-game feed
  // fetch that doesn't exist here. Only fetched for today: a past day's slate
  // is already covered by the cron by the time anyone pages back to it.
  const gamePksKey = useMemo(() => sorted.map((g) => g.gamePk).join(','), [sorted])
  const liveJerseys = useAsync(
    () =>
      isToday && gamePksKey
        ? fetchGameJerseys(gamePksKey.split(',').map(Number))
        : Promise.resolve({}),
    [isToday, gamePksKey],
  )

  // Which of today's slate cards carry a national-TV assignment (FOX/FS1/
  // ESPN/TBS/Apple TV/…). No fetch of its own: `normalizeGame` reads it off
  // the schedule request the slate already makes (api/broadcast.js). It used
  // to be a second, cross-origin call to ESPN's scoreboard, which meant the
  // national-first ordering below could only settle after that call landed —
  // and, since ESPN's edge began refusing browser requests outright, never
  // settled at all.
  const nationalBroadcasts = useMemo(() => {
    const out = {}
    for (const g of sorted) if (g.nationalBroadcast) out[g.gamePk] = g.nationalBroadcast
    return out
  }, [sorted])

  // Every active club at this level (see fetchTeams), independent of the
  // date — so it barely ever refetches as the user pages day to day.
  const levelTeams = useAsync(
    () => fetchTeams(sportId, activeLeagueId),
    [sportId, activeLeagueId],
  )

  // This level's full league minus whoever's on today's slate = the clubs
  // with an off day, favorite (or its affiliate, on a MiLB level — see
  // sortGames below) first then alphabetical. Works at every level: MLB's
  // fixed 30, or a MiLB league's own current roster. When NONE of a level's
  // clubs are playing this comes back as the WHOLE league — an empty break
  // day, or (MLB only) All-Star Game day (whose lone "AL @ NL All-Stars" row
  // carries squad ids no club owns). That all-league case is kept ON PURPOSE:
  // the break has no club games, so the full grid gives the slate something
  // to browse instead of a bare "No games scheduled."
  // In the postseason window (Gary's decision, 2026-09-28): only postseason
  // clubs still alive with no game today — not every idle club at the level.
  // Uses the SAME bracket the fold and the full view draw, so "alive" can
  // never disagree between the grid and the bracket above it.
  const offDayTeams = useMemo(() => {
    const playing = new Set(sorted.flatMap((g) => [g.away.id, g.home.id]))
    const all = bracketCoversPage
      ? offDayAliveTeams(postseasonBracket.bracket, playing)
      : (levelTeams.data ?? []).filter((t) => !playing.has(t.id))
    if (!all.length) return []
    return [...all].sort((a, b) => {
      const pa = isPinnedTeam(a.id, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
      const pb = isPinnedTeam(b.id, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
      if (pa !== pb) return pa - pb
      return (a.name ?? '').localeCompare(b.name ?? '')
    })
  }, [bracketCoversPage, postseasonBracket.bracket, levelTeams.data, sorted, favoriteTeamId, favoriteAffiliateIds])

  // All-Star break detection — only worth a fetch once the MLB slate has
  // already come back empty (every other day, this never fires). Turns a
  // bare "No games scheduled." into the Derby hand-off card on Derby night,
  // or a plain break notice on the rest of the gameless week.
  // The break window is a date range, not an MLB-only concept — every level
  // goes dark the same week — so the lookup is gated on ANY level's slate
  // coming back empty, not just MLB's.
  const isEmptyDay = !loading && !error && sorted.length === 0
  // ONE fetch, two questions: this row carries the break bounds AND the dates
  // that say whether the season is over, so the offseason gate below costs an
  // empty day nothing it was not already spending.
  const seasonMeta = useAsync(
    () => (isEmptyDay ? fetchSeasonMeta(season) : Promise.resolve(null)),
    [isEmptyDay, season],
  )
  const breakWindow = useMemo(
    () => allStarBreakWindow(allStarInfoFrom(seasonMeta.data), dateStr),
    [seasonMeta.data, dateStr],
  )
  // The Derby itself is an MLB-only event (DerbyCard below) — a MiLB slate on
  // that same date still gets the plain All-Star Break banner, not the card.
  const isDerbyDay = sportId === SPORT_IDS.MLB && Boolean(breakWindow?.isDerbyDay)
  const isBreakWindow = Boolean(breakWindow) && !isDerbyDay
  const allStarPending = isEmptyDay && seasonMeta.loading

  // Is the slate looking at a winter? Read off the dates statsapi publishes for
  // the season, never off the games coming back empty (hooks/useOffseason.js).
  const { phase: offseason, winter } = useOffseason(dateStr, sportId, seasonMeta.data)

  // The banner's date always comes from an actual forward schedule scan
  // (fetchNextGameDate), never straight from statsapi's firstDate2ndHalf —
  // verified live that field can be well past the real next game (e.g. it
  // says the 19th when a single game already lands the 16th and the full
  // slate is back the 17th), so it only bounds the break WINDOW here, never
  // supplies the date text. Same lookup covers the generic "Off Day" case
  // (a level's own single day off, e.g. a MiLB Monday) outside any break.
  // `!offseason` spares a winter morning the scan entirely: it reaches ten days
  // and the next game is a hundred away, so it can only ever answer null.
  // The last clause is the winter's copy of `!offseason`, and it is there for
  // the identical reason (ADR-0074): a bookmarked '/fall' read in July reaches
  // ten days forward one fetch at a time, and the next AFL game is two months
  // away, so the scan can only ever answer null — expensively, on exactly the
  // day it cannot help. The calendar already knows the league is out of season.
  const winterDark = onWinter && winterBall.ready && !winterBall.tabVisible
  // A postseason off day is not the generic "Off Day" banner: the bracket's
  // fold above the cards already says so (Gary's decision, 2026-09-28 — the
  // bracket is the whole page there), and this lookup would otherwise ask
  // fetchNextGameDate a question the bracket already answers.
  const needsResumeLookup =
    isEmptyDay && !isDerbyDay && !allStarPending && !offseason && !winterDark && !bracketCoversPage
  const resumeLookup = useAsync(
    () =>
      needsResumeLookup
        ? fetchNextGameDate(sportId, dateStr, 10, activeLeagueId)
        : Promise.resolve(null),
    [needsResumeLookup, sportId, dateStr, activeLeagueId],
  )
  const resumeLookupPending = needsResumeLookup && resumeLookup.loading
  const resumeDate = resumeLookup.data
  const showBreakBanner = isBreakWindow && !!resumeDate
  const showOffDayBanner = needsResumeLookup && !isBreakWindow && !!resumeDate

  // A day you've paged BACK to (any date before today) gets the past-day
  // treatment: each Final game's card adds a Box score button (sealed, as on
  // every scoring surface) beside the lineup flow. Today gets the SAME treatment
  // once every one of its games has gone Final — at that point there's no more
  // live refreshing to do, so it's effectively already a "day you're looking
  // back on". Before that (any game still in Preview/Live), today keeps the
  // ordinary live-refresh slate. A postponed or cancelled game reports
  // abstractGameState 'Final' (coded 'D' / 'C') but has no result (#1248), so
  // `selectHasResult` keeps it on the ordinary card.
  // A postponed game also reports abstractGameState 'Final' (see above), so
  // this alone means "nothing on today's slate is still Preview/Live" —
  // exactly the "day is done" signal, without separately excluding
  // postponed games (a slate that's 4 Finals + 1 postponement still counts).
  const todayAllFinal =
    isToday && sorted.length > 0 && sorted.every((g) => g.abstractState === 'Final')
  const showPastDayTreatment = dateStr < todayStr || todayAllFinal
  // The slate's actual render order, in four tiers: the favorite team's own
  // game, then the games already underway (reorderLiveGames), then the
  // national-broadcast games among those that haven't started
  // (reorderNationalBroadcasts), then the rest — each tier internally still in
  // `sorted`'s soonest → latest order, and the Finals still last. A game in
  // progress outranks a national game that hasn't thrown a pitch, which is why
  // the live pass runs FIRST and the national pass is confined to what's left.
  const gamesForDisplay = useMemo(() => {
    const pinned = (g) => isPinned(g, favoriteTeamId, favoriteAffiliateIds)
    const liveFirst = reorderLiveGames(sorted, pinned)
    return reorderNationalBroadcasts(liveFirst, nationalBroadcasts, pinned)
  }, [sorted, nationalBroadcasts, favoriteTeamId, favoriteAffiliateIds])

  // "N prospects on this roster" badge — MiLB games only (the slate's level
  // toggle is single-select, so gating this fetch on sportId covers every
  // card on screen at once). Rosters are fetched per team on the current
  // slate; the prospects snapshot is session-memoized after its first call
  // anywhere in the app.
  const prospects = useAsync(
    () => (sportId === SPORT_IDS.MLB ? Promise.resolve(null) : fetchTopProspects()),
    [sportId],
  )
  const teamIdsKey = useMemo(
    () => [...new Set(sorted.flatMap((g) => [g.away.id, g.home.id]))].join(','),
    [sorted],
  )
  const rosterIds = useAsync(
    () =>
      sportId === SPORT_IDS.MLB
        ? Promise.resolve({})
        : fetchRosterIdsForTeams(teamIdsKey ? teamIdsKey.split(',').map(Number) : []),
    [teamIdsKey, sportId],
  )
  const prospectCounts = useMemo(() => {
    const ids = new Set((prospects.data?.players ?? []).map((p) => p.playerId))
    return countProspectsByTeam(rosterIds.data ?? {}, ids)
  }, [rosterIds.data, prospects.data])

  return (
    <div
      className={`screen screen--slate${coldLoad ? ' screen--coldload' : ''}${
        docked ? ' screen--wiredock' : ''
      }${railed ? ' screen--wirerail' : ''}${bracketInRail ? ' screen--bracketrail' : ''}`}
    >
      {/* The D1 masthead: the brand bar, the ladder card (level + day) and,
          on a phone, the compact bar that replaces the card on scroll. Every
          move navigates (ADR-0056). The brand reloads this level's slate for today (a
          full page load — see lib/home.js). The pass's Live scores switch
          and Reveal all are no longer drawn here (the D1 handoff). */}
      <SlateMasthead
        stops={stops}
        dateStr={dateStr}
        isToday={isToday}
        wide={wide}
        onLevel={pickLevel}
        onDate={goToDate}
        onToday={() => goToDate(todayStr)}
        onHome={() => goHome(slatePath(null, sportId, activeLeagueId))}
        actions={
          <>
            <SiteSearchButton className="slatemast__icon" />
            <LogbookButton className="slatemast__icon" />
            <SiteMenuButton className="slatemast__icon" />
            {AccountButton && (
              <Suspense fallback={null}>
                <AccountButton />
              </Suspense>
            )}
          </>
        }
      />

      {/* Four leagues share the one WINTER stop, so the choice between them is
          made here — above the club strip, which the pick then scopes. Every
          chip is a real address, never local state (ADR-0056). */}
      {onWinter && (
        <LeaguePicker
          leagues={winterBall.leagues}
          leagueId={activeLeagueId}
          dateStr={dateStr}
          isToday={isToday}
        />
      )}

      {/* This level's whole club set as round chips (TeamFilterStrip, the
          D1 "Your clubs" row): a tap opens that club's page, the favourite is
          filled and centred on arrival. The wrapper is ALWAYS rendered and
          holds the strip's height open while fetchTeams is in flight — see
          .slatestrip in 03-slate-header.css (a ~0.37 CLS fix). */}
      <div className="slatestrip">
        {levelTeams.data?.length > 0 && (
          <TeamFilterStrip
            teams={levelTeams.data}
            selectedTeamId={null}
            onSelect={(id, team) => navigate(teamPath(id, { name: team?.name }))}
            showMlbPin={false}
            showArrows
            centerTeamId={favoriteTeamId}
            markedTeamId={favoriteTeamId}
            ariaLabel={`Browse ${stops.find((s) => s.picked)?.fullName ?? ''} teams`}
            className="teamfilterstrip--nav teamfilterstrip--chips"
          />
        )}
      </div>

      {/* Signed in only: the merge-receipt strip fires only once every
          configured channel has finished its first pull and the full receipt
          on /profile hasn't been dismissed yet (PRD §5.3's deferred slate
          pointer). See MergeReceiptStrip.jsx. */}
      {MergeReceiptStrip && (
        <Suspense fallback={null}>
          <MergeReceiptStrip />
        </Suspense>
      )}

      {/* The slate's two columns, wide: the games, and the league's roster
          wire beside them. Below WIDE_QUERY this wrapper is a plain block and
          the rail is not rendered at all — the phone gets the dock at the foot
          of this screen instead. See .slatebody in 25-wide-layout.css. */}
      <div className="slatebody">
        <div className="slatebody__main" ref={gamesColRef}>
          <AsyncStatus
            loading={loading}
            error={error}
            hasData={sorted.length > 0}
            errorMessage="Couldn’t load games. Check your connection and try again."
            onRetry={slate.reload}
            // Suppressed for a day the break window or Off Day banner will claim
            // (below) — briefly while either lookup is still in flight too, so
            // neither flashes "No games scheduled." before the fetch resolves.
            emptyMessage={
              seasonMeta.loading || breakWindow || resumeLookupPending ||
              showOffDayBanner || offseason || bracketCoversPage
                ? null
                : 'No games scheduled.'
            }
          />

          {inPostseasonWindow && <WorldSeriesHome bracket={postseasonBracket.bracket} slateDate={dateStr} wide={wide} />}

          {/* The postseason bracket (#1224, slice 5) — above the cards, every
              date in the window, off days included. On an off day this is
              the only thing here besides the chrome above (Gary's decision,
              2026-09-28: "the bracket is the whole page"). */}
          {inPostseasonWindow && !bracketInRail && !bracketInDock && (
            <PostseasonBracket
              bracket={postseasonBracket.bracket}
              cutoff={postseasonBracket.cutoff}
              slateDate={dateStr}
            />
          )}

          {/* THE OFFSEASON PAGE (issues #1038, #1077). It moves nothing: the
              club strip, the level tabs and the date banner all stay where they
              are in season. The empty games area holds the winter instead of
              the words "No games scheduled." — OffseasonSlot.jsx picks which of
              the two leads it, and says why MLB's and a level's differ. */}
          {winter && (
            <OffseasonSlot dateStr={dateStr} sportId={sportId} winter={winter} wide={wide} />
          )}

          {showBreakBanner && (
            <div className="break-banner" role="note">
              <span className="break-banner__text">All-Star Break</span>
              <span className="break-banner__detail">Games resume {humanDate(resumeDate)}</span>
            </div>
          )}

          {showOffDayBanner && (
            <div className="offday-banner" role="note">
              <span className="offday-banner__text">Off Day</span>
              <span className="offday-banner__detail">Games resume {humanDate(resumeDate)}</span>
            </div>
          )}

          {/* role="region" (not a bare div) so the aria-label is actually
              honored — an aria-label on a role-less generic element is
              discarded. */}
          <div className="slate-main" id="slate-games" role="region" aria-label="Games">
            <ul className="gamelist">
              {sorted.length === 0 && isDerbyDay && (
                <li>
                  <DerbyCard />
                </li>
              )}
              {gamesForDisplay.map((g, idx) => {
                const pinnedTeamId = isPinned(g, favoriteTeamId, favoriteAffiliateIds)
                  ? favoriteTeamId
                  : null
                const pCount = (prospectCounts[g.away.id] ?? 0) + (prospectCounts[g.home.id] ?? 0)
                // The first cards' marks are the slate's largest above-the-fold
                // images — its LCP candidate — so they skip TeamLogo's default
                // lazy loading (which would defer exactly the images the first
                // paint is waiting on). Two cards ≈ one phone viewport.
                const eager = idx < 2
                const isPastFinal = showPastDayTreatment && selectHasResult(g)
                // A past Final and a Suspended game (a paused checkpoint) both offer the box score.
                const isSuspended = selectGameStatus(g).isSuspended
                const postseasonLine = postseasonBracket.bracket ? cardLines(g, postseasonBracket.bracket) : null
                return (
                  <li key={`${g.sportId}-${g.gamePk}`}>
                    <GameCard
                      game={g}
                      pinnedTeamId={pinnedTeamId}
                      prospectCount={pCount}
                      liveJerseys={liveJerseys.data}
                      national={nationalBroadcasts[g.gamePk]}
                      eager={eager}
                      postseasonLine={postseasonLine}
                      stackedGame={stackedDh.stackedBehind.get(g.gamePk) ?? stackedSuspended.stackedBehind.get(g.gamePk) ?? null}
                      onSelect={() => onPick(g, dateStr)}
                      onBoxScore={isPastFinal || isSuspended ? () => onPick(g, dateStr, 'boxscore') : null}
                    />
                  </li>
                )
              })}
            </ul>

            {/* Any idle club, the whole-league All-Star case included. In the
                winter that is every club — and wide, it moves to the rail
                (WinterRail.jsx, #1078). */}
            {/* October: the survivors' board, or the series primer on a primer day. */}
            {october && !wsMode && <SeriesPrimer part="main" primer={primer} />}
            {offDayTeams.length > 0 && !(wide && winter) && !october && (
              <OffDaySection
                teams={offDayTeams}
                favoriteTeamId={favoriteTeamId}
                favoriteAffiliateIds={favoriteAffiliateIds}
                winter={Boolean(winter)}
              />
            )}
          </div>
        </div>

        {/* The league's roster moves, live off the wire (issue #772). On
            today's slate a rolling three-day window; paged back to a past
            day, `singleDay` narrows it to that day's own moves — a window
            running past the date on screen would read as a bug, not news.
            Renders null while loading, on failure, and on a quiet window, and
            reports which back so the shell can give the reserved width up.
            WIDE ONLY: the phone's copy of this feed is the dock at the foot
            of this screen. See WireRail.jsx. */}
        {wireOn && wide && !winter && (
          <WireRail
            endDate={dateStr}
            sportId={sportId}
            onPresence={setRailPresent}
            fitTo={gamesColRef}
            singleDay={!isToday}
          />
        )}

        {/* October's copy of that column: the bracket, or the primer's. */}
        {bracketInRail && <SeriesPrimer part="rail" primer={primer} />}

        {/* The slot the wire left; `railed` reserves it (WinterRail.jsx). */}
        {wide && winter && (
          <WinterRail
            winter={winter}
            teams={offDayTeams}
            favoriteTeamId={favoriteTeamId}
            favoriteAffiliateIds={favoriteAffiliateIds}
          />
        )}
      </div>

      {/* Signed-in only, and only when the cloud scorebook has entries —
          renders null otherwise, so the slate is untouched for everyone
          else. Signed OUT, the same slot instead pitches an account once
          three-plus games are in progress on this device. See
          ContinueScoring.jsx. */}
      {ContinueScoring && (
        <Suspense fallback={null}>
          <ContinueScoring />
        </Suspense>
      )}

      <SiteFooter onShowLogos={onShowLogos} />

      {showWelcome && (
        <FavoriteTeamModal
          favoriteTeamId={favoriteTeamId}
          onSave={setFavoriteTeam}
          onClose={(step) => {
            markIntroSeen(step)
            setShowWelcome(false)
          }}
        />
      )}

      {/* Last child on purpose: the dock is fixed, so its position on the page
          is decided by CSS, but being last puts it after the games in the
          DOM — which is the tab order a thumb-height control should have, and
          which keeps the slate's own content ahead of it for a screen reader.
          It publishes --wire-rail-h and reports whether it rendered at all;
          `docked` above turns that into the screen's bottom padding. */}
      {bracketInDock && (
        <BracketDock
          bracket={postseasonBracket.bracket}
          cutoff={postseasonBracket.cutoff}
          slateDate={dateStr}
        />
      )}
      {wireOn && !wide && !winter && (
        <WireDock
          endDate={dateStr}
          sportId={sportId}
          onPresence={setDockPresent}
          singleDay={!isToday}
        />
      )}
    </div>
  )
}

// Turns fetchAllStarInfo's two season dates into "is this empty day part of
// the break, and is it Derby night specifically" for the given slate date.
// The All-Star Game's own date is deliberately EXCLUDED (dateStr < resumeDate
// stops one day short of it, and the Derby falls the day before): that day
// already has a real game row from fetchSchedule (see fetchAllStarInfo's
// header note), so this window never needs to cover it.
function allStarBreakWindow(info, dateStr) {
  if (!info) return null
  const [y, m, d] = info.allStarDate.split('-').map(Number)
  const derbyDate = toApiDate(addDays(new Date(y, m - 1, d), -1))
  if (dateStr < derbyDate || dateStr >= info.firstDate2ndHalf) return null
  return { isDerbyDay: dateStr === derbyDate, resumeDate: info.firstDate2ndHalf }
}

function isPinned(game, favoriteTeamId, favoriteAffiliateIds) {
  return (
    game.away.id === favoriteTeamId ||
    game.home.id === favoriteTeamId ||
    !!favoriteAffiliateIds?.has(game.away.id) ||
    !!favoriteAffiliateIds?.has(game.home.id)
  )
}

// Same favorite-or-its-affiliate check as isPinned, for a single team id
// rather than a game's away/home pair — the off-day grid's sort/highlight.
function isPinnedTeam(id, favoriteTeamId, favoriteAffiliateIds) {
  return id === favoriteTeamId || !!favoriteAffiliateIds?.has(id)
}

// Soonest → latest by first pitch; the favorite team's game (or, on a MiLB
// level, its affiliate's game) floats to the top. A Final game (including a
// postponed one, which also reports abstractGameState 'Final' — see the
// showPastDayTreatment comment above) sinks to the bottom FIRST, ahead of the
// pin — nothing left to watch there, so it shouldn't crowd the still-playing
// games off the top of a day that's still in progress. The favorite's game
// still leads once it lands in that bottom group, rather than getting lost
// in start-time order among the rest of the day's finals.
function sortGames(games, favoriteTeamId, favoriteAffiliateIds) {
  return [...games].sort((a, b) => {
    const fa = a.abstractState === 'Final' ? 1 : 0
    const fb = b.abstractState === 'Final' ? 1 : 0
    if (fa !== fb) return fa - fb
    const pa = isPinned(a, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
    const pb = isPinned(b, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
    if (pa !== pb) return pa - pb
    return new Date(a.gameDate) - new Date(b.gameDate)
  })
}
