import { PitcherPhoto } from './PitcherNotice.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// The "now playing" notification card for a defensive change — same headshot +
// label + name layout as PitcherNotice (shares its .pitchernotice CSS and
// PitcherPhoto), just for a fielder rather than a pitcher. `fielder` is the
// { id, name, jersey, position } shape that defensiveChangeFielder
// (playbyplay.js, a mid-inning change) and selectPrePitchChanges (select.js,
// one announced before a half's first pitch) both build.
//
// It covers a defensive SWITCH — a player already in the game moving to a new
// position — as well as a fresh entrant. A switch has no "entering" moment,
// but it moves where a scorer's pencil goes just as much as a new face does,
// so PlayByPlay cards both rather than dropping the switch to a plain
// EventNote (ADR-0017's tiering: a fresh-or-CHANGED actor is a card).
export function FielderNotice({ fielder, teamId = null, teamName, className = '' }) {
  if (!fielder) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={fielder.id} name={fielder.name} teamId={teamId} />
      <div className="pitchernotice__body">
        <span className="pitchernotice__now">
          Now playing{fielder.position ? ` ${fielder.position}` : ''}
          {teamName ? ` for the ${teamName}` : ''}
        </span>
        <span className="pitchernotice__pitcher">
          <PlayerLink id={fielder.id}>{fielder.name}</PlayerLink>
          {fielder.jersey ? ` ${fielder.jersey}` : ''}
        </span>
      </div>
    </div>
  )
}
