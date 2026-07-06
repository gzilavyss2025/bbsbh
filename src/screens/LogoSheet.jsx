import { useState } from 'react'
import { fetchTeams } from '../api/mlb.js'
import { useAsync } from '../hooks/useAsync.js'
import { PINNED_TEAM_ID, SPORT_IDS } from '../lib/teams.js'
import { TeamLogo } from '../components/TeamLogo.jsx'
import { LogoModal } from '../components/LogoModal.jsx'

// Level toggle order, same as the game selector.
const LEVELS = [
  { label: 'MLB', sportId: SPORT_IDS.MLB },
  { label: 'AAA', sportId: SPORT_IDS.AAA },
  { label: 'AA', sportId: SPORT_IDS.AA },
  { label: 'A+', sportId: SPORT_IDS['A+'] },
  { label: 'A', sportId: SPORT_IDS.A },
]

// A browsable reference sheet of every club's logo at a level, independent of
// any day's schedule. Tapping a tile opens the same sketch modal used
// elsewhere in the app, with its 3-way variant picker. Carries no scores, so
// it's spoiler-safe like the rest of the app.
export function LogoSheet({ onBack }) {
  const [sportId, setSportId] = useState(SPORT_IDS.MLB)
  const [sketching, setSketching] = useState(null) // { id, name } | null

  const teamsState = useAsync(() => fetchTeams(sportId), [sportId])
  const teams = sortTeams(teamsState.data ?? [])

  return (
    <div className="screen">
      <header className="topbar">
        <button className="topbar__back" onClick={onBack}>
          ‹ Games
        </button>
        <h1 className="topbar__title">Logo sheet</h1>
      </header>

      <div className="levelnav" role="tablist" aria-label="Level">
        {LEVELS.map((lvl) => (
          <button
            key={lvl.sportId}
            type="button"
            role="tab"
            aria-selected={sportId === lvl.sportId}
            className={`levelnav__btn ${sportId === lvl.sportId ? 'is-active' : ''}`}
            onClick={() => setSportId(lvl.sportId)}
          >
            {lvl.label}
          </button>
        ))}
      </div>

      {teamsState.loading && <p className="hint">Loading logos…</p>}
      {teamsState.error && (
        <p className="hint hint--error">
          Couldn’t load teams. Check your connection and try again.
        </p>
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
