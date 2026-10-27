import { createElement, useLayoutEffect, useRef, useState } from 'react'
import '../../../../styles/gameday-next/hero.css'
import { SealBox } from '../../../../components/SealBox.jsx'
import { eventCardMarkup } from '../steps/eventCardMarkup.js'
import { PlayerLink } from '../../../../components/player/PlayerLink.jsx'
import { Headshot } from '../../../../components/player/Headshot.jsx'
import { heroMarkup } from './heroMarkup.js'
import { ScrollCue } from '../ScrollCue.jsx'
import { BallFlight } from '../../../../components/charts/BallFlight.jsx'

// Gameday's hero (markup and rules: heroMarkup.js), and the stage's event card that shares its box.
export const GamedayHero = (props) => heroMarkup(createElement, { SealBox, Headshot, PlayerLink, Line: PlayLine, Flight: BallFlight, ...props })
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
