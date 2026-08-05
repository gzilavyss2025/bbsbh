import { TeamLogo } from '../../components/identity/TeamLogo.jsx'
import { teamAnchorId } from './teamAnchorId.js'

// The thirty clubs, always to hand, down the left edge. For the colour
// dimensions it's the master half of a master–detail: one click pulls that
// club's drawer out onto the workbench, and the club you're on wears a ring and
// a notch bridging into it. For the Jersey Audit — a full-list table by design,
// with nothing to select — the same rail stays a list of jump links into the
// rows, which is what its sidebar always was.
//
// The `--marker` dot is the session's memory: any club carrying an unsaved
// draft in any store wears one, so "which clubs have I touched" is answerable
// from anywhere on the page rather than by scrolling for reset buttons. It goes
// out on its own when the drafts auto-clear after a Save.
export function ClubRail({ teams, selectedId, onSelect, pendingIds }) {
  return (
    <nav className="idlab__rail" aria-label={onSelect ? 'Pick a club' : 'Jump to club'}>
      {teams.map((team) => {
        const pending = pendingIds?.has(team.id)
        const selected = team.id === selectedId
        const inner = (
          <>
            <TeamLogo teamId={team.id} name={team.name} size={36} />
            {pending && <span className="idlab__dot" aria-hidden="true" />}
          </>
        )
        return onSelect ? (
          <button
            key={team.id}
            type="button"
            className={`idlab__railitem${selected ? ' idlab__railitem--on' : ''}`}
            aria-current={selected ? 'true' : undefined}
            onClick={() => onSelect(team.id)}
            title={team.name}
          >
            {inner}
          </button>
        ) : (
          <a
            key={team.id}
            className="idlab__railitem"
            href={`#${teamAnchorId(team.id)}`}
            title={team.name}
          >
            {inner}
          </a>
        )
      })}
    </nav>
  )
}
