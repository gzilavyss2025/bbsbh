import { SiteHeader } from '../../components/SiteHeader.jsx'
import { TeamLogo } from '../../components/TeamLogo.jsx'
import { CopyIconButton } from '../../components/CopyBox.jsx'
import { teamAnchorId } from './teamAnchorId.js'

// The chrome every dimension of the lab shares: site bar, title, hint, and the
// dimension/level nav that replaced five separate unlisted routes with one
// (/identity-lab). The nav reuses .patternlab__filters, which the MiLB screen
// already used for exactly this job.
export function LabShell({ title, hint, profiles, activeKey, onPick, children }) {
  return (
    <div className="screen screen--identitylab">
      <SiteHeader />
      <header className="topbar">
        <h1 className="topbar__title">{title}</h1>
      </header>
      <p className="hint">{hint}</p>

      <nav className="patternlab__filters" aria-label="Switch lab dimension">
        {profiles.map((p) => (
          <button
            key={p.key}
            type="button"
            className={`patternlab__filterbtn${p.key === activeKey ? ' is-active' : ''}`}
            aria-current={p.key === activeKey ? 'page' : undefined}
            onClick={() => onPick(p.key)}
          >
            {p.label}
          </button>
        ))}
      </nav>

      {children}
    </div>
  )
}

// The pinned jump-link sidebar of team logos, `#${teamAnchorId(id)}` each —
// shared by every dimension that lists all 30-ish clubs down a long page
// (the two colour dimensions' `TeamLabList` below, and the Jersey Audit
// table). Fixed-position via `.colorlab__nav` (LabShell.jsx doc above), so it
// needs no layout wrapper of its own; a caller just renders it anywhere.
//
// `save`, when given (the two colour dimensions only — the audit table is
// read-only), pins the Save button to the top of this same fixed card rather
// than the page's scrolling top-of-page flow, so it's reachable next to the
// logos without scrolling back up: `{ onSave, status, extra }`, `status` one
// of `'saving' | 'saved' | 'error' | null`, `extra` an optional extra status
// node (e.g. ColorLabBody's "jersey names not saved" caveat).
export function TeamJumpNav({ teams, save }) {
  return (
    <nav className="colorlab__nav" aria-label="Jump to team">
      {save && (
        <div className="colorlab__navsave">
          <button className="btn colorlab__navsavebtn" onClick={save.onSave} disabled={save.status === 'saving'}>
            Save
          </button>
          {save.status === 'saved' && <span className="hint colorlab__navsavemsg">Saved.</span>}
          {save.status === 'error' && (
            <span className="hint hint--error colorlab__navsavemsg">
              Save failed — is `npm run dev` running?
            </span>
          )}
          {save.extra}
        </div>
      )}
      <div className="colorlab__navlogos">
        {teams.map((t) => (
          <a key={t.id} className="colorlab__navlink" href={`#${teamAnchorId(t.id)}`} title={t.name}>
            <TeamLogo teamId={t.id} name={t.name} size={28} />
          </a>
        ))}
      </div>
    </nav>
  )
}

// The pinned jump-link sidebar plus the team list beside it. One layout for
// both colour dimensions — MLB's 30 clubs and a MiLB level's ~30 affiliates
// render the same way.
export function TeamLabList({ teams, save, children }) {
  return (
    <div className="colorlab__layout">
      <TeamJumpNav teams={teams} save={save} />
      <div className="colorlab">{teams.map(children)}</div>
    </div>
  )
}

// Sits above the team list, always visible regardless of scroll position, so
// it's reachable right after a session of poking at several teams' controls
// without hunting back up the page. Counts sections instead of teams (a team
// with both a Main position tweak and an Alternate band-color tweak counts as
// 2) so the number tracks the copy text's own output 1:1 — pasting the copy and
// counting blank-line-separated blocks should always match what this reported.
export function AllChangesButton({ text }) {
  const count = text ? text.split('\n\n').length : 0
  if (count === 0) return null
  return (
    <div className="colorlab__allchanges">
      <CopyIconButton text={text} label={`Copy all ${count} pending change(s) across every team`} />
      <span className="colorlab__allchanges__text">
        Copy all {count} pending change{count === 1 ? '' : 's'}
      </span>
    </div>
  )
}
