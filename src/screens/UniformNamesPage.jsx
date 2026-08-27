import '../styles/15-team-color-lab.css'
import { useEffect, useMemo, useState } from 'react'
import { SiteHeader } from '../components/chrome/SiteHeader.jsx'
import { TeamLogo } from '../components/logo/TeamLogo.jsx'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { teamAnchorId } from './identity-lab/teamAnchorId.js'
import { ALL_MLB_TEAM_IDS, teamFullName, teamClubName } from '../lib/teams.js'
import {
  fetchTeamUniformCatalog,
  fetchUniformNameOverrides,
  primeUniformNameOverridesCache,
  uniformNameOverridesLoaded,
  uniformNamesSaveBody,
  uniformDisplayName,
  jerseyLabel,
} from '../api/uniforms.js'

const SAVE_URL = '/__dev/uniform-names'

// This page's own anchor scope. The lab and this page both list all 30 clubs,
// so they must not mint the same DOM ids — hence the scope argument rather than
// the three near-identical local copies this used to be one of.
const ANCHOR_SCOPE = 'uniformnames'

// Dev-only curation page (App.jsx gates the import to import.meta.env.DEV —
// see there for why) for authoring the exact wording a scorer sees for every
// current MLB club's jersey (Team Identity Lab, eventually a record-by-jersey
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
// for why this is the one place that writes back to disk this way.
export function UniformNamesPage() {
  useDocumentTitle('Uniform Names')
  const teams = useMemo(
    () => [...ALL_MLB_TEAM_IDS].sort((a, b) => teamFullName(a).localeCompare(teamFullName(b))),
    [],
  )
  const [catalog, setCatalog] = useState({})
  const [savedOverrides, setSavedOverrides] = useState({})
  const [namesLoaded, setNamesLoaded] = useState(false)
  const [edits, setEdits] = useState({}) // code -> in-progress full name text
  const [status, setStatus] = useState(null) // 'saving' | 'saved' | 'error' | 'nothing' | null

  // Deliberately NOT one Promise.all over both fetches. The catalog comes from
  // statsapi and the names from a same-origin static file, so a statsapi outage
  // used to reject the combined promise and leave `savedOverrides` at its
  // initial `{}` for the whole session — which Save then wrote straight over
  // the real file. They're independent facts; they load independently, and a
  // failure in either degrades only its own half.
  useEffect(() => {
    let cancelled = false
    fetchTeamUniformCatalog(ALL_MLB_TEAM_IDS, new Date().getFullYear())
      .then((catalogData) => !cancelled && setCatalog(catalogData))
      .catch(() => {}) // no catalog means no rows to edit, not a broken page
    fetchUniformNameOverrides().then((overrides) => {
      if (cancelled) return
      setSavedOverrides(overrides)
      setNamesLoaded(uniformNameOverridesLoaded())
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
    // Merge this session's edits over the last-saved map so an untouched row's
    // already-curated name (from an earlier save) survives — the middleware
    // always overwrites the whole file, so a partial `edits` object here would
    // silently drop every other row's name. `null` means there is nothing safe
    // or useful to write: either this page never managed to READ the file (in
    // which case its empty state is ignorance, not content) or nothing was
    // edited. See uniformNamesSaveBody.
    const merged = uniformNamesSaveBody(savedOverrides, edits, { loaded: namesLoaded })
    if (!merged) {
      setStatus('nothing')
      return
    }
    setStatus('saving')
    try {
      const res = await fetch(SAVE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
      // Keep src/api/uniforms.js's module-level cache in step so any other
      // consumer that calls fetchUniformNameOverrides() later this same
      // session sees the save immediately, not the pre-save snapshot it
      // cached on first load.
      primeUniformNameOverridesCache(merged)
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
        {/* Nothing was written, on purpose — either no row changed, or this
            page never read uniform-names.json and would have overwritten it
            with its own empty state. Saying so beats a silent no-op or, worse,
            a cheerful "Saved." over a file that just lost every name. */}
        {status === 'nothing' && (
          <span className="hint">
            {namesLoaded
              ? 'Nothing to save — no name changed.'
              : 'Not saved — the current names never loaded, so saving would erase them. Reload the page.'}
          </span>
        )}
        {status === 'error' && (
          <span className="hint hint--error">Save failed — is `npm run dev` running?</span>
        )}
      </div>
      <div className="colorlab__layout">
        <nav className="colorlab__nav" aria-label="Jump to team">
          {teams.map((id) => (
            <a key={id} className="colorlab__navlink" href={`#${teamAnchorId(id, ANCHOR_SCOPE)}`} title={teamFullName(id)}>
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
    <section className="colorlab__row" id={teamAnchorId(teamId, ANCHOR_SCOPE)}>
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
