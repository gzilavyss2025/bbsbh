import { PitcherPhoto } from './PitcherNotice.jsx'
import { PlayerLink } from '../player/PlayerLink.jsx'

// The "now batting" notification card for a pinch hitter — same headshot +
// label + name layout as PitcherNotice/FielderNotice (shares its
// .pitchernotice CSS and PitcherPhoto), on the BATTING team's side since a
// pinch hitter is an offensive substitution. Two callers, same card: staged
// pre-pitch (HalfInning.jsx's PrePitchChanges, `batter` shaped by
// selectPrePitchChanges) and mid-inning, live in the feed
// (PlayByPlay.jsx, `batter` shaped by playbyplay.js's pinchHittingBatter) —
// same symmetry every other substitution type already has (a pitching
// change, a defensive sub/switch, a pinch runner). Either way `batter` is
// the { id, name, jersey } shape; his own at-bat card still follows right
// after, same as any other substitution's live card is followed by its own
// later cards.
export function BatterNotice({ batter, teamId = null, teamName, className = '' }) {
  if (!batter) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={batter.id} name={batter.name} teamId={teamId} />
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
