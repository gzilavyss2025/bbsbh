import { LEVELS } from '../../lib/teams.js'

// The MLB/AAA/AA/A+/A level toggle, shared by the slate and the logo sheet.
// Plain toggle buttons with aria-pressed — not a tablist, which would promise
// arrow-key/roving-tabindex semantics none of these screens implement.
//
// `levels` is HANDED IN rather than imported, because the rail is no longer a
// constant. From October to February it carries a sixth entry — WINTER, second,
// right after MLB — and the rest of the year it does not (issue #1055). The
// default keeps every caller that has no opinion on the winter (the logo sheet)
// exactly as it was. A level may carry a `leagueId`, which is how the one tab
// covering four leagues says which of them it means; `onChange` is handed both.
export function LevelNav({ sportId, onChange, levels = LEVELS }) {
  return (
    // `levelnav--six` is the WINTER months' rail. It is a hook for the topbar,
    // which has room for five cells beside the wordmark on a narrow phone and
    // not for six — see .topbar--slate:has(.levelnav--six) in
    // styles/03-slate-header.css.
    <div
      className={`levelnav${levels.length > 5 ? ' levelnav--six' : ''}`}
      aria-label="Level"
    >
      {levels.map((lvl) => {
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
