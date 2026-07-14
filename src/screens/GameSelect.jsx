import { useEffect, useMemo, useState } from 'react'
import { fetchSchedule, fetchAllStarInfo } from '../api/schedule.js'
import { fetchScheduleUniforms } from '../api/uniforms.js'
import { fetchRosterIdsForTeams, fetchAffiliates } from '../api/team.js'
import { fetchTopProspects, countProspectsByTeam } from '../api/prospects.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { useFavoriteTeam } from '../hooks/useFavoriteTeam.js'
import { useGameScoreVisible } from '../hooks/useGameScoreVisible.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { SPORT_IDS, LEVELS, ALL_MLB_TEAM_IDS, teamFullName } from '../lib/teams.js'
import { selectGameStatus } from '../api/select.js'
import { fetchGameScores, gameScoreFor } from '../api/gameScore.js'
import { GameCard } from '../components/GameCard.jsx'
import { DerbyCard } from '../components/DerbyCard.jsx'
import { PastGameFlipCard } from '../components/PastGameFlipCard.jsx'
import { LevelNav } from '../components/LevelNav.jsx'
import { ScorebookMark } from '../components/ScorebookMark.jsx'
import { SiteSearchButton } from '../components/SiteSearch.jsx'
import { SiteMenuButton } from '../components/SiteMenu.jsx'
import { goHome } from '../lib/home.js'
import { SiteFooter } from '../components/SiteFooter.jsx'
import { FavoriteTeamModal } from '../components/FavoriteTeamModal.jsx'
import { TopPerformersBox } from '../components/TopPerformersBox.jsx'
import { PastDayRecapBox } from '../components/PastDayRecapBox.jsx'
import { OffDaySection } from '../components/OffDaySection.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'

// The chosen level survives leaving the slate (someone scoring an A+ affiliate
// all season shouldn't reset to MLB every time they come back). The date
// offset deliberately does NOT persist — "today" is the right place to start.
const LEVEL_KEY = 'bbsbh:level'
function readLevel() {
  try {
    const n = Number(window.localStorage.getItem(LEVEL_KEY))
    return LEVELS.some((l) => l.sportId === n) ? n : SPORT_IDS.MLB
  } catch {
    return SPORT_IDS.MLB
  }
}

// Screen 1: pick a game. A single level's slate for the chosen date, sorted
// soonest → latest (the favorite team pinned to the top), with a LIVE pill on
// any game in progress. Level is toggled with the thin buttons up top; no
// more search box.
export function GameSelect({ onPick, onShowLogos }) {
  useDocumentTitle(null)
  const [offset, setOffset] = useState(0) // days from today
  const [sportId, setSportId] = useState(readLevel)
  const { favoriteTeamId, isFirstVisit, setFavoriteTeam } = useFavoriteTeam()
  const { gameScoreVisible, setGameScoreVisible } = useGameScoreVisible()
  const [showWelcome, setShowWelcome] = useState(isFirstVisit)
  const pickLevel = (id) => {
    setSportId(id)
    try {
      window.localStorage.setItem(LEVEL_KEY, String(id))
    } catch {
      // Private mode — level just won't stick between visits.
    }
  }

  const dateStr = useMemo(
    () => toApiDate(addDays(new Date(), offset)),
    [offset],
  )

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

  // The 30-team MLB league minus whoever's on today's slate = the clubs with an
  // off day, favorite first then alphabetical. MLB only (the name/enumeration
  // helpers are MLB-only, and off-days are a clean concept for a fixed league).
  // When NONE of the 30 clubs are playing this comes back as all 30 — an empty
  // break day, or All-Star Game day (whose lone "AL @ NL All-Stars" row carries
  // squad ids that aren't any of the 30). That all-30 case is kept ON PURPOSE:
  // the break has no club games, so the full grid gives the slate something to
  // browse instead of a bare "No games scheduled."
  const offDayTeamIds = useMemo(() => {
    if (sportId !== SPORT_IDS.MLB) return []
    const playing = new Set(sorted.flatMap((g) => [g.away.id, g.home.id]))
    return ALL_MLB_TEAM_IDS.filter((id) => !playing.has(id)).sort((a, b) => {
      if (a === favoriteTeamId) return -1
      if (b === favoriteTeamId) return 1
      return teamFullName(a).localeCompare(teamFullName(b))
    })
  }, [sorted, sportId, favoriteTeamId])

  // All-Star break detection — only worth a fetch once the MLB slate has
  // already come back empty (every other day, this never fires). Turns a
  // bare "No games scheduled." into the Derby hand-off card on Derby night,
  // or a plain break notice on the rest of the gameless week.
  const isEmptyMlbDay =
    sportId === SPORT_IDS.MLB && !loading && !error && sorted.length === 0
  const allStarInfo = useAsync(
    () => (isEmptyMlbDay ? fetchAllStarInfo(season) : Promise.resolve(null)),
    [isEmptyMlbDay, season],
  )
  const breakWindow = useMemo(
    () => allStarBreakWindow(allStarInfo.data, dateStr),
    [allStarInfo.data, dateStr],
  )

  // Games with a Top Performers box to reveal — any that have started, on
  // today or a past date. A future date, or today before first pitch, has
  // nothing yet, so the box doesn't render at all (see below).
  const eligibleGames = useMemo(
    () => sorted.filter((g) => g.abstractState !== 'Preview'),
    [sorted],
  )

  // A day you've paged BACK to (offset < 0) gets the past-day treatment: each
  // Final game's card flips over to a result summary, and the Day Recap panel
  // (Top Performers + Day Highlights) replaces the plain Top Performers box.
  // Today (offset 0) gets the SAME treatment once every one of its games has
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
    offset === 0 && sorted.length > 0 && sorted.every((g) => g.abstractState === 'Final')
  const showPastDayTreatment = offset < 0 || todayAllFinal
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

  // What each club is wearing isn't in the schedule payload, so it rides a
  // separate one-shot request keyed on the slate's gamePks (posted ~first
  // pitch, so it re-fetches as the games go live via the same reload seam).
  const pkKey = useMemo(
    () => sorted.map((g) => g.gamePk).join(','),
    [sorted],
  )
  const uniforms = useAsync(
    () => fetchScheduleUniforms(pkKey ? pkKey.split(',') : []),
    [pkKey],
  )
  const uniformsReady = uniforms.data ?? {}

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
        {/* Title + level toggle + search share one row: the Scorebook mark taps
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
            <ScorebookMark size={20} simplified />
            Scorebook
          </button>
          <div className="topbar__slateactions">
            <LevelNav sportId={sportId} onChange={pickLevel} />
            <SiteSearchButton className="topbar__search" />
            <SiteMenuButton className="topbar__search" />
          </div>
        </header>

        <div className="datenav datenav--row">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous day">
            ‹
          </button>
          <span className="datenav__label">
            {humanDate(dateStr)}
            {/* One tap back to today once you've paged away — no arrow-mashing
                home from a date you browsed to. */}
            {offset !== 0 && (
              <button
                type="button"
                className="datenav__today"
                onClick={() => setOffset(0)}
              >
                Today
              </button>
            )}
          </span>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Next day">
            ›
          </button>
        </div>

        {finals.length === 0 && offset <= 0 && eligibleGames.length > 0 && (
          <TopPerformersBox
            dateStr={dateStr}
            sportId={sportId}
            games={eligibleGames}
            prospectsData={prospects.data}
          />
        )}
      </div>

      <AsyncStatus
        loading={loading}
        error={error}
        hasData={sorted.length > 0}
        errorMessage="Couldn’t load games. Check your connection and try again."
        onRetry={slate.reload}
        // Suppressed for a day the break window will claim (below) — briefly
        // while allStarInfo is still in flight too, so a Derby night doesn't
        // flash "No games scheduled." before the fetch resolves.
        emptyMessage={allStarInfo.loading || breakWindow ? null : 'No games scheduled.'}
      />

      {sorted.length === 0 && breakWindow && !breakWindow.isDerbyDay && (
        <p className="hint">
          All-Star Break — next game {humanDate(breakWindow.resumeDate)}
        </p>
      )}

      {finals.length > 0 && !revealedAll && (
        <RevealAllBar onReveal={() => setRevealedAll(true)} />
      )}

      <div className={finals.length > 0 ? 'slate-body' : undefined}>
        <ul className="gamelist">
          {sorted.length === 0 && breakWindow?.isDerbyDay && (
            <li>
              <DerbyCard />
            </li>
          )}
          {sorted.map((g) => {
            const pinnedTeamId = isPinned(g, favoriteTeamId, favoriteAffiliateIds)
              ? favoriteTeamId
              : null
            const uReady = !!uniformsReady[g.gamePk]
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
                    uniformsReady={uReady}
                    prospectCount={pCount}
                    gameScore={scoreFor(g.gamePk)}
                    onSelect={() => onPick(g, dateStr)}
                    onBoxScore={() => onPick(g, dateStr, 'boxscore')}
                  />
                ) : (
                  <GameCard
                    game={g}
                    pinnedTeamId={pinnedTeamId}
                    uniformsReady={uReady}
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

        {/* Any idle club — including the all-30 case on an All-Star break or
            All-Star Game day, where there are no club games and the full grid
            is the point (something to browse). */}
        {offDayTeamIds.length > 0 && (
          <OffDaySection
            teamIds={offDayTeamIds}
            favoriteTeamId={favoriteTeamId}
            dateStr={dateStr}
            sportId={sportId}
          />
        )}

        {finals.length > 0 && (
          <PastDayRecapBox
            dateStr={dateStr}
            sportId={sportId}
            games={finals}
            prospectsData={prospects.data}
            revealedAll={revealedAll}
            onRevealAll={() => setRevealedAll(true)}
          />
        )}
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
// (.pagenav/.btn--reveal). One tap flips every Final game's card AND
// force-reveals the Day Recap panel (see PastDayRecapBox's forceRevealed
// prop) — there's no per-card unlock, and the Day Recap's own seal does the
// same thing in reverse (see onRevealAll).
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

// Soonest → latest by first pitch; the favorite team's game (or, on a MiLB
// level, its affiliate's game) floats to the top.
function sortGames(games, favoriteTeamId, favoriteAffiliateIds) {
  return [...games].sort((a, b) => {
    const pa = isPinned(a, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
    const pb = isPinned(b, favoriteTeamId, favoriteAffiliateIds) ? 0 : 1
    if (pa !== pb) return pa - pb
    return new Date(a.gameDate) - new Date(b.gameDate)
  })
}
