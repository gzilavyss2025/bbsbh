// The historical-contract identity review queue (ADR-0066, route:
// /admin/contracts, admin only, unlinked). Reviews every row
// scripts/gen-contracts-identity.mjs could not confidently match on its
// own — fuzzy (auto-resolved, but worth a glance), ambiguous, and
// unresolved — and lets an admin assign or dismiss a row without touching
// a spreadsheet.
//
// Reads TWO separate things and merges them client-side, deliberately not
// through one API call: public/data/contracts-history/identity/pending.json
// (the ~1,800 non-exact rows, a static file the CDN can cache) and
// GET /api/contract-identity (the small Redis-backed override map — see
// that file's own header for why these are not the same endpoint).
//
// NOTHING HERE IS SCORE-BEARING — every field is a historical contract
// record or an MLB id, no game, no linescore, no reveal state.
import { useCallback, useMemo, useState } from 'react'
import { useAuth, useUser } from '@clerk/clerk-react'
import { SiteHeader } from '../../components/chrome/SiteHeader.jsx'
import { ReportFooter } from '../../components/chrome/ReportFooter.jsx'
import { useAsync } from '../../hooks/useAsync.js'
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js'
import { isClerkEnabled } from '../../lib/clerkConfig.js'
import { teamAbbr } from '../../lib/teams.js'
import { saveContractIdentityPatch } from '../../lib/admin/saveContractIdentityPatch.js'
import '../../styles/research/diary.css'

// Stable references for the "no data yet" fallback — a fresh {} or [] every
// render would defeat the filtered-rows useMemo below on every keystroke.
const EMPTY_OVERRIDES = {}
const EMPTY_ROWS = []

const SOURCE_LABEL = {
  extensions: 'Extension',
  arbitration: 'Arbitration',
  free_agency: 'Free agency',
  salaries: 'Salary',
}

function Shell({ children }) {
  useDocumentTitle('Contract identity review')
  return (
    <div className="screen researchdiary">
      <SiteHeader />
      <main className="researchdiary__main">{children}</main>
      <ReportFooter />
    </div>
  )
}

function Notice({ children }) {
  return <p className="researchdiary__notice caps-exempt">{children}</p>
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return res.json()
}

function usePendingRows() {
  return useAsync(() => fetchJson('/data/contracts-history/identity/pending.json'), [])
}

function useOverrides() {
  return useAsync(async () => {
    const body = await fetchJson('/api/contract-identity')
    return body?.overrides ?? {}
  }, [])
}

// Lazily fetches and caches one season's player pool for the roster-search
// picker — the same static file the matching pipeline itself reads, so
// "search for the right player" always offers exactly the candidates the
// pipeline could have matched against.
function useSeasonPool() {
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

function RosterSearch({ season, onPick }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { cache, load } = useSeasonPool()
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
        className="researchdiary__disclose"
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
    <div className="researchdiary__technical">
      <input
        type="text"
        placeholder="Type a name…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label={`Search ${season} roster by name`}
      />
      {pool == null && <p className="caps-exempt">Loading {season} roster…</p>}
      <ul className="researchdiary__techlist">
        {matches.map((p) => (
          <li key={p.id} className="caps-exempt">
            {p.lastFirstName} — {p.position ?? '—'}, teamId {p.teamId ?? '—'} (id {p.id}){' '}
            <button type="button" onClick={() => onPick(p.id)}>
              Use this player
            </button>
          </li>
        ))}
        {query.trim().length >= 2 && matches.length === 0 && pool && (
          <li className="caps-exempt">No match in this season&apos;s roster.</li>
        )}
      </ul>
    </div>
  )
}

function Row({ row, override, onCorrect, onDismiss, onUndo, saving }) {
  const [manualId, setManualId] = useState('')
  const team = row.rawTeamCode ? teamAbbr({ id: row.rawTeamCode }) : '—'
  const season = row.matchedSeason ?? row.season

  return (
    <article className="researchdiary__entry">
      <header className="researchdiary__entryhead">
        <p className="researchdiary__meta">
          <span className="researchdiary__source">{SOURCE_LABEL[row.sourceFile] ?? row.sourceFile}</span>
          <time>{row.season}</time>
          <span className={`researchdiary__verdict researchdiary__verdict--${row.confidence}`}>
            {row.confidence}
          </span>
        </p>
        <h2 className="researchdiary__title">{row.rawName}</h2>
        <p className="researchdiary__question caps-exempt">
          Club {team} · matched against the {season} roster · {row.matchedVia}
        </p>
      </header>

      {override ? (
        <div className="researchdiary__limits">
          <p className="caps-exempt">
            {override.dismissed
              ? 'Marked: no confident id exists.'
              : `Corrected to mlbId ${override.mlbId}.`}{' '}
            ({override.correctedBy}, {override.correctedAt})
          </p>
          <button type="button" disabled={saving} onClick={() => onUndo(row.rowKey)}>
            Undo
          </button>
        </div>
      ) : (
        <>
          {row.candidates?.length > 0 && (
            <ul className="researchdiary__points">
              {row.candidates.map((c) => (
                <li key={c.id} className="caps-exempt">
                  {c.lastFirstName} (score {c.score}, {c.reasons?.join(', ') || 'no context clues'}){' '}
                  <button type="button" disabled={saving} onClick={() => onCorrect(row.rowKey, c.id)}>
                    Use this player
                  </button>
                </li>
              ))}
            </ul>
          )}

          <RosterSearch season={season} onPick={(id) => onCorrect(row.rowKey, id)} />

          <p className="researchdiary__prose caps-exempt">
            Or enter an MLB id directly:{' '}
            <input
              type="number"
              min="1"
              value={manualId}
              onChange={(e) => setManualId(e.target.value)}
              style={{ width: '8em' }}
              aria-label="MLB id"
            />{' '}
            <button
              type="button"
              disabled={saving || !manualId}
              onClick={() => onCorrect(row.rowKey, Number(manualId))}
            >
              Save
            </button>
          </p>

          <button type="button" disabled={saving} onClick={() => onDismiss(row.rowKey)}>
            Dismiss — no confident id exists
          </button>
        </>
      )}
    </article>
  )
}

function ReviewQueue() {
  const pending = usePendingRows()
  const overridesQuery = useOverrides()
  const [sourceFilter, setSourceFilter] = useState('all')
  const [confidenceFilter, setConfidenceFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [overrides, setOverrides] = useState(null)
  const [savingRowKey, setSavingRowKey] = useState(null)
  const [error, setError] = useState(null)
  const { getToken } = useAuth()

  const effectiveOverrides = overrides ?? overridesQuery.data ?? EMPTY_OVERRIDES

  const applyPatch = useCallback(
    async (rowKey, value) => {
      setSavingRowKey(rowKey)
      setError(null)
      try {
        const result = await saveContractIdentityPatch(getToken, { [rowKey]: value })
        setOverrides(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setSavingRowKey(null)
      }
    },
    [getToken],
  )

  const rows = pending.data ?? EMPTY_ROWS
  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (sourceFilter !== 'all' && row.sourceFile !== sourceFilter) return false
      if (confidenceFilter !== 'all' && row.confidence !== confidenceFilter) return false
      if (search.trim() && !row.rawName.toLowerCase().includes(search.trim().toLowerCase())) return false // caps-js-exempt
      if (!showResolved && effectiveOverrides[row.rowKey]) return false
      return true
    })
  }, [rows, sourceFilter, confidenceFilter, search, showResolved, effectiveOverrides])

  if (pending.loading || overridesQuery.loading) return <Notice>Loading the review queue…</Notice>
  if (pending.error) return <Notice>Could not load pending.json — {pending.error.message}</Notice>

  return (
    <>
      <header className="researchdiary__masthead">
        <p className="researchdiary__eyebrow">Admin review</p>
        <h1 className="researchdiary__masttitle">Contract identity review</h1>
        <p className="researchdiary__lede caps-exempt">
          {rows.length} rows across the four historical contract files did not resolve to a
          confident MLB id on their own (ADR-0066). {filtered.length} shown below.
        </p>
      </header>

      {error && <Notice>{error}</Notice>}

      <section className="researchdiary__traps">
        <label className="caps-exempt">
          File:{' '}
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
            <option value="all">All</option>
            {Object.keys(SOURCE_LABEL).map((f) => (
              <option key={f} value={f}>
                {SOURCE_LABEL[f]}
              </option>
            ))}
          </select>
        </label>{' '}
        <label className="caps-exempt">
          Confidence:{' '}
          <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="fuzzy">Fuzzy</option>
            <option value="ambiguous">Ambiguous</option>
            <option value="unresolved">Unresolved</option>
          </select>
        </label>{' '}
        <label className="caps-exempt">
          Search: <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>{' '}
        <label className="caps-exempt">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />{' '}
          Show already-reviewed rows too
        </label>
      </section>

      <ol className="researchdiary__entries">
        {filtered.slice(0, 200).map((row) => (
          <li key={row.rowKey}>
            <Row
              row={row}
              override={effectiveOverrides[row.rowKey]}
              onCorrect={(rowKey, mlbId) => applyPatch(rowKey, { mlbId })}
              onDismiss={(rowKey) => applyPatch(rowKey, { dismissed: true })}
              onUndo={(rowKey) => applyPatch(rowKey, null)}
              saving={savingRowKey === row.rowKey}
            />
          </li>
        ))}
      </ol>
      {filtered.length > 200 && (
        <Notice>Showing the first 200 of {filtered.length} matches — narrow the filters to see more.</Notice>
      )}
    </>
  )
}

function ReviewGate() {
  const { isLoaded, isSignedIn, user } = useUser()
  if (!isLoaded) return <Notice>Checking your access…</Notice>
  if (!isSignedIn) {
    return <Notice>Sign in with an admin account to review contract identity matches.</Notice>
  }
  if (user?.publicMetadata?.role !== 'admin') {
    return <Notice>This account is signed in but does not have the admin role.</Notice>
  }
  return <ReviewQueue />
}

export function ContractIdentityReviewPage() {
  return (
    <Shell>
      {isClerkEnabled ? (
        <ReviewGate />
      ) : (
        <Notice>The contract identity review queue needs sign-in configured on this deploy.</Notice>
      )}
    </Shell>
  )
}
