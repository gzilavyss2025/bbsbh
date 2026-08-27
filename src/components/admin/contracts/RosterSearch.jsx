// The season-roster picker for the contract identity workbench, plus the
// season-pool cache it reads. Lifted out of the page file unchanged in
// behaviour: it fetches the SAME static file the matching pipeline itself
// reads, so "search for the right player" always offers exactly the people the
// pipeline could have matched against, and never anyone it could not have.
//
// The cache is a hook rather than state inside the picker because two surfaces
// need it: this picker, and the confirm pane, which resolves an already-chosen
// mlbId back to a name. One owner (DecisionPane) holds the hook and hands the
// cache down, so opening the picker never refetches a pool the pane just read.
import { useCallback, useMemo, useState } from 'react'

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

export function useSeasonPool() {
  const [cache, setCache] = useState({})
  const load = useCallback(
    async (season) => {
      if (!season || cache[season]) return cache[season] ?? []
      try {
        const pool = await fetchJson(`/data/contracts-history/season-players/${season}.json`)
        setCache((prev) => ({ ...prev, [season]: pool }))
        return pool
      } catch {
        setCache((prev) => ({ ...prev, [season]: [] }))
        return []
      }
    },
    [cache],
  )
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
