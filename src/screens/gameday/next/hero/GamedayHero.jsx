import { createElement, useContext, useLayoutEffect, useRef, useState } from 'react'
import '../../../../styles/gameday-next/hero.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { eventCardMarkup } from '../steps/eventCardMarkup.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { heroMarkup } from './heroMarkup.js'
import { ScrollCue } from '../ScrollCue.jsx'
import { BallFlight } from '../../../../components/charts/BallFlight.jsx'
import { ParksCell, SavantFacts } from './SavantFacts.jsx'
import { StrikeZoneModal } from '../../../../components/scoring/StrikeZone.jsx'
import { hasPitchLocations } from '../../../../api/playbyplay/pitchInfo.js'
import { BattingUniformContext, GameUniformsContext } from '../../../../components/logo/uniformContexts.js'

// Gameday's hero (markup and rules: heroMarkup.js), and the stage's event card that shares its box.
export const GamedayHero = (props) => heroMarkup(createElement, { SealBox, Headshot, PlayerLink, Line: PlayLine, Flight: BallFlight, Zone: PitchZone, Savant: SavantFacts, Parks: ParksCell, Flip: PlayFlip, ...props })
export const GamedayEventCard = (props) => eventCardMarkup(createElement, { SealBox, ...props })

// The words and the contact card in one place (heroMarkup.js flip): a tap anywhere but a link or the scroll
// chevron turns it. `data-side` picks the face; the CSS shows one only on the phone. The hidden toggle is the
// keyboard's way to it.
function PlayFlip({ line, card }) {
  const [onCard, setOnCard] = useState(false)
  const turn = (e) => { if (!e.target.closest('a, button:not(.gdhero__fliptog), .gdhero__parks')) setOnCard(!onCard) }
  return (
    <div className="gdhero__flip" data-side={onCard ? 'card' : 'line'} onClick={turn}>
      <button type="button" className="gdhero__fliptog sr-only" aria-pressed={onCard}>{onCard ? 'Show the play' : 'Show exit velo, launch angle and distance'}</button>
      {line}
      {card}
    </div>
  )
}

// The play's words at the normal size; past their space, the smaller size; past that too, they scroll
// in place with ScrollCue's bouncing chevron. Never cut off with an ellipsis. Measured again on a resize.
function PlayLine({ text }) {
  const ref = useRef(null)
  const [tight, setTight] = useState(false)
  useLayoutEffect(() => {
    const p = ref.current
    const box = p?.parentElement
    if (!box) return undefined
    const fit = () => {
      p.classList.remove('is-tight')
      const over = box.scrollHeight > box.clientHeight + 1
      p.classList.toggle('is-tight', over)
      setTight(over)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [text])
  return (
    <ScrollCue label="More of the play below" className="gdhero__scroll">
      <p ref={ref} className={tight ? 'gdhero__line is-tight' : 'gdhero__line'}>{text}</p>
    </ScrollCue>
  )
}

// A click on the box's pitch columns opens the strike zone with every pitch and its speed (the old feed's
// StrikeZoneModal). No tracked locations (a thin MiLB feed), no handle. The batter in the zone wears
// tonight's uniform of the club at bat (GameView's posted assets, as the half page hands them down);
// the plain silhouette stands in where none is posted.
// Zoomed out by about three-quarters of a foot a side, so a pitch well off the plate stays on the drawing.
const ZONE_MARGIN = 44
function PitchZone({ entry, side }) {
  const [open, setOpen] = useState(false)
  const uniform = useContext(GameUniformsContext)?.[side] ?? null
  if (!hasPitchLocations(entry.pitchDetails)) return null
  return (
    <>
      <button type="button" className="gdhero__zonebtn" aria-label={`Pitches to ${entry.batter?.last ?? 'this batter'}`} onClick={() => setOpen(true)} />
      {open && (
        <BattingUniformContext.Provider value={uniform}>
          <StrikeZoneModal pitchDetails={entry.pitchDetails} batSide={entry.batSide} batter={entry.batter} pitcher={entry.pitcher?.last} onClose={() => setOpen(false)} head={false} margin={ZONE_MARGIN} />
        </BattingUniformContext.Provider>
      )}
    </>
  )
}
