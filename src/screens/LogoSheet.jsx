import { useState } from 'react'
import { fetchTeams } from '../api/mlb.js'
import { useAsync } from '../hooks/useAsync.js'
import { useDocumentTitle } from '../hooks/useDocumentTitle.js'
import { PINNED_TEAM_ID, SPORT_IDS } from '../lib/teams.js'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { LogoModal } from '../components/LogoModal.jsx'
import { LevelNav } from '../components/LevelNav.jsx'
import { SiteHeader } from '../components/SiteHeader.jsx'

// A browsable reference sheet of every club's logo at a level, independent of
// any day's schedule. Tapping a tile opens the same sketch modal used
// elsewhere in the app, with its 3-way variant picker. Carries no scores, so
// it's spoiler-safe like the rest of the app.
export function LogoSheet({ onBack }) {
  useDocumentTitle('Logo Sheet')
  const [sportId, setSportId] = useState(SPORT_IDS.MLB)
  const [sketching, setSketching] = useState(null) // { id, name } | null

  const teamsState = useAsync(() => fetchTeams(sportId), [sportId])
  const teams = sortTeams(teamsState.data ?? [])

  return (
    <div className="screen">
      <SiteHeader />
      <header className="topbar">
        <button className="topbar__back" onClick={onBack}>
          ‹ Games
        </button>
        <h1 className="topbar__title">Logo sheet</h1>
      </header>

      <LevelNav sportId={sportId} onChange={setSportId} />

      {teamsState.loading && <p className="hint">Loading logos…</p>}
      {teamsState.error && (
        <>
          <p className="hint hint--error" role="status">
            Couldn’t load teams. Check your connection and try again.
          </p>
          <button className="btn" onClick={teamsState.reload}>
            Retry
          </button>
        </>
      )}
      {!teamsState.loading && !teamsState.error && teams.length === 0 && (
        <p className="hint">No teams found.</p>
      )}

      <ul className="logogrid">
        {teams.map((t) => (
          <li key={t.id} className="logotile">
            <button
              type="button"
              className="logotile__btn"
              onClick={() => setSketching(t)}
              aria-label={`Enlarge ${t.name} logo for sketching`}
            >
              <TeamLogo
                teamId={t.id}
                name={t.name}
                size={96}
                className="logotile__img"
              />
            </button>
            <span className="logotile__name">{t.name}</span>
          </li>
        ))}
      </ul>

      {sketching && (
        <LogoModal
          teamId={sketching.id}
          name={sketching.name}
          onClose={() => setSketching(null)}
        />
      )}
    </div>
  )
}

// Pinned club first, then alphabetical.
function sortTeams(teams) {
  return [...teams].sort((a, b) => {
    const pa = a.id === PINNED_TEAM_ID ? 0 : 1
    const pb = b.id === PINNED_TEAM_ID ? 0 : 1
    if (pa !== pb) return pa - pb
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}
