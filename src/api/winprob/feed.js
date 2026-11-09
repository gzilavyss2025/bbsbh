import { getJson } from '../statsapi.js'
import { WIN_PROB_FIELDS } from '../game.js'

// The /winProbability read (one entry per completed play: the cumulative home win %,
// the leverage index and the play), trimmed to WIN_PROB_FIELDS. Null off-MLB or on any
// failure, so callers render nothing.
//
// ONE REQUEST PER GAME, SHARED. Three screens read this feed for the same game: the
// game page's loader (useGameData, for the box score), Gameday's Win % sheet and its
// Pressure meter. Each used to make its own request. Now callers share: callers at the
// same moment wait on one request, and a later caller reuses the last answer if it is
// younger than `maxAgeMs` (default 30s, a live game moving on), or at any age when the
// caller says the game is `final` (its feed no longer changes) AND that answer was
// itself read for a final game: a read from the 9th inning is never kept as the final. `maxAgeMs: 0` asks
// MLB again, and that answer is shared in turn. A failed read (null) is not kept, so
// the next caller tries again. The last few games are kept, not every game visited.
const WP_FRESH_MS = 30_000
const WP_KEEP = 6
const wpCache = new Map() // gamePk -> { at, final, promise }

export function fetchWinProbability(gamePk, { maxAgeMs = WP_FRESH_MS, final = false } = {}) {
  const hit = wpCache.get(gamePk)
  if (hit && ((final && hit.final) || (!final && Date.now() - hit.at < maxAgeMs))) return hit.promise
  const promise = getJson(`/api/v1/game/${gamePk}/winProbability?fields=${WIN_PROB_FIELDS.join(',')}`)
    .then((data) => (Array.isArray(data) ? data : null))
    .catch(() => null)
  wpCache.delete(gamePk)
  wpCache.set(gamePk, { at: Date.now(), final, promise })
  if (wpCache.size > WP_KEEP) wpCache.delete(wpCache.keys().next().value)
  promise.then((data) => {
    if (data == null && wpCache.get(gamePk)?.promise === promise) wpCache.delete(gamePk)
  })
  return promise
}
