import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useNav } from '../lib/nav.js'
import { slatePath } from '../lib/route.js'
import { fetchSchedule, fetchAllStarInfo, fetchNextGameDate, fetchTeams } from '../api/schedule.js'
import { fetchRosterIdsForTeams, fetchAffiliates } from '../api/team.js'
import { fetchTopProspects, countProspectsByTeam } from '../api/prospects.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { useGameScoreVisible } from '../hooks/useGameScoreVisible.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { SPORT_IDS, LEVELS } from '../lib/teams.js'
import { selectGameStatus } from '../api/select.js'
import { fetchGameScores, gameScoreFor } from '../api/gameScore.js'
import { GameCard } from '../components/GameCard.jsx'
import { DerbyCard } from '../components/DerbyCard.jsx'
import { PastGameFlipCard } from '../components/PastGameFlipCard.jsx'
import { LevelNav } from '../components/LevelNav.jsx'
import { TallyLockup } from '../components/TallyBrand.jsx'
import { SiteSearchButton } from '../components/SiteSearch.jsx'
import { SiteMenuButton } from '../components/SiteMenu.jsx'
import { goHome } from '../lib/home.js'
import { isClerkEnabled } from '../lib/clerkConfig.js'
import { SiteFooter } from '../components/SiteFooter.jsx'
import { FavoriteTeamModal } from '../components/FavoriteTeamModal.jsx'
import { TopPerformersBox } from '../components/TopPerformersBox.jsx'
import { OffDaySection } from '../components/OffDaySection.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { useDayCardMeta } from '../hooks/useDayCardMeta.js'
import { FILTER_CHIPS, reorderGameOfTheNight } from '../lib/resultCards.js'

// Same lazy pattern as SiteHeader.jsx: AccountButton (and ContinueScoring's
// use of Clerk hooks) imports @clerk/clerk-react at its top, so neither is
// ever fetched — let alone rendered — on a deploy without Clerk configured.
const AccountButton = isClerkEnabled
  ? lazy(() => import('../components/AccountButton.jsx').then((m) => ({ default: m.AccountButton })))
  : null
const ContinueScoring = isClerkEnabled
  ? lazy(() => import('../components/ContinueScoring.jsx').then((m) => ({ default: m.ContinueScoring })))
  : null

// The chosen level survives leaving the slate (someone scoring an A+ affiliate
// all season shouldn't reset to MLB every time they come back). The date
// deliberately does NOT persist anywhere — it lives in the URL ('/{MMDDYYYY}',
// bare '/' = today), so a paged-to day is shareable and "today" is always the
// right place a fresh visit starts.
const LEVEL_KEY = 'bbsbh:level'
function readLevel() {
  try {
    const n = Number(window.localStorage.getItem(LEVEL_KEY))
    return LEVELS.some((l) => l.sportId === n) ? n : SPORT_IDS.MLB
  } catch {
    return SPORT_IDS.MLB
  }
}

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
  const [sportId, setSportId] = useState(readLevel)
  const { favoriteTeamId, isFirstVisit, setFavoriteTeam } = useFavoriteTeam()
  const { gameScoreVisible, setGameScoreVisible } = useGameScoreVisible()
  const [showWelcome, setShowWelcome] = useState(isFirstVisit && !welcomeSuppressed())
  const pickLevel = (id) => {
    setSportId(id)
    try {
      window.localStorage.setItem(LEVEL_KEY, String(id))
    } catch {
      // Private mode — level just won't stick between visits.
    }
  }

  // The displayed date comes from the URL (see App.jsx): bare '/' means today.
  // Paging navigates to the neighboring day's URL rather than bumping local
  // state, so every browsed-to day is a shareable address and the browser's
  // own Back/Forward retrace the days visited. Comparisons below lean on
  // YYYY-MM-DD ordering lexically — no offset math needed.
  const todayStr = toApiDate(new Date())
  const dateStr = date ?? todayStr
  const isToday = dateStr === todayStr
  const goToDate = (apiDate) =>
    navigate(apiDate === todayStr ? '/' : slatePath(apiDate))
  const pageDay = (n) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    goToDate(toApiDate(addDays(new Date(y, m - 1, d), n)))
  }

  const slate = useAsync(() => fetchSchedule(dateStr, sportId), [dateStr, sportId])
  const { loading, error, data } = slate

  // Game Score badges — only fetched at all when the preference is on (see
  // useGameScoreVisible), same-origin static file, degrades to {} on failure.
  const gameScores = useAsync(
    () => (gameScoreVisible ? fetchGameScores() : Promise.resolve({})),
    [gameScoreVisible],
  )
  const scoreFor = (gamePk) =>
    gameScoreVisible ? gameScoreFor(gameScores.data, gamePk) : null

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

  // Games with a Top Performers box to reveal — any that have started, on
  // today or a past date. A future date, or today before first pitch, has
  // nothing yet, so the box doesn't render at all (see below).
  const eligibleGames = useMemo(
    () => sorted.filter((g) => g.abstractState !== 'Preview'),
    [sorted],
  )

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
  useEffect(() => setRevealedAll(false), [dateStr, sportId])
  // Per-game pill classification (Game of the Night / Dominant Performance /
  // Blowout / Close Game / Extra Innings) for every card in `finals` — see
  // GameResultFace.jsx's ResultPills. Empty until revealedAll flips true.
  const cardMetaByGamePk = useDayCardMeta(finals, dateStr, revealedAll)

  // The slate's actual render order: `sorted` (soonest → latest, favorite
  // pinned first) with the crowned "Game of the Night" game promoted to the
  // front — behind the favorite team's own game when there is one on the
  // slate, otherwise outright first (see reorderGameOfTheNight). A no-op
  // until cardMetaByGamePk is populated, so this can't leak which game is
  // crowned ahead of the reveal-all gate above.
  const gamesForDisplay = useMemo(
    () =>
      reorderGameOfTheNight(sorted, cardMetaByGamePk, (g) =>
        isPinned(g, favoriteTeamId, favoriteAffiliateIds),
      ),
    [sorted, cardMetaByGamePk, favoriteTeamId, favoriteAffiliateIds],
  )

  // The filter bar's own selection — which category chip(s) (see FILTER_CHIPS
  // above) the user has toggled on. Reset on a new day/level, same as
  // revealedAll above, so a stale filter never silently hides next slate's
  // cards.
  const [activeFilters, setActiveFilters] = useState(new Set())
  useEffect(() => setActiveFilters(new Set()), [dateStr, sportId])
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

  // Whether the live Top Performers box has anything to show — mutually
  // exclusive with a past day's finals (finals.length > 0): a day either
  // hasn't gone final yet (this) or already has (that), never both.
  const showTopPerformers =
    finals.length === 0 && dateStr <= todayStr && eligibleGames.length > 0

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
      {/* One solid, sticky banner for all the slate controls (title, level tabs,
          date). Pinned together on an opaque backdrop so the cards scroll
          cleanly underneath instead of bleeding through a see-through header. */}
      <div className="slatehead">
        {/* Title + level toggle + search share one row: the Tally wordmark taps
            home (a full reload — see lib/home.js) on the left, the condensed
            MLB/AAA/… buttons and the search trigger ride together to its
            right (grouped so `justify-content: space-between` splits only
            title vs. that cluster, not each button individually). */}
        <header className="topbar topbar--slate">
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
              <SiteMenuButton className="topbar__search" />
              {AccountButton && (
                <Suspense fallback={null}>
                  <AccountButton />
                </Suspense>
              )}
            </div>
          </div>
        </header>

        <div className="datenav datenav--row">
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
      </div>

      {/* Signed-in only, and only when the cloud scorebook has entries —
          renders null otherwise, so the slate is untouched for everyone
          else. See ContinueScoring.jsx. */}
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

      {finals.length > 0 && !revealedAll && (
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

      <div className={showTopPerformers ? 'slate-body' : undefined}>
        {/* The live day's sealed Top Performers box — full width above the game
            grid (.slate-body stacks it first at every width; see index.css).
            Renders BEFORE .slate-main so plain block flow already puts it on
            top. A past day's finals get no digest box above them — each
            game's own pills (GameResultFace.jsx) carry that now. */}
        {showTopPerformers && (
          <TopPerformersBox
            dateStr={dateStr}
            sportId={sportId}
            games={eligibleGames}
            prospectsData={prospects.data}
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
            {visibleGames.map((g) => {
              const pinnedTeamId = isPinned(g, favoriteTeamId, favoriteAffiliateIds)
                ? favoriteTeamId
                : null
              const pCount = (prospectCounts[g.away.id] ?? 0) + (prospectCounts[g.home.id] ?? 0)
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
                      revealed={revealedAll}
                      pinnedTeamId={pinnedTeamId}
                      prospectCount={pCount}
                      gameScore={scoreFor(g.gamePk)}
                      cardMeta={cardMetaByGamePk.get(g.gamePk) ?? null}
                      onSelect={() => onPick(g, dateStr)}
                      onBoxScore={() => onPick(g, dateStr, 'boxscore')}
                    />
                  ) : (
                    <GameCard
                      game={g}
                      pinnedTeamId={pinnedTeamId}
                      prospectCount={pCount}
                      gameScore={scoreFor(g.gamePk)}
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
      </div>

      <SiteFooter
        onShowLogos={onShowLogos}
        favoriteTeamId={favoriteTeamId}
        onSetFavoriteTeam={setFavoriteTeam}
        gameScoreVisible={gameScoreVisible}
        onSetGameScoreVisible={setGameScoreVisible}
      />

      {showWelcome && (
        <FavoriteTeamModal
          intro
          favoriteTeamId={favoriteTeamId}
          onSave={setFavoriteTeam}
          onClose={() => setShowWelcome(false)}
          gameScoreVisible={gameScoreVisible}
          onSetGameScoreVisible={setGameScoreVisible}
        />
      )}
    </div>
  )
}

// The single "reveal all results" control for a past day's flip cards — a top
// button (wide layout) plus a mobile-only fixed bottom bar duplicate, the same
// floating-bar convention InningViewer uses for "Reveal {half}"
// (.pagenav/.btn--reveal). One tap flips every Final game's card, which also
// triggers useDayCardMeta's batched classification pass — there's no
// per-card unlock.
function RevealAllBar({ onReveal }) {
  return (
    <>
      <button type="button" className="btn btn--reveal revealall__top" onClick={onReveal}>
        <span className="btn__ball" aria-hidden="true">⚾️</span> Reveal all results
      </button>
      <div className="pagenav pagenav--revealall">
        <button type="button" className="btn btn--reveal" onClick={onReveal}>
          <span className="btn__ball" aria-hidden="true">⚾️</span> Reveal all results
        </button>
      </div>
    </>
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
