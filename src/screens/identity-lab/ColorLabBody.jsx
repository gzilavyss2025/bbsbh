import { useEffect, useState } from 'react'
import { fetchLastOpponent } from '../../api/schedule.js'
import { ClubRail } from './ClubRail.jsx'
import { DugoutRail } from './DugoutRail.jsx'
import { ClubWorkbench } from './workbench/ClubWorkbench.jsx'
import { teamAnchorId } from './teamAnchorId.js'
import { useDraftStore } from './useDraftStore.js'
import { useTeamDraftStore } from './useTeamDraftStore.js'
import { useAutoClearLandedDrafts } from './useAutoClearLandedDrafts.js'
import { saveStores } from './saveStores.js'

// MiLB's profile has no team-level colors dimension (only MLB's Main triad
// does) and no per-treatment Colors panel either (only MLB has one) — a no-op
// matcher so the auto-clear sweep never crashes reaching for a
// `matchesLanded.colors`/`matchesLanded.treatmentColors` a profile doesn't
// define; it's never called for real since nothing writes into either draft
// for a profile that doesn't wire `on.colorField`/`on.tcolorField` in the
// first place.
const NEVER_LANDED = () => false

// The body both colour dimensions share — MLB's treatment catalog and a MiLB
// level's Home/Away pair. It owns the plumbing that was duplicated between the
// two lab screens: which teams to list, the draft stores, the auto-clear sweep,
// the pending count, and Save.
//
// Master–detail, not a 30-club accordion: exactly one club is on the workbench,
// the rest wait on the rail. That's what makes the lazy `lastOpponent` fetch
// cheap (one club at a time, cached per club id so stepping back is free) and
// what lets the workbench pin a live preview column beside the controls.
//
// Everything genuinely per-dimension is on the `profile` descriptor
// (profiles/mlb.jsx, profiles/milb.jsx): the jersey set, how a bench resolves
// its colours, what a copy snippet says, and which stores a Save writes.
// Deliberately NOT unified — MLB resolves a three-swatch triad against a jersey
// catalog, MiLB swaps one researched pair; forcing parity there would mean
// inventing data one of them doesn't have.
//
// Mounted with `key={profile.key}` by IdentityLab, so switching dimension
// remounts rather than reusing another dimension's fetches and draft handles.
export function ColorLabBody({ profile }) {
  const teams = profile.useTeams()
  const extras = profile.useExtras()

  const [posDraft, setPosField, resetPosDraft] = useDraftStore(profile.storeKey('logopos'))
  const [wpaDraft, setWpaField, resetWpaDraft] = useDraftStore(profile.storeKey('wpa'))
  const [headerDraft, setHeaderField, resetHeaderDraft] = useDraftStore(profile.storeKey('headercolors'))
  const [colorsDraft, setColorField, resetColorsDraft] = useTeamDraftStore(profile.storeKey('colors'))
  const [tcolorsDraft, setTcolorField, resetTcolorsDraft] = useDraftStore(profile.storeKey('treatmentcolors'))
  const [offDayDraft, setOffDayField, resetOffDayDraft] = useTeamDraftStore(profile.storeKey('offday'))
  const [saveStatus, setSaveStatus] = useState(null) // 'saving' | 'saved' | 'error' | null
  const [selectedId, setSelectedId] = useState(() => loadSelectedClub(profile.storeKey('club')))
  const [opponents, setOpponents] = useState({}) // teamId -> opponent | null

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
    {
      draft: tcolorsDraft,
      reset: resetTcolorsDraft,
      matchesLanded: profile.matchesLanded.treatmentColors ?? NEVER_LANDED,
    },
    {
      draft: offDayDraft,
      reset: resetOffDayDraft,
      matchesLanded: profile.matchesLanded.offDay ?? NEVER_LANDED,
      teamScoped: true,
    },
  ])

  const clubKey = profile.storeKey('club')
  const team = teams?.find((t) => t.id === selectedId) ?? teams?.[0] ?? null
  const teamId = team?.id

  useEffect(() => {
    if (teamId === undefined) return
    localStorage.setItem(clubKey, String(teamId))
    // The old per-club anchors still work as deep links: selecting a club
    // writes its `#team-{id}` without pushing a history entry, so Back still
    // leaves the lab instead of walking back through thirty selections.
    history.replaceState(null, '', `#${teamAnchorId(teamId)}`)
  }, [clubKey, teamId])

  // One club's most recent opponent, fetched when that club reaches the bench
  // and kept for the session — the away band in the WPA scenario mockups. There
  // is no multi-team schedule endpoint to batch this over, which is why it was
  // never fetched for all thirty up front.
  useEffect(() => {
    if (teamId === undefined || opponents[teamId] !== undefined) return
    let cancelled = false
    fetchLastOpponent(teamId, new Date().getFullYear(), profile.sportId).then((opp) => {
      if (!cancelled) setOpponents((was) => ({ ...was, [teamId]: opp ?? null }))
    })
    return () => {
      cancelled = true
    }
  }, [teamId, profile.sportId, opponents])

  // Arrow keys step clubs, but only when the focus isn't somewhere a left/right
  // arrow already means "move the caret".
  useEffect(() => {
    if (!teams?.length) return
    const onKey = (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const index = teams.findIndex((t) => t.id === teamId)
      const step = event.key === 'ArrowRight' ? 1 : -1
      setSelectedId(teams[(index + step + teams.length) % teams.length].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [teams, teamId])

  const drafts = {
    pos: posDraft,
    wpa: wpaDraft,
    header: headerDraft,
    colors: colorsDraft,
    tcolors: tcolorsDraft,
    offday: offDayDraft,
  }

  // Save lands every pending draft in the JSON stores on disk (ADR-0029) —
  // the same files this module's resolvers read, so the bench re-renders off the
  // landed value and useAutoClearLandedDrafts then drops the now-redundant
  // drafts on Vite's hot reload. Only fields the stores actually own are
  // written.
  async function handleSave() {
    setSaveStatus('saving')
    const payloads = profile.buildSaves(drafts, extras)
    const ok = await saveStores(payloads)
    if (ok) extras.afterSave(payloads)
    setSaveStatus(ok ? 'saved' : 'error')
  }

  if (teams === null) return <p className="hint">Loading affiliate list…</p>
  if (!team) return <p className="hint">No clubs to review.</p>

  // The colour/tuning stores landed, but the jersey-name edits didn't: the
  // current names never loaded, so writing them would erase every other name
  // on file (src/api/uniforms.js's uniformNamesSaveBody). Said out loud,
  // because a flat "Saved." next to a name edit that silently vanished is the
  // same lie in a smaller costume.
  const blockedNameEditsNotice = saveStatus === 'saved' && extras.blockedNameEdits && (
    <span className="hint hint--error idlab__savemsg">
      Jersey names not saved — the current names never loaded. Reload the page.
    </span>
  )

  const index = teams.findIndex((t) => t.id === team.id)
  const prev = teams[(index - 1 + teams.length) % teams.length]
  const next = teams[(index + 1) % teams.length]

  return (
    <>
      {profile.sidebar}

      <ClubRail
        teams={teams}
        selectedId={team.id}
        onSelect={setSelectedId}
        pendingIds={pendingClubIds(teams, drafts)}
      />

      <ClubWorkbench
        key={team.id}
        profile={profile}
        team={team}
        prev={prev}
        next={next}
        onStepTeam={setSelectedId}
        extras={extras}
        lastOpponent={opponents[team.id]}
        drafts={{
          pos: posDraft[team.id],
          wpa: wpaDraft[team.id],
          header: headerDraft[team.id],
          colors: colorsDraft[team.id],
          tcolors: tcolorsDraft[team.id],
          offday: offDayDraft[team.id],
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
          tcolorField: (treatment, role, value) => setTcolorField(team.id, treatment, role, value),
          tcolorReset: (treatment) => resetTcolorsDraft(team.id, treatment),
          offDayField: (value) => setOffDayField(team.id, 'treatment', value),
          offDayReset: () => resetOffDayDraft(team.id),
        }}
      />

      <DugoutRail
        changesText={profile.buildAllChangesText(teams, drafts, extras)}
        onSave={handleSave}
        saveStatus={saveStatus}
        blockedNameEdits={blockedNameEditsNotice}
      />
    </>
  )
}

// Which club was last on the bench. A URL hash wins over the stored one, so an
// old `#identity-lab-team-158` deep link still opens the club it names.
function loadSelectedClub(key) {
  const fromHash = Number(location.hash.match(/team-(\d+)$/)?.[1])
  if (fromHash) return fromHash
  const saved = Number(localStorage.getItem(key))
  return saved || null
}

// Every club carrying an unsaved edit in ANY store — the rail's dots. Read off
// the same draft objects the pending tally counts, so a dot and a tally mark
// can't disagree about whether something is outstanding.
function pendingClubIds(teams, drafts) {
  const ids = new Set()
  for (const team of teams) {
    const perTreatment = ['pos', 'wpa', 'header', 'tcolors'].some((store) =>
      Object.values(drafts[store][team.id] ?? {}).some((fields) => Object.keys(fields ?? {}).length > 0),
    )
    if (
      perTreatment ||
      Object.keys(drafts.colors[team.id] ?? {}).length > 0 ||
      Object.keys(drafts.offday[team.id] ?? {}).length > 0
    )
      ids.add(team.id)
  }
  return ids
}
