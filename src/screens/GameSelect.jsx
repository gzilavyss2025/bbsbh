import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useNav } from '../lib/nav.js'
import { apiDateToUrl, slatePath, teamPath } from '../lib/route.js'
import { fetchDayVideos } from '../api/gamehighlights.js'
import { fetchSchedule, fetchSlateScores, fetchAllStarInfo, fetchNextGameDate, fetchTeams } from '../api/schedule.js'
import { fetchRosterIdsForTeams, fetchAffiliates } from '../api/team.js'
import { fetchGameJerseys } from '../api/uniforms.js'
import { fetchNationalBroadcasts } from '../api/broadcast.js'
import { fetchTopProspects, countProspectsByTeam } from '../api/prospects.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/preferences/useFavoriteTeam.js'
import { useIntroFlag } from '../hooks/preferences/useIntroFlag.js'
import { usePreferences } from '../hooks/preferences/usePreferences.js'
import { usePromptDismiss } from '../hooks/preferences/usePromptDismiss.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { SPORT_IDS, LEVELS } from '../lib/teams.js'
import { selectGameStatus } from '../api/select.js'
import { GameCard } from '../components/game/GameCard.jsx'
import { DerbyCard } from '../components/allstar/DerbyCard.jsx'
import { PastGameFlipCard } from '../components/game/PastGameFlipCard.jsx'
import { LevelNav } from '../components/team/LevelNav.jsx'
import { TeamFilterStrip } from '../components/team/TeamFilterStrip.jsx'
import { TallyLockup } from '../components/chrome/TallyBrand.jsx'
import { SiteSearchButton } from '../components/chrome/SiteSearch.jsx'
import { SiteMenuButton } from '../components/chrome/SiteMenu.jsx'
import { LogbookButton } from '../components/chrome/LogbookButton.jsx'
import { goHome } from '../lib/home.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { SiteFooter } from '../components/chrome/SiteFooter.jsx'
import { FavoriteTeamModal } from '../components/account/FavoriteTeamModal.jsx'
import { OffDaySection } from '../components/team/OffDaySection.jsx'
import { AsyncStatus } from '../components/ui/AsyncGate.jsx'
import { useDayCardMeta } from '../hooks/useDayCardMeta.js'
import {
  FILTER_CHIPS,
  reorderGameOfTheNight,
  reorderLiveGames,
  reorderNationalBroadcasts,
} from '../lib/resultCards.js'
import { useScoresUnlocked } from '../hooks/useScoresUnlocked.js'
import { ConsentModal } from '../components/seal/ConsentModal.jsx'
import { useCopy } from '../copy/copyContext.js'
import { formatResetTime, nextResetAt } from '../lib/scoresUnlocked.js'
import { slateScoreLine } from '../lib/slateScoreLine.js'
import { trackToggleConsent, TOGGLES, ACTIONS, SURFACES } from '../lib/analytics.js'

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

// The chosen level survives leaving the slate (someone scoring an A+ affiliate
// all season shouldn't reset to MLB every time they come back). It lives in the
// My Tally preference document (`usePreferences`) rather than its own
// `bbsbh:level` key — that old key is still read once as a migration seed, and
// the value now travels between a signed-in user's devices. The date
// deliberately does NOT persist anywhere — it lives in the URL ('/{MMDDYYYY}',
// bare '/' = today), so a paged-to day is shareable and "today" is always the
// right place a fresh visit starts.

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
export function GameSelect({ date = null, onPick, onShowLogos }) {
  useDocumentTitle(null)
  const navigate = useNav()
  // The level is a field of the My Tally preference document now, so it
  // travels between a signed-in user's devices along with the club. Reading it
  // through the hook rather than holding a second copy in local state is what
  // keeps a change made on another device from being ignored until a reload.
  const { level: sportId, set: setPreference } = usePreferences()
  const { favoriteTeamId, hasClubOpinion, setFavoriteTeam } = useFavoriteTeam()
  // Replaces the old "has a club opinion" proxy for first-visit detection —
  // see src/lib/account/intro.js for why the two questions had to be
  // decoupled once the welcome modal grew a second step.
  const [introSeen, markIntroSeen] = useIntroFlag(hasClubOpinion)
  const [showWelcome, setShowWelcome] = useState(!introSeen && !welcomeSuppressed())
  const pickLevel = (id) => setPreference('level', id)

  // The displayed date comes from the URL (see App.jsx): bare '/' means today.
  // Paging navigates to the neighboring day's URL rather than bumping local
  // state, so every browsed-to day is a shareable address and the browser's
  // own Back/Forward retrace the days visited. Comparisons below lean on
  // YYYY-MM-DD ordering lexically — no offset math needed.
  const todayStr = toApiDate(new Date())
  const dateStr = date ?? todayStr
  const isToday = dateStr === todayStr

  // Site-wide "Scores Unlocked" pass. The toggle is only OFFERED on today's
  // slate — you can't retroactively consent to a day you've paged back to — but
  // its EFFECT is date-scoped; see `scoresUnlocked` below. The consent modal
  // gates turning it on; turning it off is immediate and takes today's consent
  // back with it.
  const { t: copy } = useCopy()
  const { passActive, resetAt, spoilersOffFor, enable: enableUnlock, disable: disableUnlock } =
    useScoresUnlocked()
  // Spoilers are off for THIS slate's date when the pass is running (today) or
  // when this is a day already consented to and locked in (ADR-0026). A past day
  // you spoiled keeps showing plainly forever — you agreed to see it, and
  // pretending otherwise the next morning would be a fiction.
  const scoresUnlocked = spoilersOffFor(dateStr)
  const [askUnlock, setAskUnlock] = useState(false)
  // The `scores-unlocked-local` contextual prompt (PRD-adjacent, §6.2's honest-
  // wording mandate): right after the user consents, quietly confirm the
  // choice does NOT follow their other devices — bbsbh:scoresUnlocked is
  // device-local by hard invariant (P2) and always will be, so this has to be
  // said plainly rather than left to be assumed from the rest of My Tally's
  // sync claims. Tied to the actual enable action (not to passActive being
  // true on a reload), and one-shot forever via usePromptDismiss.
  const [justEnabledPass, setJustEnabledPass] = useState(false)
  const [passScopeNoteDismissed, dismissPassScopeNote] = usePromptDismiss('scores-unlocked-local')
  const resetLabel = formatResetTime(resetAt ?? nextResetAt())
  const goToDate = (apiDate) =>
    navigate(apiDate === todayStr ? '/' : slatePath(apiDate))
  const pageDay = (n) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    goToDate(toApiDate(addDays(new Date(y, m - 1, d), n)))
  }

  const slate = useAsync(() => fetchSchedule(dateStr, sportId), [dateStr, sportId])
  const { loading, error, data } = slate

  // Slate score line — fetched ONLY while the Scores Unlocked pass is on AND we
  // are on today's slate (a past day has its own reveal-all path). The default
  // slate model stays score-free (see fetchSchedule/normalizeGame); this rides a
  // separate request whose data never merges into it. Degrades to {} on failure,
  // so a card silently falls back to its ordinary spoiler-free self. Re-fetches
  // on foreground (the score-critical convention) so a checked-in glance is fresh.
  const showSlateScores = scoresUnlocked
  const slateScores = useAsync(
    () => (showSlateScores ? fetchSlateScores(dateStr, sportId) : Promise.resolve({})),
    [showSlateScores, dateStr, sportId],
    { refetchOnForeground: showSlateScores },
  )
  const liveLineFor = (game) =>
    showSlateScores ? slateScoreLine(slateScores.data?.[game.gamePk], game) : null

  // The favorite team is always an MLB club (FavoriteTeamModal only offers
  // those), so on a MiLB level its own game never appears — pin its current
  // affiliate at THIS level instead. Season keys off the slate's own date
  // (not "now") so paging near a year boundary still asks for the season the
  // displayed date actually falls in; fetchAffiliates degrades to [] offline.
  const season = Number(dateStr.slice(0, 4))
  const affiliates = useAsync(
    () =>
      sportId === SPORT_IDS.MLB
        ? Promise.resolve([])
        : fetchAffiliates(favoriteTeamId, season),
    [favoriteTeamId, season, sportId],
  )
  const favoriteAffiliateIds = useMemo(
    () => new Set((affiliates.data ?? []).map((a) => a.id)),
    [affiliates.data],
  )

  const sorted = useMemo(
    () => sortGames(data ?? [], favoriteTeamId, favoriteAffiliateIds),
    [data, favoriteTeamId, favoriteAffiliateIds],
  )

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

  // Which of today's slate cards carry a national-TV assignment (FOX/ESPN/
  // TBS/Apple TV+/…) — one batched ESPN scoreboard call per date, unlike
  // liveJerseys above this isn't today-only: a past day's national broadcast
  // is a fixed historical fact, not something a nightly cron needs to catch
  // up on, so it's worth fetching whatever day is on screen. MLB only (ESPN
  // has no MiLB scoreboard); fetchNationalBroadcasts degrades to {} for a
  // MiLB games list anyway, but skipping the call outright avoids a wasted
  // fetch every time a MiLB level is paged through.
  const nationalBroadcasts = useAsync(
    () =>
      sportId === SPORT_IDS.MLB && sorted.length
        ? fetchNationalBroadcasts(dateStr, sorted)
        : Promise.resolve({}),
    [sportId, dateStr, gamePksKey],
  )

  // Every active club at this level (see fetchTeams), independent of the
  // date — so it barely ever refetches as the user pages day to day.
  const levelTeams = useAsync(() => fetchTeams(sportId), [sportId])

  // This level's full league minus whoever's on today's slate = the clubs
  // with an off day, favorite (or its affiliate, on a MiLB level — see
  // sortGames below) first then alphabetical. Works at every level: MLB's
  // fixed 30, or a MiLB league's own current roster. When NONE of a level's
  // clubs are playing this comes back as the WHOLE league — an empty break
  // day, or (MLB only) All-Star Game day (whose lone "AL @ NL All-Stars" row
  // carries squad ids no club owns). That all-league case is kept ON PURPOSE:
  // the break has no club games, so the full grid gives the slate something
  // to browse instead of a bare "No games scheduled."
  const offDayTeams = useMemo(() => {
    const all = levelTeams.data ?? []
    if (!all.length) return []
    const playing = new Set(sorted.flatMap((g) => [g.away.id, g.home.id]))
    return all
      .filter((t) => !playing.has(t.id))
      .sort((a, b) => {
        const pa = isPinnedTeam(a.id, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
        const pb = isPinnedTeam(b.id, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
        if (pa !== pb) return pa - pb
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
  }, [levelTeams.data, sorted, favoriteTeamId, favoriteAffiliateIds])

  // All-Star break detection — only worth a fetch once the MLB slate has
  // already come back empty (every other day, this never fires). Turns a
  // bare "No games scheduled." into the Derby hand-off card on Derby night,
  // or a plain break notice on the rest of the gameless week.
  // The break window is a date range, not an MLB-only concept — every level
  // goes dark the same week — so the lookup is gated on ANY level's slate
  // coming back empty, not just MLB's.
  const isEmptyDay = !loading && !error && sorted.length === 0
  const allStarInfo = useAsync(
    () => (isEmptyDay ? fetchAllStarInfo(season) : Promise.resolve(null)),
    [isEmptyDay, season],
  )
  const breakWindow = useMemo(
    () => allStarBreakWindow(allStarInfo.data, dateStr),
    [allStarInfo.data, dateStr],
  )
  // The Derby itself is an MLB-only event (DerbyCard below) — a MiLB slate on
  // that same date still gets the plain All-Star Break banner, not the card.
  const isDerbyDay = sportId === SPORT_IDS.MLB && Boolean(breakWindow?.isDerbyDay)
  const isBreakWindow = Boolean(breakWindow) && !isDerbyDay
  const allStarPending = isEmptyDay && allStarInfo.loading

  // The banner's date always comes from an actual forward schedule scan
  // (fetchNextGameDate), never straight from statsapi's firstDate2ndHalf —
  // verified live that field can be well past the real next game (e.g. it
  // says the 19th when a single game already lands the 16th and the full
  // slate is back the 17th), so it only bounds the break WINDOW here, never
  // supplies the date text. Same lookup covers the generic "Off Day" case
  // (a level's own single day off, e.g. a MiLB Monday) outside any break.
  const needsResumeLookup = isEmptyDay && !isDerbyDay && !allStarPending
  const resumeLookup = useAsync(
    () => (needsResumeLookup ? fetchNextGameDate(sportId, dateStr) : Promise.resolve(null)),
    [needsResumeLookup, sportId, dateStr],
  )
  const resumeLookupPending = needsResumeLookup && resumeLookup.loading
  const resumeDate = resumeLookup.data
  const showBreakBanner = isBreakWindow && !!resumeDate
  const showOffDayBanner = needsResumeLookup && !isBreakWindow && !!resumeDate

  // A day you've paged BACK to (any date before today) gets the past-day
  // treatment: each Final game's card flips over to a result summary, and the Day Recap panel
  // (Top Performers + Day Highlights) replaces the plain Top Performers box.
  // Today gets the SAME treatment once every one of its games has
  // gone Final — at that point there's no more live refreshing to do, so it's
  // effectively already a "day you're looking back on". Before that (any game
  // still in Preview/Live), today keeps the ordinary live-refresh slate.
  // A postponed game reports abstractGameState 'Final' (coded 'D') but has no
  // result to reveal, so it's excluded from the flip-card set, the day recap,
  // AND the "every game Final" check below — a day with only a postponed game
  // never flips to the past-day treatment, since there's nothing to reveal.
  // A postponed game also reports abstractGameState 'Final' (see above), so
  // this alone means "nothing on today's slate is still Preview/Live" —
  // exactly the "day is done" signal, without separately excluding
  // postponed games (a slate that's 4 Finals + 1 postponement still counts).
  const todayAllFinal =
    isToday && sorted.length > 0 && sorted.every((g) => g.abstractState === 'Final')
  const showPastDayTreatment = dateStr < todayStr || todayAllFinal
  const finals = useMemo(
    () =>
      showPastDayTreatment
        ? sorted.filter(
            (g) => g.abstractState === 'Final' && !selectGameStatus(g).isPostponed,
          )
        : [],
    [sorted, showPastDayTreatment],
  )
  const [revealedAll, setRevealedAll] = useState(false)
  // Reset computed during render (not in an effect) on a day/level change —
  // see Headshot.jsx for the same pattern. Shares `dayKey` with the filter
  // reset below since both key off the same (dateStr, sportId) change.
  const dayKey = `${dateStr}|${sportId}`
  const [prevDayKeyForReveal, setPrevDayKeyForReveal] = useState(dayKey)
  if (dayKey !== prevDayKeyForReveal) {
    setPrevDayKeyForReveal(dayKey)
    setRevealedAll(false)
  }
  // Spoilers-off counts as "reveal all" for this day's flip cards too: the user
  // has consented to every score on this date (ADR-0026), so the amber banner
  // must never sit over a still-sealed slate once the day has gone all-final —
  // and a day locked in from an earlier consent shouldn't ask for the tap again
  // either. A day never consented to keeps its own tap-to-reveal-all. Turning the
  // pass off the same day collapses this straight back to `revealedAll`.
  const slateRevealAll = revealedAll || scoresUnlocked

  // A paged-back day whose every Final has been revealed has nothing left in
  // the chip cluster beside the date stepper (Live Scores is today-only, and
  // Reveal All has been used up), so the stepper takes that freed room and
  // steps up a size — see .datenav--lg. Deliberately not today: today keeps a
  // chip in that row either way (Live Scores, or its own Reveal All once every
  // game has gone Final), so there's no room to give. `finals.length > 0`
  // keeps a day with nothing to reveal — a future date, an off day, a slate of
  // nothing but postponements — from growing on a vacuously-true condition.
  const dayFullyRevealed = !isToday && finals.length > 0 && slateRevealAll

  // The floating bottom "Reveal all results" bar (RevealAllBar, mobile-only —
  // see its own comment below) would otherwise sit on screen at the same time
  // as the header's inline .daystate__chip--reveal, right below the date
  // stepper — redundant when both are already in view. Same
  // IntersectionObserver-on-a-ref pattern as InningViewer's scorebug dock
  // (`pastLine`/`.gamehud-dock--show`): the floating bar stays hidden while
  // the header chip is visible, and only appears once scrolling has carried
  // that chip out of view.
  const revealChipRef = useRef(null)
  const [revealChipOutOfView, setRevealChipOutOfView] = useState(false)
  // The chip itself only exists once the async schedule fetch resolves with
  // at least one Final game (see the render condition below), so the observer
  // can't just attach once on mount — it has to re-attach whenever the chip's
  // presence flips, or a chip that mounts after this effect's first (and
  // only, with `[]` deps) run would never get observed.
  const showRevealChip = finals.length > 0 && !slateRevealAll
  useEffect(() => {
    const el = revealChipRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const obs = new IntersectionObserver(([entry]) => setRevealChipOutOfView(!entry.isIntersecting), {
      threshold: 0,
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [showRevealChip])

  // Same trick again, this time to drop a shadow under the sticky desktop
  // topbar (.topbar--slate in 25-wide-layout.css) once a card is actually
  // scrolling underneath it — a permanent shadow would look like a fixed
  // banner even at the very top of a fresh page. `topbarSentinel` is its own
  // 1px `position: sticky; top: 0` element placed just above the real
  // header (see the JSX below); a sticky element's intersectionRatio drops
  // below 1 the instant it starts sticking, which happens at the same
  // scroll position the real header does — no header-height math needed.
  const topbarSentinelRef = useRef(null)
  const [topbarStuck, setTopbarStuck] = useState(false)
  useEffect(() => {
    const el = topbarSentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return undefined
    const obs = new IntersectionObserver(([entry]) => setTopbarStuck(entry.intersectionRatio < 1), {
      threshold: [1],
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Per-game pill classification (Game of the Night / Dominant Performance /
  // Blowout / Close Game / Extra Innings) for every card in `finals` — see
  // GameResultFace.jsx's ResultPills. Empty until revealedAll flips true.
  const cardMetaByGamePk = useDayCardMeta(finals, dateStr, slateRevealAll)
  // This day's condensed-game posters, one 8 KB static file for the whole
  // slate (see fetchDayVideos — the live alternative is 430 KB PER GAME). Same
  // reveal gate as the card meta above, though for presentation rather than
  // spoiler safety: the file carries no score, but nothing about a result card
  // should be fetched before the day is revealed. A day the nightly job hasn't
  // covered yet — today's, above all — simply resolves to no entries, and each
  // card falls back to fetching its own on tap (WatchCondensedButton).
  const dayVideos = useAsync(
    () => (slateRevealAll ? fetchDayVideos(apiDateToUrl(dateStr)) : Promise.resolve({ games: {} })),
    [slateRevealAll, dateStr],
  )

  // The slate's actual render order, in four tiers: the favorite team's own
  // game, then the games already underway (reorderLiveGames), then the
  // national-broadcast games among those that haven't started
  // (reorderNationalBroadcasts), then the rest — each tier internally still in
  // `sorted`'s soonest → latest order, and the Finals still last. A game in
  // progress outranks a national game that hasn't thrown a pitch, which is why
  // the live pass runs FIRST and the national pass is confined to what's left.
  // The crowned "Game of the Night" is then promoted to the front slot (see
  // reorderGameOfTheNight) — a no-op until cardMetaByGamePk is populated, so
  // this can't leak which game is crowned ahead of the reveal-all gate above.
  const gamesForDisplay = useMemo(() => {
    const pinned = (g) => isPinned(g, favoriteTeamId, favoriteAffiliateIds)
    const liveFirst = reorderLiveGames(sorted, pinned)
    const nationallyOrdered = reorderNationalBroadcasts(liveFirst, nationalBroadcasts.data, pinned)
    return reorderGameOfTheNight(nationallyOrdered, cardMetaByGamePk, pinned)
  }, [sorted, nationalBroadcasts.data, cardMetaByGamePk, favoriteTeamId, favoriteAffiliateIds])

  // The filter bar's own selection — which category chip(s) (see FILTER_CHIPS
  // above) the user has toggled on. Reset on a new day/level, same as
  // revealedAll above, so a stale filter never silently hides next slate's
  // cards.
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [prevDayKeyForFilters, setPrevDayKeyForFilters] = useState(dayKey)
  if (dayKey !== prevDayKeyForFilters) {
    setPrevDayKeyForFilters(dayKey)
    setActiveFilters(new Set())
  }
  const toggleFilter = (key) =>
    setActiveFilters((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  // Only offer a chip for a category that actually occurs somewhere in
  // today's finals — an empty chip would just be a dead button. Empty until
  // cardMetaByGamePk is populated, same reveal-all gate as everything else
  // classification-derived on this page.
  const availableFilters = useMemo(() => {
    const present = new Set()
    for (const meta of cardMetaByGamePk.values()) {
      if (meta.isGameOfTheNight) present.add('crown')
      if (meta.scenario) present.add(meta.scenario)
    }
    return FILTER_CHIPS.filter((c) => present.has(c.key))
  }, [cardMetaByGamePk])
  // With no filter selected, every card shows (gamesForDisplay unchanged). A
  // selection shows the UNION of matching games — multi-select is "any of
  // these", not "all of these" — and everything else drops out, so the
  // selected categories are literally all that's left on screen.
  const visibleGames = useMemo(() => {
    if (activeFilters.size === 0) return gamesForDisplay
    return gamesForDisplay.filter((g) => {
      const meta = cardMetaByGamePk.get(g.gamePk)
      if (!meta) return false
      return (
        (activeFilters.has('crown') && meta.isGameOfTheNight) ||
        (meta.scenario && activeFilters.has(meta.scenario))
      )
    })
  }, [gamesForDisplay, activeFilters, cardMetaByGamePk])

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
    <div className="screen screen--slate">
      {/* Title + level toggle + search share one row: the Tally wordmark taps
          home (a full reload — see lib/home.js) on the left, the condensed
          MLB/AAA/… buttons and the search trigger ride together to its
          right (grouped so `justify-content: space-between` splits only
          title vs. that cluster, not each button individually). A direct
          child of .screen (not .slatehead below) so a sticky containing
          block spans the whole scrollable page on desktop/iPad — nested one
          level deeper, position: sticky could only hold it in view for the
          height of its own short parent (see .topbar--slate's desktop rule
          in index.css). */}
      <div ref={topbarSentinelRef} className="topbar__stickysentinel" aria-hidden="true" />
      <header className={`topbar topbar--slate${topbarStuck ? ' topbar--stuck' : ''}`}>
        <button
          type="button"
          className="topbar__title topbar__home"
          onClick={goHome}
          aria-label="Reload games"
        >
          <TallyLockup height={20} />
        </button>
        <div className="topbar__slateactions">
          <LevelNav sportId={sportId} onChange={pickLevel} />
          {/* The icon buttons live in one nowrap sub-group so that when the
              row runs out of width they drop below the level pills together —
              as bare siblings flex-wrap moved them one at a time, orphaning
              whichever single button no longer fit onto its own row. */}
          <div className="topbar__iconcluster">
            <SiteSearchButton className="topbar__search" />
            <LogbookButton className="topbar__search" />
            <SiteMenuButton className="topbar__search" />
            {AccountButton && (
              <Suspense fallback={null}>
                <AccountButton />
              </Suspense>
            )}
          </div>
        </div>
      </header>

      {/* This level's whole club set, in the same finger-scrollable logo strip
          League Leaders uses to highlight a team (TeamFilterStrip) — minus
          the pinned "MLB" reset button (showMlbPin=false), since there's no
          "every team" state to return to here. Tapping a logo jumps straight
          to that club's team page rather than picking a highlight, so
          selectedTeamId is always null (nothing is ever "active") and
          teamfilterstrip--nav keeps every logo full-color instead of
          dimming everything the strip's filter callers grayscale until
          picked (see index.css). Sourced from levelTeams (fetchTeams(sportId)
          above), so it re-lists automatically on every level switch.
          showArrows gives non-touch users a click target to scrub through the
          strip; centerTeamId lands on the favorite team on arrival (only
          meaningful when it's actually in this level's club set — an MLB
          favorite scrolled to a minor-league level's strip just no-ops). */}
      {levelTeams.data?.length > 0 && (
        <TeamFilterStrip
          teams={levelTeams.data}
          selectedTeamId={null}
          onSelect={(id) => navigate(teamPath(id))}
          showMlbPin={false}
          showArrows
          centerTeamId={favoriteTeamId}
          ariaLabel={`Browse ${LEVELS.find((l) => l.sportId === sportId)?.label ?? ''} teams`}
          className="teamfilterstrip--nav"
        />
      )}

      {/* The date stepper's own solid banner, divided from the game cards by
          a bottom rule — deliberately NOT sticky (see the comment on
          .slatehead in index.css), so it scrolls away under the pinned
          topbar above rather than nagging "you're on {date}" forever. */}
      <div className="slatehead">
        <div
          className={`datenav datenav--row${dayFullyRevealed ? ' datenav--lg' : ''}`}
        >
          <button onClick={() => pageDay(-1)} aria-label="Previous day">
            ‹
          </button>
          <span className="datenav__label">
            {humanDate(dateStr)}
            {/* One tap back to today once you've paged away — no arrow-mashing
                home from a date you browsed to. */}
            {!isToday && (
              <button
                type="button"
                className="datenav__today"
                onClick={() => goToDate(todayStr)}
              >
                Today
              </button>
            )}
          </span>
          <button onClick={() => pageDay(1)} aria-label="Next day">
            ›
          </button>
        </div>

        {/* Day-state chip row: whichever of {Live Scores, Reveal All} applies
            to this date rides beside the date stepper instead of stacking
            below it. Not mutually exclusive — today, once every game on it
            has gone Final (see showPastDayTreatment), BOTH can apply at once
            (the pass is still off and the day hasn't been reveal-alled), so
            this holds up to two chips rather than assuming only one. */}
        {((isToday && !todayAllFinal) || (finals.length > 0 && !slateRevealAll)) && (
          <div className="daystate">
            {/* Live-scores day pass — today's slate only. The reset time is no
                longer spelled out visually (it's implied: the pass always
                clears at 8am), but stays in the accessible name for screen
                reader users. Tapping again while on turns it off — the chip
                is its own off-switch, no separate banner needed. */}
            {isToday && !todayAllFinal && (
              <button
                type="button"
                role="switch"
                data-testid="scores-unlock-switch"
                aria-checked={passActive}
                aria-label={
                  passActive
                    ? `Live scores — on, resets ${resetLabel}`
                    : 'Live scores — off'
                }
                className={`daystate__chip daystate__chip--live${passActive ? ' daystate__chip--live-on' : ''}`}
                onClick={() => {
                  if (passActive) {
                    disableUnlock()
                    // The note says "Live scores stays on this device". Once
                    // the pass is off there is no "live scores" to say it
                    // about, and leaving it up asserted a scope for a setting
                    // that no longer applied. Clearing it here is NOT the
                    // one-shot dismissal — that is the ✕, and only the ✕
                    // writes bbsbh:prompts.
                    setJustEnabledPass(false)
                  } else {
                    setAskUnlock(true)
                  }
                }}
              >
                <span className="daystate__dot" aria-hidden="true" />
                {copy('scoresUnlocked.toggleLabel')}
              </button>
            )}
            {finals.length > 0 && !slateRevealAll && (
              <button
                ref={revealChipRef}
                type="button"
                className="btn btn--reveal daystate__chip--reveal"
                onClick={() => setRevealedAll(true)}
              >
                <span className="btn__ball" aria-hidden="true">
                  ⚾️
                </span>{' '}
                Reveal all results
              </button>
            )}
          </div>
        )}

        {/* The scores-unlocked-local prompt: fires only right after THIS tap
            enables the pass (see the ConsentModal onConfirm below), never on
            a reload where the pass happens to still be active — and only
            where an account exists to be confused about (isClerkEnabled). */}
        {isClerkEnabled && justEnabledPass && !passScopeNoteDismissed && (
          <p className="daystate__scopenote caps-exempt">
            Live scores stays on this device — it won&rsquo;t turn on for your
            other signed-in devices.
            <button
              type="button"
              className="daystate__scopenotedismiss"
              onClick={() => {
                dismissPassScopeNote()
                setJustEnabledPass(false)
              }}
              aria-label="Dismiss this note"
            >
              ✕
            </button>
          </p>
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
          allStarInfo.loading || breakWindow || resumeLookupPending || showOffDayBanner
            ? null
            : 'No games scheduled.'
        }
      />

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

      {finals.length > 0 && !slateRevealAll && revealChipOutOfView && (
        <RevealAllBar onReveal={() => setRevealedAll(true)} />
      )}

      {availableFilters.length > 0 && (
        <ResultFilterBar
          chips={availableFilters}
          active={activeFilters}
          onToggle={toggleFilter}
          shown={visibleGames.length}
          total={gamesForDisplay.length}
        />
      )}

      {/* role="region" (not a bare div) so the aria-label is actually
          honored and ResultFilterBar's aria-controls has a real target —
          an aria-label on a role-less generic element is discarded. */}
      <div className="slate-main" id="slate-games" role="region" aria-label="Games">
        <ul className="gamelist">
          {sorted.length === 0 && isDerbyDay && (
            <li>
              <DerbyCard />
            </li>
          )}
          {visibleGames.map((g, idx) => {
            const pinnedTeamId = isPinned(g, favoriteTeamId, favoriteAffiliateIds)
              ? favoriteTeamId
              : null
            const pCount = (prospectCounts[g.away.id] ?? 0) + (prospectCounts[g.home.id] ?? 0)
            // The first cards' marks are the slate's largest above-the-fold
            // images — its LCP candidate — so they skip TeamLogo's default
            // lazy loading (which would defer exactly the images the first
            // paint is waiting on). Two cards ≈ one phone viewport.
            const eager = idx < 2
            const isPastFinal =
              showPastDayTreatment &&
              g.abstractState === 'Final' &&
              !selectGameStatus(g).isPostponed
            return (
              <li key={`${g.sportId}-${g.gamePk}`}>
                {isPastFinal ? (
                  <PastGameFlipCard
                    game={g}
                    dateStr={dateStr}
                    revealed={slateRevealAll}
                    pinnedTeamId={pinnedTeamId}
                    prospectCount={pCount}
                    cardMeta={cardMetaByGamePk.get(g.gamePk) ?? null}
                    video={dayVideos.data?.games?.[g.gamePk] ?? null}
                    liveJerseys={liveJerseys.data}
                    national={nationalBroadcasts.data?.[g.gamePk]}
                    eager={eager}
                    onSelect={() => onPick(g, dateStr)}
                    onBoxScore={() => onPick(g, dateStr, 'boxscore')}
                  />
                ) : (
                  <GameCard
                    game={g}
                    pinnedTeamId={pinnedTeamId}
                    prospectCount={pCount}
                    liveLine={liveLineFor(g)}
                    liveJerseys={liveJerseys.data}
                    national={nationalBroadcasts.data?.[g.gamePk]}
                    eager={eager}
                    onSelect={() => onPick(g, dateStr)}
                    onBoxScore={null}
                  />
                )}
              </li>
            )
          })}
        </ul>

        {/* Any idle club — including the whole-league case on an All-Star
            break or (MLB) All-Star Game day, where there are no club games
            and the full grid is the point (something to browse). */}
        {offDayTeams.length > 0 && (
          <OffDaySection
            teams={offDayTeams}
            favoriteTeamId={favoriteTeamId}
            favoriteAffiliateIds={favoriteAffiliateIds}
          />
        )}
      </div>

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

      {askUnlock && (
        <ConsentModal
          group="scoresUnlocked"
          time={formatResetTime(nextResetAt())}
          onConfirm={() => {
            enableUnlock()
            if (isClerkEnabled) setJustEnabledPass(true)
            trackToggleConsent({
              toggle: TOGGLES.SCORES_UNLOCKED,
              action: ACTIONS.CONFIRM,
              surface: SURFACES.SLATE,
            })
            setAskUnlock(false)
          }}
          onDismiss={() => {
            trackToggleConsent({
              toggle: TOGGLES.SCORES_UNLOCKED,
              action: ACTIONS.DISMISS,
              surface: SURFACES.SLATE,
            })
            setAskUnlock(false)
          }}
        />
      )}
    </div>
  )
}

// The mobile-only fixed bottom bar duplicate of the header's "Reveal all
// results" chip (see .daystate in the slatehead render above) — the same
// floating-bar convention InningViewer uses for "Reveal {half}"
// (.pagenav/.btn--reveal), so the action stays in thumb reach on a long
// single-column list. Only rendered once the header chip has scrolled out of
// view (`revealChipOutOfView`) — while it's still on screen near the top,
// showing this floating duplicate too would just be the same button twice.
// Desktop has no floating duplicate: the header chip is already inline and
// reachable there, same split as .pagenav--boxscore's
// Refresh control. One tap flips every Final game's card, which also
// triggers useDayCardMeta's batched classification pass — there's no
// per-card unlock.
function RevealAllBar({ onReveal }) {
  return (
    <div className="pagenav pagenav--revealall">
      <button type="button" className="btn btn--reveal" onClick={onReveal}>
        <span className="btn__ball" aria-hidden="true">⚾️</span> Reveal all results
      </button>
    </div>
  )
}

// The revealed day's category filter — one chip per "storyline" (see
// FILTER_CHIPS in lib/resultCards.js) that actually occurs somewhere on
// today's slate. Toggling a chip filters the grid below to the UNION of every
// selected category (multi-select is "any of these") and lifts the matching
// games to the only ones left on screen; toggling every chip back off shows
// the whole slate again. Only ever rendered once `availableFilters` is
// non-empty — itself gated on cardMetaByGamePk, so this can't appear (or leak
// which categories exist) before the slate's reveal-all.
//
// `aria-controls` names the grid the chips actually govern (#slate-games,
// role="region" on .slate-main), and the count line is a live region: a chip
// silently deleting most of the slate is exactly the change a screen reader
// user would otherwise never hear.
function ResultFilterBar({ chips, active, onToggle, shown, total }) {
  return (
    <div className="slate-filterbar">
      <div className="slate-filterbar__chips" role="group" aria-label="Filter by result" aria-controls="slate-games">
        {chips.map((c) => {
          const isActive = active.has(c.key)
          return (
            <button
              key={c.key}
              type="button"
              className={`slate-filterbar__chip ${isActive ? 'slate-filterbar__chip--active' : ''}`}
              style={{ '--chip-accent': c.accent, '--chip-text': c.text }}
              aria-pressed={isActive}
              onClick={() => onToggle(c.key)}
            >
              {c.label}
            </button>
          )
        })}
      </div>
      <p className="slate-filterbar__count" role="status">
        {active.size > 0 ? `Showing ${shown} of ${total} games` : ''}
      </p>
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
