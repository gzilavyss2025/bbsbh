import { PitcherPhoto } from './PitcherNotice.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// The "now batting" notification card for a pinch-hitter announced before a
// half's first pitch — same headshot + label + name layout as PitcherNotice /
// FielderNotice (shares its .pitchernotice CSS and PitcherPhoto), on the
// BATTING team's side since a pinch-hitter is an offensive substitution. Only
// used pre-pitch (see HalfInning.jsx's PrePitchChanges); once the half is
// revealed the pinch-hitter owns his own at-bat card instead. `batter` is the
// { id, name, jersey } shape selectPrePitchChanges builds.
export function BatterNotice({ batter, teamName, className = '' }) {
  if (!batter) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={batter.id} />
      <div className="pitchernotice__body">
        <span className="pitchernotice__now">
          Now batting{teamName ? ` for the ${teamName}` : ''}
        </span>
        <span className="pitchernotice__pitcher">
          <PlayerLink id={batter.id}>{batter.name}</PlayerLink>
          {batter.jersey ? ` ${batter.jersey}` : ''}
        </span>
      </div>
    </div>
  )
}
