import { LEVELS } from '../lib/teams.js'

// The MLB/AAA/AA/A+/A level toggle, shared by the slate and the logo sheet.
// Plain toggle buttons with aria-pressed — not a tablist, which would promise
// arrow-key/roving-tabindex semantics none of these screens implement.
export function LevelNav({ sportId, onChange }) {
  return (
    <div className="levelnav" aria-label="Level">
      {LEVELS.map((lvl) => (
        <button
          key={lvl.sportId}
          type="button"
          aria-pressed={sportId === lvl.sportId}
          className={`levelnav__btn ${sportId === lvl.sportId ? 'is-active' : ''}`}
          onClick={() => onChange(lvl.sportId)}
        >
          {lvl.label}
        </button>
      ))}
    </div>
  )
}
