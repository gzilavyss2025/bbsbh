import { useMemo, useState } from 'react'
import { buildBetweenInnings } from '../../api/between-innings.js'
import { Headshot } from '../player/Headshot.jsx'

// Focus mode's post-half hold, one fact at a time (ConsoleBand.jsx). Mounted
// only inside ConsoleBand's `{showTally && ...}` slot, so `idx` resets to 0
// for free on every new half. Tapping past the last card wraps to the first
// — no terminal state.
export function BetweenInnings({ feed, bundle, marginNotes, inning, half, revealedThrough, workload, gameDate }) {
  const cards = useMemo(
    () => buildBetweenInnings({ feed, bundle, marginNotes, inning, half, revealedThrough, workload, gameDate }),
    [feed, bundle, marginNotes, inning, half, revealedThrough, workload, gameDate],
  )
  const [idx, setIdx] = useState(0)
  if (cards.length === 0) return null
  const card = cards[Math.min(idx, cards.length - 1)]
  const advance = () => setIdx((i) => (i + 1) % cards.length)
  const personName = card.personId != null ? feed?.gameData?.players?.[`ID${card.personId}`]?.fullName : null
  const teamId = card.side != null ? bundle?.[card.side]?.teamId : null

  return (
    <button type="button" className="betweeninnings" onClick={advance}>
      <div className="betweeninnings__label">
        <span className="betweeninnings__eyebrow">Between Innings</span>
        <span className="betweeninnings__progress">
          {idx + 1} / {cards.length}
        </span>
      </div>
      <div className="betweeninnings__body">
        {card.personId != null && (
          <span className="betweeninnings__avatar">
            <Headshot personId={card.personId} name={personName} teamId={teamId} className="betweeninnings__shot" />
          </span>
        )}
        <span className="betweeninnings__col">
          {personName && <span className="betweeninnings__who">{personName}</span>}
          <span className="betweeninnings__text">{card.text}</span>
        </span>
      </div>
    </button>
  )
}
