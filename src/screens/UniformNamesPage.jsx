import { useEffect, useMemo, useState } from 'react'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { ALL_MLB_TEAM_IDS, teamFullName, teamClubName } from '../lib/teams.js'
import {
  fetchTeamUniformCatalog,
  fetchUniformNameOverrides,
  uniformDisplayName,
  jerseyLabel,
} from '../api/uniforms.js'

// Anchor id for a team's section — shared by the row itself and the pinned
// sidebar's jump links, same convention as TeamColorLab.jsx's teamAnchorId
// (kept as its own local copy rather than a shared export — a one-line pure
// function isn't worth a cross-screen import).
function teamAnchorId(teamId) {
  return `uniformnames-team-${teamId}`
}

const SAVE_URL = '/api/dev/uniform-names'

// Dev-only curation page (App.jsx gates the import to import.meta.env.DEV —
// see there for why) for authoring the exact wording a scorer sees for every
// current MLB club's jersey (Team Color Lab, eventually a record-by-jersey
// breakdown). Every jersey in the live uniforms-CATALOG
// (fetchTeamUniformCatalog, current season only — this is a naming tool, not
// a historical browser) gets ONE text box, pre-filled with
// uniformDisplayName's current default ("Home", "Away", "City Connect",
// "Alternate: Navy Blue") — full precision, not just an Alternate's specific
// name, so a human can overwrite any row outright (even a Home/Away/City
// Connect one that already names itself) if the default wording isn't right.
// Save posts the WHOLE curated map (uniformAssetCode -> full name string) to
// vite.config.js's dev-only middleware, which writes it straight to
// public/data/uniform-names.json — the file src/api/uniforms.js's
// fetchUniformNameOverrides (and this page itself, on the next load) read
// back. No effect outside `npm run dev` — see that middleware's own comment
// for why this is the one deliberate exception to the app's no-backend rule.
export function UniformNamesPage() {
  useDocumentTitle('Uniform Names')
  const teams = useMemo(
    () => [...ALL_MLB_TEAM_IDS].sort((a, b) => teamFullName(a).localeCompare(teamFullName(b))),
    [],
  )
  const [catalog, setCatalog] = useState({})
  const [savedOverrides, setSavedOverrides] = useState({})
  const [edits, setEdits] = useState({}) // code -> in-progress full name text
  const [status, setStatus] = useState(null) // 'saving' | 'saved' | 'error' | null

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetchTeamUniformCatalog(ALL_MLB_TEAM_IDS, new Date().getFullYear()),
      fetchUniformNameOverrides(),
    ]).then(([catalogData, overrides]) => {
      if (cancelled) return
      setCatalog(catalogData)
      setSavedOverrides(overrides)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function handleChange(code, value) {
    setEdits((prev) => ({ ...prev, [code]: value }))
    setStatus(null)
  }

  async function handleSave() {
    setStatus('saving')
    // Merge this session's edits over the last-saved map so an untouched
    // row's already-curated name (from an earlier save) survives — the
    // middleware always overwrites the whole file, so a partial `edits`
    // object here would silently drop every other row's name.
    const merged = { ...savedOverrides }
    for (const [code, name] of Object.entries(edits)) {
      const trimmed = name.trim()
      if (trimmed) merged[code] = trimmed
      else delete merged[code]
    }
    try {
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
      setSavedOverrides(merged)
      setEdits({})
      setStatus('saved')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Uniform Names</h1>
      </header>
      <p className="hint">
        An unlisted, dev-only curation tool — not linked anywhere in the app.
        Every current MLB club’s uniform catalog, one text box per jersey,
        pre-filled with the exact wording it’d currently show. Overwrite any
        row and hit Save to write straight to{' '}
        <code>public/data/uniform-names.json</code> while{' '}
        <code>npm run dev</code> is running — no effect otherwise.
      </p>
      <div className="uniformnames__actions">
        <button className="btn" onClick={handleSave} disabled={status === 'saving'}>
          Save
        </button>
        {status === 'saved' && <span className="hint">Saved.</span>}
        {status === 'error' && (
          <span className="hint hint--error">Save failed — is `npm run dev` running?</span>
        )}
      </div>
      <div className="colorlab__layout">
        <nav className="colorlab__nav" aria-label="Jump to team">
          {teams.map((id) => (
            <a key={id} className="colorlab__navlink" href={`#${teamAnchorId(id)}`} title={teamFullName(id)}>
              <TeamLogo teamId={id} name={teamFullName(id)} size={28} />
            </a>
          ))}
        </nav>
        <div className="uniformnames">
          {teams.map((id) => (
            <TeamUniforms
              key={id}
              teamId={id}
              assets={catalog[id]}
              savedOverrides={savedOverrides}
              edits={edits}
              onChange={handleChange}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TeamUniforms({ teamId, assets, savedOverrides, edits, onChange }) {
  if (!assets?.length) return null
  const clubName = teamClubName(teamId)
  const jerseys = assets.filter((a) => a.piece === 'J')
  if (!jerseys.length) return null

  return (
    <section className="colorlab__row" id={teamAnchorId(teamId)}>
      <h2 className="colorlab__teamname">{teamFullName(teamId)}</h2>
      {jerseys.map((asset) => {
        const defaultName = uniformDisplayName(asset.text, clubName, asset.code, savedOverrides)
        const value = (asset.code ? edits[asset.code] : undefined) ?? defaultName
        return (
          <div className="uniformnames__row" key={asset.code ?? asset.text}>
            <span className="uniformnames__label">{jerseyLabel(asset.text, clubName)}</span>
            <span className="uniformnames__arrow" aria-hidden="true">
              →
            </span>
            <input
              className="searchbox__input uniformnames__input"
              value={value}
              disabled={!asset.code}
              onChange={(e) => onChange(asset.code, e.target.value)}
            />
          </div>
        )
      })}
    </section>
  )
}
