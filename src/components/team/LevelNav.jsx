import { LEVELS } from '../../lib/teams.js'

// The MLB/AAA/AA/A+/A level toggle, shared by the slate and the logo sheet.
// Plain toggle buttons with aria-pressed — not a tablist, which would promise
// arrow-key/roving-tabindex semantics none of these screens implement.
//
// A level may carry a `leagueId`, which is how the one tab covering four leagues says
// which of them it means; `onChange` is handed both.
export function LevelNav({ sportId, onChange }) {
  return (
    <div className="levelnav" aria-label="Level">
      {LEVELS.map((lvl) => {
        const active = sportId === lvl.sportId
        return (
          <button
            key={lvl.sportId}
            type="button"
            aria-pressed={active}
            className={`levelnav__btn ${active ? 'is-active' : ''}`}
            onClick={() => onChange(lvl.sportId, lvl.leagueId ?? null)}
          >
            {lvl.label}
          </button>
        )
      })}
    </div>
  )
}
