import '../../../../styles/gameday-next/zonemap.css'
import { IconButton } from '../../../../components/ui/control/IconButton.jsx'

const DAY = { month: 'short', day: 'numeric', timeZone: 'UTC' }

// The zone map's corner card (#2568, round 2 item 6): the batter's average by zone, zone 1 top left
// as the catcher sees it, season through the day before the game (api/gameday/zones.js). The tint
// in the pixel zone is the stage's (drawStage). The ✕ hides the map for this game (zoneMapFlag.js).
export function ZoneCard({ name, zones, through, onDismiss }) {
  return (
    <div className="gdzonemap">
      <div className="gdzonemap__head">
        <span>{name} · Avg by zone</span>
        <IconButton label="Hide the zone map" mark="sm" onClick={onDismiss}>✕</IconButton>
      </div>
      <div className="gdzonemap__grid">
        {Array.from({ length: 9 }, (_, i) => {
          const z = zones[`0${i + 1}`]
          return <span key={i} className={`gdzonemap__cell is-${z?.temp || 'none'}`}>{z?.avg || '—'}</span>
        })}
      </div>
      <span className="gdzonemap__foot">Season to {new Date(`${through}T00:00:00Z`).toLocaleDateString('en-US', DAY)}</span>
    </div>
  )
}
