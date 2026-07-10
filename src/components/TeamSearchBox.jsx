import { useState } from 'react'
import { fetchTeamDirectory, searchTeams } from '../api/search.js'
import { useAsync } from '../hooks/useAsync.js'
import { SPORT_LABEL } from '../lib/teams.js'

// Team-name search box — GameFinder's club picker. Picking a result hands the
// chosen team back via `onPick` — how GameFinder lets someone choose two
// clubs before looking up their meetings. `selected` renders the
// already-chosen team as a chip with a clear button, for that same picker
// use. (Site-wide team search lives in the header's merged search modal —
// see SiteSearch.jsx — not here.)
export function TeamSearchBox({ label = 'Find a team', placeholder = 'Team name…', onPick, selected = null }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const directory = useAsync(fetchTeamDirectory, [])

  const matches = query.trim() ? searchTeams(directory.data ?? [], query, 8) : []

  const pick = (t) => {
    setQuery('')
    setOpen(false)
    onPick(t)
  }

  return (
    <div className="searchbox">
      <label className="searchbox__label">{label}</label>
      {selected ? (
        <div className="searchbox__chosen">
          <span>{selected.name}</span>
          <button
            type="button"
            className="searchbox__clear"
            onClick={() => onPick(null)}
            aria-label={`Clear ${selected.name}`}
          >
            ×
          </button>
        </div>
      ) : (
        <>
          <input
            type="search"
            inputMode="search"
            className="searchbox__input"
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            autoComplete="off"
          />
          {open && query.trim() && (
            <ul className="searchbox__results">
              {matches.length === 0 && (
                <li className="searchbox__hint">No teams found.</li>
              )}
              {matches.map((t) => (
                <li key={`${t.sportId}-${t.id}`}>
                  <button
                    type="button"
                    className="searchbox__item"
                    onMouseDown={() => pick(t)}
                  >
                    <span className="searchbox__name">{t.name}</span>
                    <span className="searchbox__sub">{SPORT_LABEL[t.sportId] ?? ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
