import { useCallback } from 'react'
import { fetchGameFeed, fetchWinProbability, PAST_GAME_FEED_FIELDS } from '../api/game.js'

// A past, Final game's result never changes, so once its feed and win
// probability are fetched they're cached for the tab's lifetime, so two
// consumers of the same gamePk never both pay for the fetch. Module-level
// (not per-component state) since gamePks are globally unique. The two reads
// cache apart, so a caller that wants only the feed (Stamp In) never pays for
// the win probability.
const feeds = new Map()
const winProbs = new Map()

function cached(cache, gamePk, load) {
  if (!cache.has(gamePk)) {
    const pending = load(gamePk)
    // Only a FULFILLED result is the immutable Final we mean to cache for the
    // tab's lifetime. A transient failure (the flaky-ballpark-connection case)
    // must NOT stick — evict the rejected promise so the next reveal re-fetches
    // instead of replaying "Couldn't load this game" forever.
    pending.catch(() => {
      if (cache.get(gamePk) === pending) cache.delete(gamePk)
    })
    cache.set(gamePk, pending)
  }
  return cache.get(gamePk)
}

// Pruned to this path's exact read-set (see PAST_GAME_FEED_FIELDS' header) —
// a revealed list fetches one feed per final game, so the full ~760 KB
// response × 16 games was the app's single largest network event.
const loadFeed = (gamePk) => fetchGameFeed(gamePk, { fields: PAST_GAME_FEED_FIELDS })

// Returns a stable `getSignals(gamePk, { winProb = true }) -> Promise<{feed, winProb}>`
// loader; `winProb: false` skips that read and hands back `winProb: null`.
// Score-revealing (the feed IS the game), so only ever call this from inside
// a reveal — a SealBox's render function or a FlipCard's onReveal.
export function usePastGameSignals() {
  return useCallback(
    (gamePk, { winProb = true } = {}) =>
      Promise.all([
        cached(feeds, gamePk, loadFeed),
        winProb ? cached(winProbs, gamePk, fetchWinProbability) : null,
      ]).then(([feed, wp]) => ({ feed, winProb: wp })),
    [],
  )
}
