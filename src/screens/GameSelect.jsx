import { useMemo, useState } from 'react'
import { fetchSchedule } from '../api/mlb.js'
import { useAsync } from '../hooks/useAsync.js'
import { toApiDate, addDays, humanDate } from '../lib/dates.js'
import { PINNED_TEAM_ID, SPORT_IDS } from '../lib/teams.js'
import { GameCard } from '../components/GameCard.jsx'
import { DiamondGlyph } from '../components/DiamondGlyph.jsx'

// Level toggle order across the top of the slate. MLB is selected by default.
const LEVELS = [
  { label: 'MLB', sportId: SPORT_IDS.MLB },
  { label: 'AAA', sportId: SPORT_IDS.AAA },
  { label: 'AA', sportId: SPORT_IDS.AA },
  { label: 'A+', sportId: SPORT_IDS['A+'] },
  { label: 'A', sportId: SPORT_IDS.A },
]

// Screen 1: pick a game. A single level's slate for the chosen date, sorted
// soonest → latest (Brewers pinned to the top), with a LIVE pill on any game in
// progress. Level is toggled with the thin buttons up top; no more search box.
export function GameSelect({ onPick, onShowLogos }) {
  const [offset, setOffset] = useState(0) // days from today
  const [sportId, setSportId] = useState(SPORT_IDS.MLB)

  const dateStr = useMemo(
    () => toApiDate(addDays(new Date(), offset)),
    [offset],
  )

  const slate = useAsync(() => fetchSchedule(dateStr, sportId), [dateStr, sportId])
  const { loading, error, data } = slate

  const sorted = useMemo(() => sortGames(data ?? []), [data])

  return (
    <div className="screen">
      <header className="topbar">
        <h1 className="topbar__title">
          <DiamondGlyph size={22} bases={[false, true, false]} />
          Scorebook
        </h1>
        <div className="topbar__right">
          <button
            type="button"
            className="btn btn--ghost topbar__logos"
            onClick={onShowLogos}
          >
            Logos
          </button>
        </div>
      </header>

      <div className="levelnav" role="tablist" aria-label="Level">
        {LEVELS.map((lvl) => (
          <button
            key={lvl.sportId}
            type="button"
            role="tab"
            aria-selected={sportId === lvl.sportId}
            className={`levelnav__btn ${sportId === lvl.sportId ? 'is-active' : ''}`}
            onClick={() => setSportId(lvl.sportId)}
          >
            {lvl.label}
          </button>
        ))}
      </div>

      <div className="datenav datenav--row">
        <button onClick={() => setOffset((o) => o - 1)} aria-label="Previous day">
          ‹
        </button>
        <span className="datenav__label">{humanDate(dateStr)}</span>
        <button onClick={() => setOffset((o) => o + 1)} aria-label="Next day">
          ›
        </button>
      </div>

      {loading && <p className="hint">Loading games…</p>}
      {error && (
        <p className="hint hint--error">
          Couldn’t load games. Check your connection and try again.
        </p>
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
