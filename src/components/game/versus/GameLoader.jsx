import { useState, useEffect } from 'react'
import { Loader } from '../../ui/Loader.jsx'
import { TeamTreatmentMark } from '../../logo/TeamTreatmentMark.jsx'
import { useMediaQuery, WIDE_QUERY } from '../../../hooks/useMediaQuery.js'

// The wait after a slate-card tap, on a phone: the two club colours the card
// showed grow out of their logo tiles until they fill the screen, split on a
// slash, and hold there until the game is ready. Replaces the scoreboard
// `Loader` for a game's own wait. Wide screens and reduced-motion readers keep
// the scoreboard. Pure paint: identity only, no feed, no score.
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
// A little over --dur-med, the length of the fade-out in loader.css.
const FADE_MS = 240

// `settled`: already full-screen, no growth. For a fallback that can follow the
// first loader, so the handoff does not replay the animation. `leaving`: fading out.
export function GameLoader({ game, treatment, settled = false, leaving = false }) {
  const wide = useMediaQuery(WIDE_QUERY)
  const reduced = useMediaQuery(REDUCED_QUERY)
  if (wide || reduced || !game?.away?.id || !game?.home?.id) return leaving ? null : <Loader />

  const cls = ['versusload', settled && 'versusload--settled', leaving && 'versusload--leaving']
  return (
    <div className={cls.filter(Boolean).join(' ')} role="status" aria-live="polite">
      <div className="versusload__stage" aria-hidden="true">
        {['away', 'home'].map((side) => (
          <TeamTreatmentMark
            key={side}
            teamId={game[side].id}
            name={game[side].name}
            treatment={treatment?.[side]}
            side={side}
            size={56}
            block="versusload__tile"
            className={`versusload__tile--${side}`}
            eager
          />
        ))}
        <span className="versusload__slash" />
      </div>
    </div>
  )
}

// Shows the loader while `active`, then keeps it mounted for one short fade
// once `active` drops, so the game's page replaces it softly, not with a cut.
export function GameLoaderHold({ active, ...props }) {
  const [shown, setShown] = useState(active)
  if (active && !shown) setShown(true)
  useEffect(() => {
    if (active || !shown) return undefined
    const timer = setTimeout(() => setShown(false), FADE_MS)
    return () => clearTimeout(timer)
  }, [active, shown])
  return shown ? <GameLoader {...props} leaving={!active} /> : null
}
