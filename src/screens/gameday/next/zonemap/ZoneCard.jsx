import '../../../../styles/gameday-next/zonemap.css'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { BatterSprite } from './BatterSprite.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { useContext, useState } from 'react'
import { UniformFigure } from '../../../../components/logo/UniformFigure.jsx'
import { GameUniformsContext } from '../../../../components/logo/uniformContexts.js'
import { batterFigureUrls } from '../../../../api/uniforms.js'
import { stanceArt } from '../../../../lib/zone/zoneGeometry.js'

// The static plate inset (#2568, round 2 item 6): the batter's average by zone, zone 1 top left
// as the catcher sees it, season through the day before the game (api/gameday/zones.js). The tint
// uses the existing zone temperature tokens. Gary dropped its ✕ (2026-10-28).
// `pitches` is the at-bat's plotted pitches, drawn by the caller inside a SealBox (zonePitches.js).
// `pitcher` ({ id, first, last }) is the man on the mound, drawn opposite the batter (Gary, 2026-10-28);
// `matchup` is the batter's line against him and the door to the Scout (panels/ScoutLine.jsx), under his name.
export function ZoneCard({ name, teamId, side = 'R', zones, pitches = null, pitcher = null, matchup = null, club = null }) {
  // Tonight's uniform figure, as the strike-zone modal draws it (Gary, 2026-10-28); the drawn sprite
  // stands in where none is posted or the art fails.
  const urls = batterFigureUrls(useContext(GameUniformsContext)?.[club] ?? null, stanceArt(side))
  const [failed, setFailed] = useState(null)
  const figure = urls && failed !== urls.jersey
  return (
    <div className="gdzonemap" data-side={side} data-team={teamId} aria-label={`${name} at the plate, ${side === 'L' ? 'left' : 'right'}-handed`}>
      {pitcher && (
        <div className="gdzonemap__pitcher">
          <PlayerLink id={pitcher.id} name={`${pitcher.first} ${pitcher.last}`} className="gdzonemap__pitcherlink" ariaLabel={`Pitching: ${pitcher.first} ${pitcher.last}`}>
            <Headshot personId={pitcher.id} name={pitcher.last} tint={false} />
            <small>{pitcher.first}</small>
            <b>{pitcher.last}</b>
          </PlayerLink>
          {matchup}
        </div>
      )}
      <div className="gdzonemap__plateview">
        <svg className="gdzonemap__ground" viewBox="0 0 640 120" aria-hidden="true">
          <path d="M70 12H217L193 108H8ZM423 12H570L632 108H447Z" />
        </svg>
        {/* The figure is art, not a door (Gary, 2026-10-28): a tap opens nothing. */}
        <span className={figure ? 'gdzonemap__batter is-uniform' : 'gdzonemap__batter'}>
          {figure ? <UniformFigure urls={urls} label={name} onError={() => setFailed(urls.jersey)} />
            : <BatterSprite key={teamId} side={side} teamId={teamId} />}
        </span>
        <svg className="gdzonemap__plate" viewBox="0 0 196 60" aria-hidden="true">
          <path className="gdzonemap__plate-edge" d="M1 4H195V32L98 59L1 32Z" />
          <path className="gdzonemap__plate-face" d="M1 1H195V29L98 56L1 29Z" />
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
          {pitches}
        </div>
      </div>
    </div>
  )
}
