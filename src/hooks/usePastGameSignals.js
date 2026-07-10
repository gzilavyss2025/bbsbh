import { useCallback } from 'react'
import { fetchGameFeed, fetchWinProbability } from '../api/game.js'

// A past, Final game's result never changes, so once its feed + win
// probability are fetched they're cached for the tab's lifetime — shared
// across every FlipCard and the Day Highlights/Top Performers fan-out so two
// consumers of the same gamePk never both pay for the fetch. Module-level
// (not per-component state) since gamePks are globally unique.
const cache = new Map()

function loadSignals(gamePk) {
  if (!cache.has(gamePk)) {
    cache.set(
      gamePk,
      Promise.all([fetchGameFeed(gamePk), fetchWinProbability(gamePk)]).then(
        ([feed, winProb]) => ({ feed, winProb }),
      ),
    )
  }
  return cache.get(gamePk)
}

// Returns a stable `getSignals(gamePk) -> Promise<{feed, winProb}>` loader.
// Score-revealing (the feed IS the game), so only ever call this from inside
// a reveal — a SealBox's render function or a FlipCard's onReveal.
export function usePastGameSignals() {
  return useCallback((gamePk) => loadSignals(gamePk), [])
}
