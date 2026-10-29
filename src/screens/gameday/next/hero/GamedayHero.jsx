import { createElement, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react'
import '../../../../styles/gameday-next/hero.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { eventCardMarkup } from '../steps/eventCardMarkup.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { heroMarkup } from './heroMarkup.js'
import { ScrollCue } from '../ScrollCue.jsx'
import { BallFlight } from '../../../../components/charts/BallFlight.jsx'
import { SavantFacts } from './SavantFacts.jsx'
import { StrikeZoneModal } from '../../../../components/scoring/StrikeZone.jsx'
import { hasPitchLocations } from '../../../../api/playbyplay/pitchInfo.js'
import { BatterFallbackContext, BattingUniformContext, GameUniformsContext } from '../../../../components/logo/uniformContexts.js'
import { fallbackFigureUrls } from '../../../../api/uniforms.js'
import { stanceArt } from '../../../../lib/zone/zoneGeometry.js'

// Gameday's hero (markup and rules: heroMarkup.js), and the stage's event card that shares its box.
export const GamedayHero = (props) => heroMarkup(createElement, { SealBox, Headshot, PlayerLink, Line: PlayLine, Flight: BallFlight, Zone: PitchZone, Savant: SavantFacts, ...props })
export const GamedayEventCard = (props) => eventCardMarkup(createElement, { SealBox, ...props })

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
// where none is posted, MLB's own Gameday batter for the club stands in, then its generic one (Gary, 2026-10-29).
// Zoomed out by about three-quarters of a foot a side, so a pitch well off the plate stays on the drawing.
const ZONE_MARGIN = 44
// The sheet's two title lines (Gary, 2026-10-29): who faced whom, and the situation he came up to —
// the inning and the runners and outs as the plate appearance BEGAN (the play before it in the same
// half; none before the first). Nothing from the at-bat's own result.
const ORD = ['th', 'st', 'nd', 'rd']
const ordinal = (n) => `${n}${ORD[(n % 100 - 20) % 10] ?? ORD[n % 100] ?? ORD[0]}`
function zoneTitle(feed, entry) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const at = plays.findIndex((p) => p.about?.atBatIndex === entry.atBatIndex)
  const play = plays[at]
  if (!play) return null
  const prev = plays[at - 1]
  const same = prev && prev.about?.inning === play.about?.inning && prev.about?.halfInning === play.about?.halfInning
  const outs = same ? prev.count?.outs ?? 0 : 0
  const on = same ? ['postOnFirst', 'postOnSecond', 'postOnThird'].filter((k) => prev.matchup?.[k]).length : 0
  const name = (id, fallback) => feed?.gameData?.players?.[`ID${id}`]?.fullName ?? fallback ?? ''
  return [
    `${name(play.matchup?.batter?.id, entry.batter?.last)} vs ${name(play.matchup?.pitcher?.id, entry.pitcher?.last)}`,
    `${ordinal(play.about?.inning ?? 1)} inning • ${on} on, ${outs} out`,
  ]
}
function PitchZone({ entry, side, teamId = null, feed = null }) {
  const [open, setOpen] = useState(false)
  const uniform = useContext(GameUniformsContext)?.[side] ?? null
  const fallbacks = useMemo(() => fallbackFigureUrls(teamId, side, stanceArt(entry.batSide)), [teamId, side, entry.batSide])
  if (!hasPitchLocations(entry.pitchDetails)) return null
  return (
    <>
      <button type="button" className="gdhero__zonebtn" aria-label={`Pitches to ${entry.batter?.last ?? 'this batter'}`} onClick={() => setOpen(true)} />
      {open && (
        <BattingUniformContext.Provider value={uniform}>
          <BatterFallbackContext.Provider value={fallbacks}>
            <StrikeZoneModal title={zoneTitle(feed, entry)} pitchDetails={entry.pitchDetails} batSide={entry.batSide} batter={entry.batter} pitcher={entry.pitcher?.last} onClose={() => setOpen(false)} head={false} margin={ZONE_MARGIN} />
          </BatterFallbackContext.Provider>
        </BattingUniformContext.Provider>
      )}
    </>
  )
}
