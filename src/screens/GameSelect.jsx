import { useMemo, useState } from 'react'
import { fetchSchedule } from '../api/schedule.js'
import { fetchScheduleUniforms } from '../api/uniforms.js'
import { fetchRosterIdsForTeams } from '../api/team.js'
import { fetchTopProspects, countProspectsByTeam } from '../api/prospects.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { PINNED_TEAM_ID, SPORT_IDS, LEVELS } from '../lib/teams.js'
import { GameCard } from '../components/GameCard.jsx'
import { LevelNav } from '../components/LevelNav.jsx'
import { ScorebookMark } from '../components/ScorebookMark.jsx'
import { SiteFooter } from '../components/SiteFooter.jsx'
import { TopPerformersBox } from '../components/TopPerformersBox.jsx'

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
// soonest → latest (Brewers pinned to the top), with a LIVE pill on any game in
// progress. Level is toggled with the thin buttons up top; no more search box.
export function GameSelect({ onPick, onShowLogos }) {
  useDocumentTitle(null)
  const [offset, setOffset] = useState(0) // days from today
  const [sportId, setSportId] = useState(readLevel)
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

  const sorted = useMemo(() => sortGames(data ?? []), [data])

  // Games with a Top Performers box to reveal — any that have started, on
  // today or a past date. A future date, or today before first pitch, has
  // nothing yet, so the box doesn't render at all (see below).
  const eligibleGames = useMemo(
    () => sorted.filter((g) => g.abstractState !== 'Preview'),
    [sorted],
  )

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
  const prospects = useAsync(() => fetchTopProspects(), [])
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
        <header className="topbar">
          <h1 className="topbar__title">
            <ScorebookMark size={22} simplified />
            Scorebook
          </h1>
        </header>

        <LevelNav sportId={sportId} onChange={pickLevel} />

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

        {offset <= 0 && eligibleGames.length > 0 && (
          <TopPerformersBox
            dateStr={dateStr}
            sportId={sportId}
            games={eligibleGames}
            prospectsData={prospects.data}
          />
        )}
      </div>

      {loading && <p className="hint">Loading games…</p>}
      {error && (
        <>
          <p className="hint hint--error" role="status">
            Couldn’t load games. Check your connection and try again.
          </p>
          <button className="btn" onClick={slate.reload}>
            Retry
          </button>
        </>
      )}
      {!loading && !error && sorted.length === 0 && (
        <p className="hint">No games scheduled.</p>
      )}

      <ul className="gamelist">
        {sorted.map((g) => (
          <li key={`${g.sportId}-${g.gamePk}`}>
            <GameCard
              game={g}
              pinned={isPinned(g)}
              uniformsReady={!!uniformsReady[g.gamePk]}
              prospectCount={(prospectCounts[g.away.id] ?? 0) + (prospectCounts[g.home.id] ?? 0)}
              onSelect={() => onPick(g, dateStr)}
              // A completed game on a past date gets a direct box-score jump.
              onBoxScore={
                offset < 0 && g.abstractState === 'Final'
                  ? () => onPick(g, dateStr, 'boxscore')
                  : null
              }
            />
          </li>
        ))}
      </ul>

      <SiteFooter onShowLogos={onShowLogos} />
    </div>
  )
}

function isPinned(game) {
  return game.away.id === PINNED_TEAM_ID || game.home.id === PINNED_TEAM_ID
}

// Soonest → latest by first pitch; the pinned Brewers game floats to the top.
function sortGames(games) {
  return [...games].sort((a, b) => {
    const pa = isPinned(a) ? 0 : 1
    const pb = isPinned(b) ? 0 : 1
    if (pa !== pb) return pa - pb
    return new Date(a.gameDate) - new Date(b.gameDate)
  })
}
