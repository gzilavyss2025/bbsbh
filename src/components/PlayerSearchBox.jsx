import { useState } from 'react'
import { searchPeople } from '../api/mlb.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { useNav } from '../lib/nav.js'
import { playerPath } from '../lib/route.js'

// Footer name search: type a few letters, pick from the live dropdown, land
// on that player's page. Spoiler-free — the dropdown shows only name/position/
// club, and a bare player link (no game context) defaults to current-season
// stats like any other cold PlayerLink.
export function PlayerSearchBox() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const navigate = useNav()
  const debounced = useDebouncedValue(query.trim(), 250)

  const search = useAsync(() => searchPeople(debounced), [debounced])
  const matches = debounced.length >= 2 ? (search.data ?? []) : []

  const pick = (p) => {
    setQuery('')
    setOpen(false)
    navigate(playerPath(p.id))
  }

  return (
    <div className="searchbox">
      <label className="searchbox__label" htmlFor="footer-player-search">
        Find a player
      </label>
      <input
        id="footer-player-search"
        type="search"
        inputMode="search"
        className="searchbox__input"
        placeholder="Player name…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        autoComplete="off"
      />
      {open && debounced.length >= 2 && (
        <ul className="searchbox__results">
          {search.loading && <li className="searchbox__hint">Searching…</li>}
          {!search.loading && matches.length === 0 && (
            <li className="searchbox__hint">No players found.</li>
          )}
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="searchbox__item"
                onMouseDown={() => pick(p)}
              >
                <span className="searchbox__name">{p.name}</span>
                <span className="searchbox__sub">
                  {[p.pos, p.team].filter(Boolean).join(' · ')}
                  {!p.active && ' · Retired'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
