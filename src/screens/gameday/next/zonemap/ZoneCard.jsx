import '../../../../styles/gameday-next/zonemap.css'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { BatterSprite } from './BatterSprite.jsx'
import { IconButton } from '../../../../components/ui/control/IconButton.jsx'

// The static plate inset (#2568, round 2 item 6): the batter's average by zone, zone 1 top left
// as the catcher sees it, season through the day before the game (api/gameday/zones.js). The tint
// uses the existing zone temperature tokens. The ✕ hides the inset for this game (zoneMapFlag.js).
export function ZoneCard({ id, name, teamId, side = 'R', zones, onDismiss }) {
  return (
    <div className="gdzonemap" data-side={side} data-team={teamId} aria-label={`${name} at the plate, ${side === 'L' ? 'left' : 'right'}-handed`}>
      <div className="gdzonemap__dismiss">
        <IconButton label="Hide the zone map" mark="sm" onClick={onDismiss}>✕</IconButton>
      </div>
      <div className="gdzonemap__plateview">
        <PlayerLink id={id} name={name} className="gdzonemap__batter" ariaLabel={`Batter at the plate: ${name}`}>
          <BatterSprite key={teamId} side={side} teamId={teamId} />
        </PlayerLink>
        <svg className="gdzonemap__plate" viewBox="0 0 196 74" aria-hidden="true">
          <path d="M1 1H195V43L98 73L1 43Z" />
        </svg>
        <div className="gdzonemap__grid" aria-label="Batting average by strike zone">
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
    </div>
  )
}
