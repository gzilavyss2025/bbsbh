import { PitcherPhoto } from './PitcherNotice.jsx'
import { PlayerLink } from './PlayerLink.jsx'

// The "pinch running" notification card, at the moment a pinch runner enters
// mid-flow — same headshot + label + name layout as PitcherNotice/FielderNotice.
// This is separate from the strike-through the same swap leaves on the
// replaced runner's own plate-appearance card further back in the feed (see
// computeHalfInningFeed's prSubs bookkeeping) — that's the retroactive record
// of who's on base now; this is the announcement as it happens. `runner` /
// `replaced` are the { id, name, jersey } shapes pinchRunningPlayers builds.
export function PinchRunNotice({ runner, replaced, teamName, className = '' }) {
  if (!runner) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={runner.id} />
      <div className="pitchernotice__body">
        <span className="pitchernotice__now">Pinch running{teamName ? ` for the ${teamName}` : ''}</span>
        <span className="pitchernotice__pitcher">
          <PlayerLink id={runner.id}>{runner.name}</PlayerLink>
          {runner.jersey ? ` ${runner.jersey}` : ''}
          {replaced && (
            <>
              {' '}
              for <PlayerLink id={replaced.id}>{replaced.name}</PlayerLink>
            </>
          )}
        </span>
      </div>
    </div>
  )
}
