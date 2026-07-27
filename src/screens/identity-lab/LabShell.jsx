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
    <div className="screen">
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

// The pinned jump-link sidebar plus the team list beside it. One layout for
// both colour dimensions — MLB's 30 clubs and a MiLB level's ~30 affiliates
// render the same way.
export function TeamLabList({ teams, children }) {
  return (
    <div className="colorlab__layout">
      <nav className="colorlab__nav" aria-label="Jump to team">
        {teams.map((t) => (
          <a key={t.id} className="colorlab__navlink" href={`#${teamAnchorId(t.id)}`} title={t.name}>
            <TeamLogo teamId={t.id} name={t.name} size={28} />
          </a>
        ))}
      </nav>
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
