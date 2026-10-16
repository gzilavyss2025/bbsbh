import { Loader } from '../../ui/Loader.jsx'
import { TeamTreatmentMark } from '../../logo/TeamTreatmentMark.jsx'
import { useMediaQuery, WIDE_QUERY } from '../../../hooks/useMediaQuery.js'

// The wait after a slate-card tap, on a phone: the two club colours the card
// showed grow out of their logo tiles until they fill the screen, split on a
// slash, and hold there until the game is ready. Replaces the scoreboard
// `Loader` for a game's own wait. Wide screens and reduced-motion readers keep
// the scoreboard. Pure paint: identity only, no feed, no score.
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

export function GameLoader({ game, treatment }) {
  const wide = useMediaQuery(WIDE_QUERY)
  const reduced = useMediaQuery(REDUCED_QUERY)
  if (wide || reduced || !game?.away?.id || !game?.home?.id) return <Loader />

  return (
    <div className="versusload" role="status" aria-live="polite">
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
