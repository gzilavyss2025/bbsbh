import '../../../../styles/gameday-next/zonemap.css'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { useContext, useEffect, useState } from 'react'
import { UniformFigure } from '../../../../components/logo/UniformFigure.jsx'
import { GameUniformsContext } from '../../../../components/logo/uniformContexts.js'
import { batterFigureUrls, fallbackFigureUrls } from '../../../../api/uniforms.js'
import { stanceArt } from '../../../../lib/zone/zoneGeometry.js'

// The static plate inset (#2568, round 2 item 6): the batter's average by zone, zone 1 top left
// as the catcher sees it, season through the day before the game (api/gameday/zones.js). The tint
// uses the existing zone temperature tokens. Gary dropped its ✕ (2026-10-28).
// `pitches` is the at-bat's plotted pitches, drawn by the caller inside a SealBox (zonePitches.js).
// `pitcher` ({ id, first, last }) is the man on the mound, drawn opposite the batter (Gary, 2026-10-28);
// `matchup` is the batter's line against him and the door to the Scout (panels/ScoutLine.jsx), under his name.
// TRIAL (Gary, 2026-10-29, not decided): `backdrop` is MLB Gameday's stadium art for tonight's park
// (docs/gameday-assets.md, "Stadium backdrops"), behind the batting view. MLB-hosted art: see that doc's licence note.
export function ZoneCard({ name, teamId, side = 'R', zones, pitches = null, pitcher = null, matchup = null, club = null, backdrop = null, contact = null }) {
  // MLB Gameday's own batter in every case (Gary, 2026-10-29, over the drawn sprite): tonight's posted
  // uniform, else the club's usual Gameday figure, else MLB's generic one; each failed image steps on.
  const figures = [batterFigureUrls(useContext(GameUniformsContext)?.[club] ?? null, stanceArt(side)), ...fallbackFigureUrls(teamId, club, stanceArt(side))].filter(Boolean)
  const [failed, setFailed] = useState(() => new Set())
  const urls = figures.find((f) => !failed.has(f.jersey)) ?? null
  const figure = Boolean(urls)
  // A tap on the zone explains its numbers in a note at the stage's lower right; the next tap anywhere
  // puts it away (Gary, 2026-10-29). A pitch dot keeps its own tap.
  const [note, setNote] = useState(false)
  useEffect(() => {
    if (!note) return undefined
    const away = () => setNote(false)
    const t = setTimeout(() => window.addEventListener('pointerdown', away, { once: true }), 0)
    return () => { clearTimeout(t); window.removeEventListener('pointerdown', away) }
  }, [note])
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
      {backdrop && <img className="gdzonemap__backdrop" src={backdrop} alt="" aria-hidden="true" crossOrigin="anonymous" onError={(e) => { e.currentTarget.hidden = true }} />}
      {/* TRIAL (Gary, 2026-10-29): the bare field as a photo, the stage's lower half, fitting up against the park
          backdrop at the horizon; the drawn chalk and plate stay on top. */}
      {backdrop && <span className="gdzonemap__field" aria-hidden="true" />}
      <div className="gdzonemap__plateview">
        <svg className="gdzonemap__ground" viewBox="0 0 640 120" aria-hidden="true">
          <path d="M70 12H217L193 108H8ZM423 12H570L632 108H447Z" />
          {/* The foul lines, out from the boxes' far corners toward left and right field (Gary, 2026-10-29). */}
          {backdrop && <path className="gdzonemap__foul" d="M130 12L-520 -150M510 12L1160 -150" />}
        </svg>
        {/* The figure is art, not a door (Gary, 2026-10-28): a tap opens nothing. */}
        <span className={figure ? 'gdzonemap__batter is-uniform' : 'gdzonemap__batter'}>
          {figure && <UniformFigure key={urls.jersey} urls={urls} label={name} onError={() => setFailed((s) => new Set(s).add(urls.jersey))} />}
        </span>
        <svg className="gdzonemap__plate" viewBox="0 0 196 60" aria-hidden="true">
          <path className="gdzonemap__plate-edge" d="M1 4H195V32L98 59L1 32Z" />
          <path className="gdzonemap__plate-face" d="M1 1H195V29L98 56L1 29Z" />
        </svg>
        <div className="gdzonemap__grid" aria-label="Batting average by strike zone" role="button" tabIndex={0}
          onClick={(e) => !e.target.closest('.gdzonemap__pitch') && setNote(true)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setNote(true))}>
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
        {/* The ball in play's exit velo and launch angle, over the plate's left (Gary, 2026-10-29: moved from the hero). */}
        {contact}
        {note && (
          <p className="gdzonemap__note" role="status">
            {name.split(' ').at(-1)}’s batting average on pitches in this zone this season (does not include this game’s at-bats).
          </p>
        )}
      </div>
    </div>
  )
}
