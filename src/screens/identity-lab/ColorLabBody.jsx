import { useEffect, useState } from 'react'
import { AllChangesButton, TeamLabList } from './LabShell.jsx'
import { TeamLabRow } from './TeamLabRow.jsx'
import { useDraftStore } from './useDraftStore.js'
import { useTeamDraftStore } from './useTeamDraftStore.js'
import { useAutoClearLandedDrafts } from './useAutoClearLandedDrafts.js'
import { saveStores } from './saveStores.js'

// MiLB's profile has no team-level colors dimension (only MLB's Main triad
// does) — a no-op matcher so the auto-clear sweep never crashes reaching for a
// `matchesLanded.colors` a profile doesn't define; it's never called for real
// since nothing writes into the colors draft for a profile that doesn't wire
// `on.colorField` in the first place.
const NEVER_LANDED = () => false

// The body both colour dimensions share — MLB's treatment catalog and a MiLB
// level's Home/Away pair. It owns the plumbing that was duplicated between the
// two lab screens: which teams to list, the three draft stores, the collapsed
// state, the auto-clear sweep, the "copy all changes" button, and Save.
//
// Everything genuinely per-dimension is on the `profile` descriptor
// (profiles/mlb.jsx, profiles/milb.jsx): the treatment set, how a tile resolves
// its colours, what a copy snippet says, and which stores a Save writes.
// Deliberately NOT unified — MLB resolves a three-swatch triad against a jersey
// catalog, MiLB swaps one researched pair; forcing parity there would mean
// inventing data one of them doesn't have.
//
// Mounted with `key={profile.key}` by IdentityLab, so switching dimension
// remounts rather than reusing another dimension's fetches and draft handles —
// the same fresh start the five separate routes used to give.
export function ColorLabBody({ profile }) {
  const teams = profile.useTeams()
  const extras = profile.useExtras()

  const [collapsed, setCollapsed] = useState(() => loadCollapsed(profile.storeKey('collapsed')))
  const [posDraft, setPosField, resetPosDraft] = useDraftStore(profile.storeKey('logopos'))
  const [wpaDraft, setWpaField, resetWpaDraft] = useDraftStore(profile.storeKey('wpa'))
  const [headerDraft, setHeaderField, resetHeaderDraft] = useDraftStore(profile.storeKey('headercolors'))
  const [colorsDraft, setColorField, resetColorsDraft] = useTeamDraftStore(profile.storeKey('colors'))
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'saved' | 'error' | null

  useAutoClearLandedDrafts([
    { draft: posDraft, reset: resetPosDraft, matchesLanded: profile.matchesLanded.pos },
    { draft: wpaDraft, reset: resetWpaDraft, matchesLanded: profile.matchesLanded.wpa },
    { draft: headerDraft, reset: resetHeaderDraft, matchesLanded: profile.matchesLanded.header },
    {
      draft: colorsDraft,
      reset: resetColorsDraft,
      matchesLanded: profile.matchesLanded.colors ?? NEVER_LANDED,
      teamScoped: true,
    },
  ])

  const collapsedKey = profile.storeKey('collapsed')
  useEffect(() => {
    localStorage.setItem(collapsedKey, JSON.stringify(collapsed))
  }, [collapsedKey, collapsed])

  const toggleCollapsed = (teamId) =>
    setCollapsed((was) => ({ ...was, [teamId]: was[teamId] === false ? true : false }))

  const drafts = { pos: posDraft, wpa: wpaDraft, header: headerDraft, colors: colorsDraft }

  // Save lands every pending draft in the JSON stores on disk (ADR-0029) —
  // the same files this module's resolvers read, so the tiles re-render off the
  // landed value and useAutoClearLandedDrafts then drops the now-redundant
  // drafts on Vite's hot reload. Only fields the stores actually own are
  // written; a flat background hex for a non-Main MLB treatment still belongs
  // to the colour tables (ALT_COLORS and friends), still JS literals, so its
  // copy snippet remains the way to land it.
  async function handleSave() {
    setSaveStatus('saving')
    const payloads = profile.buildSaves(drafts, extras)
    const ok = await saveStores(payloads)
    if (ok) extras.afterSave(payloads)
    setSaveStatus(ok ? 'saved' : 'error')
  }

  if (teams === null) return <p className="hint">Loading affiliate list…</p>

  return (
    <>
      <div className="uniformnames__actions">
        <button className="btn" onClick={handleSave} disabled={saveStatus === 'saving'}>
          Save
        </button>
        {saveStatus === 'saved' && <span className="hint">Saved.</span>}
        {/* The colour/tuning stores landed, but the jersey-name edits didn't:
            the current names never loaded, so writing them would erase every
            other name on file (src/api/uniforms.js's uniformNamesSaveBody).
            Said out loud, because a flat "Saved." next to a name edit that
            silently vanished is the same lie in a smaller costume. */}
        {saveStatus === 'saved' && extras.blockedNameEdits && (
          <span className="hint hint--error">
            Jersey names not saved — the current names never loaded. Reload the page.
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="hint hint--error">Save failed — is `npm run dev` running?</span>
        )}
      </div>

      {profile.sidebar}

      <AllChangesButton text={profile.buildAllChangesText(teams, drafts, extras)} />

      <TeamLabList teams={teams}>
        {(team) => (
          <TeamLabRow
            key={team.id}
            teamId={team.id}
            name={team.name}
            sportId={profile.sportId}
            badge={profile.rowBadge?.(team.id)}
            collapsed={collapsed[team.id] !== false}
            onToggleCollapsed={() => toggleCollapsed(team.id)}
          >
            {(lastOpponent) => (
              <profile.Tiles
                team={team}
                lastOpponent={lastOpponent}
                extras={extras}
                drafts={{
                  pos: posDraft[team.id],
                  wpa: wpaDraft[team.id],
                  header: headerDraft[team.id],
                  colors: colorsDraft[team.id],
                }}
                on={{
                  posField: (treatment, field, value) => setPosField(team.id, treatment, field, value),
                  posReset: (treatment) => resetPosDraft(team.id, treatment),
                  wpaField: (treatment, field, value) => setWpaField(team.id, treatment, field, value),
                  wpaReset: (treatment) => resetWpaDraft(team.id, treatment),
                  headerField: (treatment, field, value) => setHeaderField(team.id, treatment, field, value),
                  headerReset: (treatment) => resetHeaderDraft(team.id, treatment),
                  colorField: (field, value) => setColorField(team.id, field, value),
                  colorReset: () => resetColorsDraft(team.id),
                }}
              />
            )}
          </TeamLabRow>
        )}
      </TeamLabList>
    </>
  )
}

// `{ [teamId]: false }` marks a team explicitly EXPANDED; every other team (no
// entry, or `true`) renders collapsed. A fresh visit (empty localStorage) starts
// every row collapsed rather than firing every club's lazy lastOpponent fetch
// and rendering a few hundred real WinProbChart mockups at once.
function loadCollapsed(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}')
  } catch {
    return {}
  }
}
