import { useState } from 'react'
import { resolveGameNotes } from '../api/gameNotes.js'
import { hasWhatsBrewing, whatsBrewingTitle } from '../api/whatsBrewingClubs.js'
import { whatsBrewingLayout } from '../api/whatsBrewing.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { ALL_MLB_TEAM_IDS, teamFullName } from '../lib/teams.js'
import { SiteHeader } from '../components/SiteHeader.jsx'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { AsyncStatus } from '../components/AsyncGate.jsx'
import { WhatsBrewingModal } from '../components/WhatsBrewingModal.jsx'

// Unlisted QA page — linked from nowhere (see route.js), reachable only by
// direct URL (/game-notes-debug). One row per MLB club: whether its Game
// Notes PDF is calibrated for the in-app What's Brewing modal (and which
// layout), plus a shortcut straight to that modal for its most recent note,
// so calibration work can be scanned/spot-checked club by club without
// digging up a live game for each one. No scores anywhere on this page.
export function GameNotesDebugPage() {
  useDocumentTitle('Game Notes debug')
  const [openTeamId, setOpenTeamId] = useState(null)

  const teams = ALL_MLB_TEAM_IDS.map((id) => ({
    id,
    name: teamFullName(id),
    calibrated: hasWhatsBrewing(id),
    layout: whatsBrewingLayout(id),
  })).sort((a, b) => {
    if (a.calibrated !== b.calibrated) return a.calibrated ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  // One most-recent-note lookup per club, all in flight together — this page
  // is a QA tool, not a live game surface, so a single up-front fetch (rather
  // than 30 independent per-row loaders) keeps the table simple to scan.
  const notesState = useAsync(
    () =>
      Promise.all(teams.map((t) => resolveGameNotes(t.id).then((notes) => [t.id, notes]))).then(
        Object.fromEntries,
      ),
    [],
  )
  const notesById = notesState.data ?? {}
  const openNotes = openTeamId ? notesById[openTeamId] : null

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">Game Notes debug</h1>
      </header>
      <p className="hint hint--prose">
        Every MLB club, whether its pre-game Game Notes PDF is calibrated for the in-app modal
        (and which parser layout), and a shortcut to open its most recent note. Unlisted — not
        linked from anywhere else in the app.
      </p>

      <AsyncStatus
        loading={notesState.loading}
        error={notesState.error}
        hasData={Object.keys(notesById).length > 0}
        errorMessage="Couldn’t load game notes. Try again."
        onRetry={notesState.reload}
      />

      {!notesState.loading && Object.keys(notesById).length > 0 && (
        <div className="ledger-wrap">
          <table className="standings">
            <thead>
              <tr>
                <th className="team">Team</th>
                <th>Layout</th>
                <th>Note date</th>
                <th>Modal</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => {
                const notes = notesById[t.id]
                return (
                  <tr key={t.id}>
                    <td className="team">
                      <TeamLogo teamId={t.id} name={t.name} size={22} />
                      {t.name}
                    </td>
                    <td>{t.calibrated ? t.layout || '—' : 'not calibrated'}</td>
                    <td>{notes?.date ?? '—'}</td>
                    <td>
                      {notes?.url ? (
                        <button
                          type="button"
                          className="btn btn--ghost"
                          onClick={() => setOpenTeamId(t.id)}
                        >
                          Open ›
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {openTeamId && openNotes && (
        <WhatsBrewingModal
          notes={openNotes}
          teamId={openTeamId}
          title={whatsBrewingTitle(openTeamId) || teamFullName(openTeamId)}
          onClose={() => setOpenTeamId(null)}
        />
      )}
    </div>
  )
}
