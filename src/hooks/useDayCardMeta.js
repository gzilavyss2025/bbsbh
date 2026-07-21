import { useEffect, useState } from 'react'
import { classifyGameCards } from '../api/dayHighlights.js'
import { fetchCallouts } from '../api/callouts.js'
import { apiDateToUrl } from '../lib/route.js'
import { usePastGameSignals } from './usePastGameSignals.js'

// Day-wide classification for the slate grid's pill badges (GameResultFace.jsx)
// — the "Game of the Night" crown needs every final game's signals compared
// against each other, so this fetches the whole day's {feed, winProb} in one
// batched pass via usePastGameSignals' shared cache (the same cache
// PastGameFlipCard's own per-card fetch reads, so nothing here double-fetches
// a gamePk) and classifies them together with dayHighlights.js's
// classifyGameCards.
//
// SPOILER RULE: only ever fetches once `revealed` is true — usePastGameSignals'
// data is score-revealing by definition (the feed IS the game), so firing this
// batch any earlier (e.g. to "pre-warm" pills before the slate's one shared
// reveal-all action) would put unrevealed results in the DOM. Returns an empty
// Map before that point and while the batch is in flight; a card simply shows
// no pills until its entry is ready, same graceful-degrade spirit as the rest
// of this reveal path.
export function useDayCardMeta(finals, dateStr, sportId, revealed) {
  const getSignals = usePastGameSignals()
  const [byGamePk, setByGamePk] = useState(new Map())

  useEffect(() => {
    if (!revealed || !finals?.length) {
      setByGamePk(new Map())
      return
    }
    let cancelled = false
    ;(async () => {
      const [entries, calloutsData] = await Promise.all([
        Promise.all(
          finals.map((game) =>
            getSignals(game.gamePk)
              .then(({ feed, winProb }) => ({ gamePk: game.gamePk, game, feed, winProb, dateStr }))
              .catch(() => null),
          ),
        ),
        fetchCallouts(apiDateToUrl(dateStr)),
      ])
      if (cancelled) return
      const cards = classifyGameCards(entries, calloutsData)
      setByGamePk(new Map(cards.map((c) => [c.gamePk, c])))
    })().catch(() => {
      if (!cancelled) setByGamePk(new Map())
    })
    return () => {
      cancelled = true
    }
  }, [finals, dateStr, sportId, revealed, getSignals])

  return byGamePk
}
