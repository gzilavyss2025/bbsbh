import { rankedDimensions } from '../../../lib/ballparkData.js'
import { BallparkDiagram } from '../../../components/ballpark/BallparkDiagram.jsx'
import { Facts, RankGroup } from '../../../components/ballpark/BallparkFacts.jsx'

// The Overview's Ballpark card — the diagram and its details side by side at
// >=740px (the app's one responsive breakpoint, src/CLAUDE.md), stacked below
// it. Same content the lineup page's BallparkModal shows (built/roof/capacity,
// ranked outfield distances + wall heights), just laid out inline rather than
// behind a tap — this IS the full detail view here, not a preview of one.
//
// Spoiler-safe and free: park geometry carries no score, and `team.venue.name`
// comes from the weekly static snapshot (see gen-teams.mjs), no live fetch.
// Renders nothing for a park not on file (every MiLB park, and the Athletics'
// Sutter Health Park) — same graceful-degrade convention as ballparkFor.
export function BallparkCard({ team }) {
  const venueName = team.venue?.name
  const park = venueName ? rankedDimensions(venueName) : null
  if (!park) return null

  const distRows = park.rows.filter((r) => r.group === 'dist')
  const wallRows = park.rows.filter((r) => r.group === 'wall')

  return (
    <div className="thub-card">
      <div className="thub-card__head">
        <span>Ballpark</span>
      </div>
      <div className="thub-card__body">
        <p className="ballparkcard__name">{park.name}</p>
        <div className="ballparkcard__layout">
          <BallparkDiagram
            className="ballparkcard__diagram"
            dist={park.dist}
            wall={park.wall}
            arc={park.arc}
          />
          <div className="ballparkcard__details">
            <dl className="bpsheet__facts">
              <Facts label="Opened" value={park.built} />
              <Facts label="Roof" value={park.roof} />
              <Facts label="Capacity" value={park.capacity?.toLocaleString()} />
            </dl>
            <div className="bpsheet__ranks">
              <RankGroup title="Outfield distances" rows={distRows} />
              <RankGroup title="Wall heights" rows={wallRows} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
