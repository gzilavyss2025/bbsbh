import { ActorHead } from './PitcherNotice.jsx'
import { TABS, forLine } from './cardCopy.js'

// The "pinch running" notification card, at the moment a pinch runner enters
// mid-flow — same headshot + label + name layout as PitcherNotice/FielderNotice.
// This is separate from the strike-through the same swap leaves on the
// replaced runner's own plate-appearance card further back in the feed (see
// computeHalfInningFeed's prSubs bookkeeping) — that's the retroactive record
// of who's on base now; this is the announcement as it happens. `runner` /
// `replaced` are the { id, name, jersey } shapes pinchRunningPlayers builds;
// `base` is the numeric base (1-3) he entered at, same field PlayDiamond's
// PR mark keys off of. The entering runner's number and PR badge sit in the badge row under his
// name; who he replaced and where is a second line below, in First Last order.
export function PinchRunNotice({ runner, replaced, base = null, teamId = null, teamName, className = '' }) {
  if (!runner) return null
  return (
    <div className={`change ${className}`}>
      <ActorHead tab={TABS.pinchRun} id={runner.id} name={runner.name} jersey={runner.jersey} pr teamId={teamId} teamName={teamName}>
        {replaced && <span className="change__forline">{forLine(replaced.name, base)}</span>}
      </ActorHead>
    </div>
  )
}
