import { PitcherPhoto } from './PitcherNotice.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// The "now playing" notification card for a mid-inning defensive substitution
// — same headshot + label + name layout as PitcherNotice (shares its
// .pitchernotice CSS and PitcherPhoto), just for a fresh fielder rather than a
// fresh pitcher. `fielder` is the { id, name, jersey, position } shape
// defensiveChangeFielder builds. A defensive SWITCH (a player already in the
// game moving to a new position, no new entrant) stays a plain one-line
// EventNote in PlayByPlay — there's no "entering" moment to make a card of.
export function FielderNotice({ fielder, teamName, className = '' }) {
  if (!fielder) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={fielder.id} />
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
