// Two-panel lookup deck for /admin/contracts (ADR-0066). The review queue
// walks the automated matcher's own shortlist for one pending row at a time;
// this is the other way in — search from something Gary already remembers,
// either a name off the source record or a player he knows by heart, and
// hand either one back to the row on screen.
//
// Left panel searches the contract source records themselves (the raw text
// each row was parsed from); right panel searches MLB people the same way
// the site-wide search box does. The two are independent — nothing here
// reads or writes the review queue's own state beyond the props below.

import { useCallback, useId, useMemo, useRef, useState } from 'react'
import { searchPeople } from '../../../api/search.js'
import { useAsync } from '../../../hooks/useAsync.js'
import { useDebouncedValue } from '../../../hooks/useDebouncedValue.js'
import { playerPath } from '../../../lib/route.js'

const SEARCH_INDEX_URL = '/data/contracts-history/search-index.json'
const RECORD_RESULT_CAP = 100
const PLAYER_SEARCH_DEBOUNCE_MS = 180
const PLAYER_RESULT_LIMIT = 8
// A stable empty list, so "no query, nothing to show" is the same reference
// every render — same reasoning as SiteSearch.jsx's own NO_PLAYERS constant.
const NO_RESULTS = []

// A row's confidence tier (ADR-0066: exact/fuzzy/ambiguous/unresolved) gets a
// title-cased label; anything else — a stray number, an unfamiliar string —
// falls back rather than rendering blank.
const CONFIDENCE_LABELS = {
  exact: 'Exact',
  fuzzy: 'Fuzzy',
  ambiguous: 'Ambiguous',
  unresolved: 'Unresolved',
}

function formatConfidence(confidence) {
  if (confidence === null || confidence === undefined || confidence === '') return '—'
  if (typeof confidence === 'number') {
    return confidence <= 1 ? `${Math.round(confidence * 100)}%` : String(confidence)
  }
  return CONFIDENCE_LABELS[confidence] ?? String(confidence)
}

// Distinct, sorted values of one field across the index, for the filter
// dropdowns. Blank/nullish values are dropped rather than showing an empty
// option.
function uniqueSorted(index, field) {
  const values = new Set()
  for (const row of index ?? []) {
    const v = row[field]
    if (v !== null && v !== undefined && v !== '') values.add(String(v))
  }
  return Array.from(values).sort()
}

// Seasons read better newest-first than alphabetically ("1998" would
// otherwise sort ahead of "2005").
function seasonOptions(index) {
  const values = new Set()
  for (const row of index ?? []) {
    if (row.season !== null && row.season !== undefined && row.season !== '') {
      values.add(String(row.season))
    }
  }
  return Array.from(values).sort((a, b) => Number(b) - Number(a))
}

// Fetched once, ever, and shared across every mount of this component — the
// index is 5.1 MB / 36,366 rows, and a second panel (or a remount) has no
// reason to pull it twice in the same visit. A failed fetch is NOT cached:
// leaving `recordIndexPromise` null on failure lets the next keystroke retry
// rather than pinning the panel to one bad response for the rest of the tab.
let recordIndexPromise = null
function fetchRecordIndex() {
  if (!recordIndexPromise) {
    const promise = fetch(SEARCH_INDEX_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`search-index ${res.status}`)
        return res.json()
      })
      .catch((err) => {
        recordIndexPromise = null
        throw err
      })
    recordIndexPromise = promise
  }
  return recordIndexPromise
}

export function LookupDeck({ selectedRow, onUseAsMatch, disabled }) {
  return (
    <div className="lookupdeck">
      <RecordSearchPanel />
      <PlayerSearchPanel selectedRow={selectedRow} onUseAsMatch={onUseAsMatch} disabled={disabled} />
    </div>
  )
}

// --- Left panel: the contract source records --------------------------------

function RecordSearchPanel() {
  const uid = useId()
  const [query, setQuery] = useState('')
  const [source, setSource] = useState('')
  const [team, setTeam] = useState('')
  const [season, setSeason] = useState('')
  const [index, setIndex] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | ready | error
  const requestedRef = useRef(false)

  const ensureIndex = useCallback(() => {
    if (requestedRef.current) return
    requestedRef.current = true
    setStatus('loading')
    fetchRecordIndex()
      .then((data) => {
        setIndex(Array.isArray(data) ? data : [])
        setStatus('ready')
      })
      .catch(() => {
        requestedRef.current = false
        setStatus('error')
      })
  }, [])

  const handleQueryChange = (value) => {
    setQuery(value)
    if (value.trim() && !requestedRef.current) ensureIndex()
  }

  const sourceOptions = useMemo(() => uniqueSorted(index, 'sourceFile'), [index])
  const teamOptions = useMemo(() => uniqueSorted(index, 'rawTeamCode'), [index])
  const seasons = useMemo(() => seasonOptions(index), [index])

  const trimmedQuery = query.trim().toLowerCase() // caps-js-exempt: case-insensitive matching, not display
  const matches = useMemo(() => {
    if (!index || !trimmedQuery) return []
    return index.filter((row) => {
      if (!(row.rawName ?? '').toLowerCase().includes(trimmedQuery)) return false // caps-js-exempt: case-insensitive matching, not display
      if (source && row.sourceFile !== source) return false
      if (team && row.rawTeamCode !== team) return false
      if (season && String(row.season) !== season) return false
      return true
    })
  }, [index, trimmedQuery, source, team, season])

  const shown = matches.slice(0, RECORD_RESULT_CAP)

  return (
    <section className="lookupdeck__panel" aria-labelledby={`${uid}-heading`}>
      <h3 id={`${uid}-heading`} className="lookupdeck__heading">
        Search contract records
      </h3>

      <div className="lookupdeck__field">
        <label htmlFor={`${uid}-query`} className="lookupdeck__label">
          Name
        </label>
        <input
          id={`${uid}-query`}
          type="search"
          className="lookupdeck__input"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Name as the source printed it"
          autoComplete="off"
        />
      </div>

      <div className="lookupdeck__filters">
        <div className="lookupdeck__field lookupdeck__field--compact">
          <label htmlFor={`${uid}-source`} className="lookupdeck__label">
            Source
          </label>
          <select
            id={`${uid}-source`}
            className="lookupdeck__select"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            disabled={!index}
          >
            <option value="">All sources</option>
            {sourceOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="lookupdeck__field lookupdeck__field--compact">
          <label htmlFor={`${uid}-team`} className="lookupdeck__label">
            Team
          </label>
          <select
            id={`${uid}-team`}
            className="lookupdeck__select"
            value={team}
            onChange={(e) => setTeam(e.target.value)}
            disabled={!index}
          >
            <option value="">All teams</option>
            {teamOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div className="lookupdeck__field lookupdeck__field--compact">
          <label htmlFor={`${uid}-season`} className="lookupdeck__label">
            Season
          </label>
          <select
            id={`${uid}-season`}
            className="lookupdeck__select"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            disabled={!index}
          >
            <option value="">All seasons</option>
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {status === 'loading' && <p className="lookupdeck__status">Loading contract records…</p>}
      {status === 'error' && (
        <p className="lookupdeck__status lookupdeck__status--error">
          Couldn’t load the contract record index. Try again.
        </p>
      )}
      {status === 'ready' && trimmedQuery && matches.length === 0 && (
        <p className="lookupdeck__status">No records match “{query.trim()}”.</p>
      )}
      {status === 'ready' && trimmedQuery && matches.length > 0 && (
        <p className="lookupdeck__count">
          {matches.length} match{matches.length === 1 ? '' : 'es'}
          {matches.length > shown.length ? ` — showing first ${shown.length}` : ''}
        </p>
      )}

      <ul className="lookupdeck__list" aria-label="Contract record results">
        {shown.map((row) => (
          <li key={row.rowKey} className="lookupdeck__row">
            <div className="lookupdeck__rowmain">
              <span className="lookupdeck__rowname">{row.rawName}</span>
              <span className="lookupdeck__rowmeta">
                {[row.sourceFile, row.season, row.rawTeamCode, formatConfidence(row.confidence)]
                  .filter((v) => v !== null && v !== undefined && v !== '')
                  .join(' · ')}
              </span>
            </div>
            {row.mlbId != null && (
              <div className="lookupdeck__rowactions">
                <a
                  href={playerPath(row.mlbId)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lookupdeck__link"
                >
                  View player
                </a>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// --- Right panel: MLB people --------------------------------------------------

function PlayerSearchPanel({ selectedRow, onUseAsMatch, disabled }) {
  const uid = useId()
  const [query, setQuery] = useState('')
  const trimmed = query.trim()
  const hasQuery = trimmed.length >= 2
  const debounced = useDebouncedValue(hasQuery ? trimmed : '', PLAYER_SEARCH_DEBOUNCE_MS)

  // useAsync owns the fetch/loading/stale-response guarding (it already runs
  // that logic behind its own lint-approved effect) — the same delegation
  // SiteSearch.jsx makes for this exact lookup.
  const people = useAsync(() => searchPeople(debounced, PLAYER_RESULT_LIMIT), [debounced])

  // Hold the previous query's rows while the next request is in flight
  // instead of blanking to a spinner, and fall back to NO_RESULTS once the
  // query is cleared — the same "adjust state while rendering" pattern
  // SiteSearch.jsx uses for its own player list, so nothing here writes
  // state back through an effect. NO_RESULTS is a module constant precisely
  // so the cleared-out case is reference-stable.
  const [results, setResults] = useState(NO_RESULTS)
  const nextResults = hasQuery ? people.data : NO_RESULTS
  if (nextResults && nextResults !== results) setResults(nextResults)

  const searching = hasQuery && (people.loading || debounced !== trimmed)
  const noResults = hasQuery && !searching && results.length === 0

  return (
    <section className="lookupdeck__panel" aria-labelledby={`${uid}-heading`}>
      <h3 id={`${uid}-heading`} className="lookupdeck__heading">
        Search MLB players
      </h3>

      <div className="lookupdeck__field">
        <label htmlFor={`${uid}-query`} className="lookupdeck__label">
          Player name
        </label>
        <input
          id={`${uid}-query`}
          type="search"
          className="lookupdeck__input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Current or retired player"
          autoComplete="off"
        />
      </div>

      {searching && <p className="lookupdeck__status">Searching…</p>}
      {noResults && <p className="lookupdeck__status">No players match “{trimmed}”.</p>}

      <ul className="lookupdeck__list" aria-label="MLB player results">
        {results.map((person) => (
          <li key={person.id} className="lookupdeck__row">
            <div className="lookupdeck__rowmain">
              <span className="lookupdeck__rowname">{person.name}</span>
              <span className="lookupdeck__rowmeta">
                {[person.pos, person.team].filter(Boolean).join(' · ')}
              </span>
            </div>
            <div className="lookupdeck__rowactions">
              <a
                href={playerPath(person.id, { name: person.name })}
                target="_blank"
                rel="noopener noreferrer"
                className="lookupdeck__link"
              >
                View player
              </a>
              {selectedRow && (
                <button
                  type="button"
                  className="lookupdeck__usebtn"
                  disabled={disabled}
                  onClick={() => onUseAsMatch(person.id)}
                >
                  Use as this row’s match
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
