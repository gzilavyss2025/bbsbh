import { ScorebugMount } from '../../components/gamehud/ScorebugMount.jsx'
import { MatchBand } from './Masthead.jsx'

// The innings page's masthead. Once the game has started and the half on screen has a live
// snapshot it IS the scorebug (HeaderBug, through ScorebugMount, whose reveal clamp is the only
// gate on the score); before that it is the plain split band of the two clubs, so the page never
// opens without its header. Both draw identity and what ScorebugMount already resolved, so the
// reveal-only reads stay inside it and nothing here computes a score.
export function InningsHeader({ started, live, feed, unlocked, revealedThrough, runsInProgress, meta, treatment, viewIdx, viewInning, viewHalf, date, onSketch }) {
  if (!started || !live) {
    return <MatchBand away={meta.away} home={meta.home} date={date} onSketch={onSketch} treatment={treatment} />
  }
  return (
    <ScorebugMount
      season={date}
      started={started}
      live={live}
      feed={feed}
      unlocked={unlocked}
      revealedThrough={revealedThrough}
      runsInProgress={runsInProgress}
      meta={meta}
      treatment={treatment}
      viewIdx={viewIdx}
      viewInning={viewInning}
      viewHalf={viewHalf}
    />
  )
}
