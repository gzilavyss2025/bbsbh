import { useEffect, useMemo, useState } from 'react'
import { buildBetweenInnings } from '../../api/between-innings.js'
import { halfIndex } from '../../api/select.js'
import { useCalloutLedger } from '../../hooks/useCalloutLedger.js'
import { Headshot } from '../player/Headshot.jsx'
import { HalfTally } from './HalfTally.jsx'

// Focus mode's post-half hold, ONE card cycling through its own states
// (ConsoleBand.jsx). State 0 is the half's tally grid (HalfTally.jsx) — the
// card's resting state, what a reader lands on the instant the half closes.
// States 1..cards.length are its score-free facts, one at a time. Tapping
// anywhere on the card advances it; past the last fact it returns to the
// grid rather than wrapping to fact 1 — the grid is where this card lives,
// not one more stop in a loop of facts. Mounted only inside ConsoleBand's
// `{showTally && ...}` slot, so `idx` resets to 0 for free on every new half.
export function BetweenInnings({
  feed, bundle, marginNotes, inning, half, revealedThrough, workload, gameDate,
  battingSide, getDerived, phase,
}) {
  // This card stages the NEXT half (between-innings.js's nextHalfOf), which in
  // half-index terms is simply the one after this — so that is the half the
  // shown ledger reads and writes under. Reading a half the Arms tab has
  // already written is the point: the pool this card draws from IS the Margin
  // Notes list, and a fact the reader met beside the box is not news here.
  const ledger = useCalloutLedger()
  const stagedIdx = halfIndex(inning, half) + 1
  // Frozen for the half. Read inline, this recounts on every live feed poll, so
  // an Arms-tab marking of the SAME half could decay a card out of the stack
  // while the reader sits on it — `idx` is independent state and would then
  // point at a different fact. It rebuilds only when the staged half changes,
  // which is what the key on this card already resets `idx` for.
  const shownCounts = useMemo(() => ledger.countsFor(stagedIdx), [ledger, stagedIdx])
  const cards = useMemo(
    () => buildBetweenInnings({
      feed, bundle, marginNotes, inning, half, revealedThrough, workload, gameDate,
      shownCounts,
    }),
    [feed, bundle, marginNotes, inning, half, revealedThrough, workload, gameDate, shownCounts],
  )
  const [idx, setIdx] = useState(0)
  const advance = () => setIdx((i) => (i + 1) % (cards.length + 1))
  // Clamped rather than trusted: cards is derived from live inputs
  // (feed/marginNotes) that can still shift while this card is mounted, and
  // an idx that outlived a shrinking list must fall back to the grid rather
  // than read past the end of the array.
  const safeIdx = Math.min(idx, cards.length)

  // Only the card the reader actually advanced to counts as shown — this card
  // holds up to CARD_MAX facts one at a time and most readers never reach the
  // last of them. Same effect-not-render rule MarginNotes.jsx follows.
  const seenCard = safeIdx > 0 ? cards[safeIdx - 1] : null
  const seenKey = seenCard ? seenCard.dedupeKey ?? seenCard.text : ''
  useEffect(() => {
    if (!seenKey) return
    ledger.markShown([{ dedupeKey: seenKey }], stagedIdx)
  }, [ledger, seenKey, stagedIdx])

  const grid = (
    <HalfTally
      feed={feed}
      inning={inning}
      half={half}
      battingSide={battingSide}
      getDerived={getDerived}
      phase={phase}
    />
  )
  // Nothing to cycle to — the grid is not a button, same as before this card
  // existed at all.
  if (cards.length === 0) return grid
  if (safeIdx === 0) {
    return (
      <button type="button" className="halftally-tap" onClick={advance}>
        {grid}
      </button>
    )
  }

  const card = cards[safeIdx - 1]
  const personName = card.personId != null ? feed?.gameData?.players?.[`ID${card.personId}`]?.fullName : null
  const teamId = card.side != null ? bundle?.[card.side]?.teamId : null

  return (
    <button type="button" className="betweeninnings" onClick={advance}>
      <div className="betweeninnings__label">
        <span className="betweeninnings__eyebrow">Between Innings</span>
        <span className="betweeninnings__progress">
          {safeIdx} / {cards.length}
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
