import { useMemo, useState } from 'react'
import { fetchSchedule, searchGamesByTeam } from '../api/mlb.js'
import { useAsync } from '../hooks/useAsync.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { PINNED_TEAM_ID } from '../lib/teams.js'
import { GameCard } from '../components/GameCard.jsx'
import { DiamondGlyph } from '../components/DiamondGlyph.jsx'

// Screen 1: pick a game. Today's MLB slate with the Brewers pinned to the top,
// plus a search box that also queries MiLB by team name.
export function GameSelect({ onPick }) {
  const [offset, setOffset] = useState(0) // days from today
  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')

  const dateStr = useMemo(
    () => toApiDate(addDays(new Date(), offset)),
    [offset],
  )

  const slate = useAsync(() => fetchSchedule(dateStr, 1), [dateStr])
  const search = useAsync(
    () => (submitted ? searchGamesByTeam(dateStr, submitted) : Promise.resolve(null)),
    [dateStr, submitted],
  )

  const showingSearch = Boolean(submitted)
  const games = showingSearch ? search.data : slate.data
  const { loading, error } = showingSearch ? search : slate

  const sorted = useMemo(() => sortGames(games ?? []), [games])

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="topbar__title">
          <DiamondGlyph size={22} bases={[false, true, false]} />
          Scorebook
        </h1>
        <div className="datenav">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous day">
            ‹
          </button>
          <span className="datenav__label">{humanDate(dateStr)}</span>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Next day">
            ›
          </button>
        </div>
      </header>

      <form
        className="searchbar"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(query.trim())
        }}
      >
        <input
          type="search"
          inputMode="search"
          placeholder="Search team (MLB or MiLB)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {showingSearch && (
          <button
            type="button"
            className="searchbar__clear"
            onClick={() => {
              setQuery('')
              setSubmitted('')
            }}
          >
            Clear
          </button>
        )}
      </form>

      {loading && <p className="hint">Loading games…</p>}
      {error && (
        <p className="hint hint--error">
          Couldn’t load games. Check your connection and try again.
        </p>
      )}
      {!loading && !error && sorted.length === 0 && (
        <p className="hint">
          {showingSearch ? 'No games found for that team.' : 'No games scheduled.'}
        </p>
      )}

      <ul className="gamelist">
        {sorted.map((g) => (
          <li key={`${g.sportId}-${g.gamePk}`}>
            <GameCard
              game={g}
              pinned={isPinned(g)}
              onSelect={() => onPick(g)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

function isPinned(game) {
  return game.away.id === PINNED_TEAM_ID || game.home.id === PINNED_TEAM_ID
}

// Brewers games float to the top; everything else keeps schedule order.
function sortGames(games) {
  return [...games].sort((a, b) => {
    const pa = isPinned(a) ? 0 : 1
    const pb = isPinned(b) ? 0 : 1
    if (pa !== pb) return pa - pb
    return 0
  })
}
