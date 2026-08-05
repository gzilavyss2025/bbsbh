import { PitcherPhoto } from './PitcherNotice.jsx'
import { PlayerLink } from './identity/PlayerLink.jsx'
import { ordinal } from '../lib/format.js'

// The "pinch running" notification card, at the moment a pinch runner enters
// mid-flow — same headshot + label + name layout as PitcherNotice/FielderNotice.
// This is separate from the strike-through the same swap leaves on the
// replaced runner's own plate-appearance card further back in the feed (see
// computeHalfInningFeed's prSubs bookkeeping) — that's the retroactive record
// of who's on base now; this is the announcement as it happens. `runner` /
// `replaced` are the { id, name, jersey } shapes pinchRunningPlayers builds;
// `base` is the numeric base (1-3) he entered at, same field PlayDiamond's
// PR mark keys off of. The entering runner reads on his own line (name left,
// number + PR badge right, same layout PitcherNotice uses for jersey/hand);
// who he replaced and where drops to a second line below.
export function PinchRunNotice({ runner, replaced, base = null, teamId = null, teamName, className = '' }) {
  if (!runner) return null
  return (
    <div className={`pitchernotice ${className}`}>
      <PitcherPhoto personId={runner.id} name={runner.name} teamId={teamId} />
      <div className="pitchernotice__body">
        <span className="pitchernotice__now">Pinch running{teamName ? ` for the ${teamName}` : ''}</span>
        <span className="pitchernotice__pitcher">
          <PlayerLink id={runner.id}>{runner.name}</PlayerLink>
          <span className="pitchernotice__badges">
            {runner.jersey ? <span className="pitchernotice__jersey">{runner.jersey}</span> : null}
            <span className="pitchernotice__prtag">PR</span>
          </span>
        </span>
        {replaced && (
          <span className="pitchernotice__forline">
            For <PlayerLink id={replaced.id}>{replaced.name}</PlayerLink>
            {base ? ` at ${ordinal(base)} base` : ''}
          </span>
        )}
      </div>
    </div>
  )
}
