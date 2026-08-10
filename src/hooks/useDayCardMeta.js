import { useEffect, useState } from 'react'
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
// No sportId parameter: the level is already baked into `finals` (GameSelect
// re-derives it from that level's own schedule fetch, so switching levels
// hands this a new array identity) and into `dateStr`. Taking it as a third
// dep would just be a redundant trigger.
const EMPTY_MAP = new Map()

// A 16-game slate means 16 feed+winProb pairs; firing all 32 requests at once
// contends with itself on a phone connection (and with the callouts fetch
// below). A small worker pool keeps the pipe full without the stampede.
// Results keep item order; per-item failures are the caller's catch's problem.
const SIGNALS_CONCURRENCY = 6

async function mapPool(items, limit, fn) {
  const results = new Array(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (next < items.length) {
        const i = next++
        results[i] = await fn(items[i], i)
      }
    },
  )
  await Promise.all(workers)
  return results
}

export function useDayCardMeta(finals, dateStr, revealed) {
  const getSignals = usePastGameSignals()
  const [byGamePk, setByGamePk] = useState(EMPTY_MAP)
  const active = revealed && !!finals?.length

  useEffect(() => {
    if (!active) return undefined
    let cancelled = false
    ;(async () => {
      // classifyGameCards is imported DYNAMICALLY — keep it that way. It pulls
      // api/boxscore.js and the play-by-play selectors under it (halfInningFeed,
      // scorebookCode, entriesView, advanceCode, notificationCards, gameNotes,
      // pitchers), so a static import put the whole scoring data layer in the
      // ENTRY chunk: GameSelect imports this hook at module scope, so every
      // first paint of the slate paid for the innings viewer's data layer.
      //
      // It costs nothing here. The effect only runs once `revealed` (see the
      // SPOILER RULE note above), and the import rides in the same Promise.all
      // as the signals batch and the callouts fetch that already gate this
      // work, so it resolves inside a wait the reveal already had.
      const [{ classifyGameCards }, entries, calloutsData] = await Promise.all([
        import('../api/dayHighlights.js'),
        mapPool(finals, SIGNALS_CONCURRENCY, (game) =>
          getSignals(game.gamePk)
            .then(({ feed, winProb }) => ({ gamePk: game.gamePk, game, feed, winProb, dateStr }))
            .catch(() => null),
        ),
        // Only the finals being classified — the callouts set is one file per
        // game (api/callouts.js), so this asks for the handful of bundles
        // classifyGameCards will actually read, not the whole day's slate.
        fetchCallouts(
          apiDateToUrl(dateStr),
          finals.map((g) => g.gamePk),
        ),
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
  }, [active, finals, dateStr, getSignals])

  // Not derived-state-in-render for the "off" case (no setState call at all,
  // just a constant): while inactive there is nothing in flight to reset —
  // the effect above simply doesn't run — so a fresh reveal only ever sees
  // whatever this same render already returns, never a stale batch from
  // before `revealed` last flipped false.
  return active ? byGamePk : EMPTY_MAP
}
