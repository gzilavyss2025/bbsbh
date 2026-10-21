import { useState, useEffect } from 'react'
import { Loader } from '../../ui/Loader.jsx'
import { TeamTreatmentMark } from '../../logo/TeamTreatmentMark.jsx'
import { useMediaQuery, WIDE_QUERY } from '../../../hooks/useMediaQuery.js'
import { goHome } from '../../../lib/home.js'

// The wait after a slate-card tap, on a phone: the two club colours the card
// showed grow out of their logo tiles until they fill the screen, split on a
// slash, and hold there until the game is ready. Replaces the scoreboard
// `Loader` for a game's own wait. Wide screens and reduced-motion readers keep
// the scoreboard. Pure paint: identity only, no feed, no score.
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'
// A little over --dur-med, the length of the fade-out in loader.css.
const FADE_MS = 240
// The least time the colour layer stays up: the growth (--dur-slow, 360ms) plus a beat to read it.
const MIN_MS = 1500

// `settled`: already full-screen, no growth. For a fallback that can follow the
// first loader, so the handoff does not replay the animation. `leaving`: fading out.
// True when the colour layer shows: a phone, motion allowed, both clubs known.
function useVersusLayer(game) {
  const wide = useMediaQuery(WIDE_QUERY)
  const reduced = useMediaQuery(REDUCED_QUERY)
  return !wide && !reduced && Boolean(game?.away?.id && game?.home?.id)
}

export function GameLoader({ game, treatment, settled = false, leaving = false }) {
  const layer = useVersusLayer(game)
  if (!layer) return <Loader />

  const cls = ['versusload', settled && 'versusload--settled', leaving && 'versusload--leaving']
  return (
    <div className={cls.filter(Boolean).join(' ')} role="status" aria-live="polite">
      <span className="sr-only">Loading game</span>
      {/* The layer covers the page's own way home, so it carries one. */}
      <button type="button" className="btn btn--ghost versusload__back" onClick={() => goHome()}>
        Back to games
      </button>
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

// Shows the loader for at least MIN_MS from mount, and while `active` after that. Then it
// stays mounted for one short fade, so the game's page replaces it softly, not with a cut.
// The floor holds even when the game is already in hand: a cut after a few hundred ms read
// as a glitch, not as an arrival.
export function GameLoaderHold({ active, ...props }) {
  const layer = useVersusLayer(props.game)
  const [shown, setShown] = useState(true)
  const [minDone, setMinDone] = useState(false)
  if (active && !shown) setShown(true)
  useEffect(() => {
    const timer = setTimeout(() => setMinDone(true), MIN_MS)
    return () => clearTimeout(timer)
  }, [])
  const leaving = !active && minDone
  useEffect(() => {
    if (!leaving || !shown) return undefined
    const timer = setTimeout(() => setShown(false), FADE_MS)
    return () => clearTimeout(timer)
  }, [leaving, shown])
  // No colour layer, nothing to fade: the scoreboard shows while loading and goes at once.
  if (!layer) return active ? <Loader /> : null
  return shown ? <GameLoader {...props} leaving={leaving} /> : null
}
