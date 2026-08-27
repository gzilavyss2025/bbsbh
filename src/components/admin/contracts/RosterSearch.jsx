// The season-roster picker for the contract identity workbench, plus the
// season-pool cache it reads. It fetches the SAME static file the matching
// pipeline itself reads, so "search for the right player" always offers
// exactly the people the pipeline could have matched against, and never
// anyone it could not have.
//
// The cache is a hook rather than state inside the picker because two surfaces
// need it: this picker, and the confirm pane, which resolves an already-chosen
// mlbId back to a name. One owner (DecisionPane) holds the hook and hands the
// cache down, so opening the picker never refetches a pool the pane just read.
import { useCallback, useMemo, useState } from 'react'
import { staticJsonBy } from '../../../api/staticJson.js'

// MEMOIZE THE REQUEST, NOT JUST THE RESULT — the same bug staticJson.js exists
// to close, and a multi-season group walks straight into it. A cache keyed on
// the RESOLVED pool only short-circuits a call that starts after the first one
// has already landed, so a group spanning ten seasons re-fetched ~95 KB pools
// that were still in flight. staticJsonBy hands every caller the one in-flight
// promise per season. Module level on purpose: a past season's pool is an
// immutable file, so the memo is good for the whole session.
const loadSeasonPool = staticJsonBy(
  (season) => `/data/contracts-history/season-players/${season}.json`,
  { fallback: [] },
)

// React's view of that memo. The rendering half still needs state, to repaint
// when a pool lands; `load` stays identity-stable so an effect that calls it
// cannot re-fire itself on its own dependency.
export function useSeasonPool() {
  const [cache, setCache] = useState({})
  const load = useCallback(async (season) => {
    if (!season) return []
    const pool = await loadSeasonPool(season)
    setCache((prev) => (prev[season] === pool ? prev : { ...prev, [season]: pool }))
    return pool
  }, [])
  return { cache, load }
}

export function RosterSearch({ season, onPick, cache, load, disabled }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const pool = cache[season]

  const matches = useMemo(() => {
    if (!pool || query.trim().length < 2) return []
    const q = query.trim().toLowerCase() // caps-js-exempt
    return pool.filter((p) => p.lastFirstName?.toLowerCase().includes(q)).slice(0, 10) // caps-js-exempt
  }, [pool, query])

  if (!open) {
    return (
      <button
        type="button"
        className="cwb__disclose"
        onClick={() => {
          setOpen(true)
          load(season)
        }}
      >
        + Search {season ?? 'that'} season&apos;s roster
      </button>
    )
  }

  return (
    <div className="cwb__roster">
      <input
        type="text"
        className="cwb__field"
        placeholder="Type a name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={`Search ${season} roster by name`}
      />
      {pool == null && <p className="cwb__hint caps-exempt">Loading the {season} roster…</p>}
      <ul className="cwb__rosterlist">
        {matches.map((p) => (
          <li key={p.id} className="cwb__rosterrow caps-exempt">
            <span>
              {p.lastFirstName} — {p.position ?? '—'}, id {p.id}
            </span>
            <button
              type="button"
              className="cwb__mini"
              disabled={disabled}
              onClick={() => onPick(p.id)}
            >
              Use this player
            </button>
          </li>
        ))}
        {query.trim().length >= 2 && matches.length === 0 && pool && (
          <li className="cwb__rosterrow caps-exempt">No match in this season&apos;s roster.</li>
        )}
      </ul>
    </div>
  )
}
