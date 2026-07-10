import { useEffect, useRef, useState } from 'react'
import { searchPeople, fetchTeamDirectory, searchTeams } from '../api/search.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { useNav } from '../lib/nav.js'
import { playerPath, teamPath } from '../lib/route.js'
import { SPORT_LABEL } from '../lib/teams.js'

// The site-wide search trigger — a persistent icon button (not an always-open
// input; on a phone-width header there's no room to dock one, and this is the
// mobile-standard pattern anyway) that opens SiteSearchModal. Lives in
// SiteHeader (every screen except the slate) and the slate's own topbar (see
// GameSelect), so it's reachable from anywhere in the app.
export function SiteSearchButton({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`sitesearch-btn ${className}`}
        onClick={() => setOpen(true)}
        aria-label="Search players and teams"
      >
        <SearchGlyph />
      </button>
      {open && <SiteSearchModal onClose={() => setOpen(false)} />}
    </>
  )
}

function SearchGlyph() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
      <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

// One box, two kinds of result — merges what used to be the footer's separate
// PlayerSearchBox and TeamSearchBox into a single site-wide lookup. Same
// bottom-sheet dialog contract as GameFinderModal: Escape / a backdrop tap
// closes it, focus moves to the input on open and back to the trigger on close.
export function SiteSearchModal({ onClose }) {
  const [query, setQuery] = useState('')
  const navigate = useNav()
  const debounced = useDebouncedValue(query.trim(), 250)

  const people = useAsync(() => searchPeople(debounced), [debounced])
  const directory = useAsync(fetchTeamDirectory, [])

  const hasQuery = debounced.length >= 2
  const playerMatches = hasQuery ? (people.data ?? []) : []
  const teamMatches = hasQuery ? searchTeams(directory.data ?? [], debounced, 8) : []
  const loading = hasQuery && people.loading
  const noResults = hasQuery && !loading && playerMatches.length === 0 && teamMatches.length === 0

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const inputRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    inputRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const goPlayer = (p) => {
    onClose()
    navigate(playerPath(p.id))
  }
  const goTeam = (t) => {
    onClose()
    navigate(teamPath(t.id))
  }

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div
        className="sheet sitesearchsheet"
        role="dialog"
        aria-modal="true"
        aria-label="Search players and teams"
      >
        <div className="sitesearchsheet__head">
          <input
            ref={inputRef}
            type="search"
            inputMode="search"
            className="sitesearchsheet__input"
            placeholder="Search players or teams…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button
            type="button"
            className="sitesearchsheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="sitesearchsheet__results">
          {!hasQuery && (
            <p className="sitesearchsheet__hint">Type at least 2 letters to search.</p>
          )}
          {loading && <p className="sitesearchsheet__hint">Searching…</p>}
          {noResults && <p className="sitesearchsheet__hint">No matches found.</p>}

          {playerMatches.length > 0 && (
            <section>
              <h3 className="sitesearchsheet__group">Players</h3>
              <ul className="sitesearchsheet__list">
                {playerMatches.map((p) => (
                  <li key={`p-${p.id}`}>
                    <button
                      type="button"
                      className="searchbox__item"
                      onClick={() => goPlayer(p)}
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
            </section>
          )}

          {teamMatches.length > 0 && (
            <section>
              <h3 className="sitesearchsheet__group">Teams</h3>
              <ul className="sitesearchsheet__list">
                {teamMatches.map((t) => (
                  <li key={`t-${t.sportId}-${t.id}`}>
                    <button
                      type="button"
                      className="searchbox__item"
                      onClick={() => goTeam(t)}
                    >
                      <span className="searchbox__name">{t.name}</span>
                      <span className="searchbox__sub">{SPORT_LABEL[t.sportId] ?? ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
