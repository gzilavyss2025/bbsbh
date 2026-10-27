import '../../../../styles/gameday-next/zonemap.css'
import { IconButton } from '../../../../components/ui/control/IconButton.jsx'

// The zone map's corner card (#2568, round 2 item 6): the batter's average by zone, zone 1 top left
// as the catcher sees it, season through the day before the game (api/gameday/zones.js). The tint
// in the pixel zone is the stage's (drawStage). The ✕ hides the map for this game (zoneMapFlag.js).
export function ZoneCard({ name, zones, onDismiss }) {
  return (
    <div className="gdzonemap">
      <div className="gdzonemap__head">
        <span>{name} · Avg by zone</span>
        <IconButton label="Hide the zone map" mark="sm" onClick={onDismiss}>✕</IconButton>
      </div>
      <div className="gdzonemap__grid">
        {Array.from({ length: 9 }, (_, i) => {
          const z = zones[`0${i + 1}`]
          const avg = z?.avg || '—'
          // The leading point hangs left of the digits, so the three digits are what centers.
          const lead = avg.startsWith('.')
          return (
            <span key={i} className={`gdzonemap__cell is-${z?.temp || 'none'}`}>
              <span className="gdzonemap__num">{lead && <span className="gdzonemap__pt">.</span>}{lead ? avg.slice(1) : avg}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
