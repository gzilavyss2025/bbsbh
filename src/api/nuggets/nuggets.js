// The nugget store's reader (issue #2809): public/data/nuggets/{season}.json, written
// nightly by scripts/gen-nuggets.mjs. A nugget is the first day a player's season total
// met a named threshold (src/lib/nuggets/thresholds.js), with the count and anchor frozen.
//
// SPOILER FOOTING. A nugget's date is a game date, so the date is the spoiler: a nugget
// dated D says the player did something on D. The store holds no score, but on a scoring
// surface only nuggets dated BEFORE the game's own date may come back (entering tense,
// ADR-0014, ADR-0088). The cut is HERE, in `nuggetsForGame`, not in its callers, and
// test/nugget-notes.test.js pins it. A game card also shows only the last
// CARD_WINDOW_DAYS days (Gary, 2026-11-03).
import { staticJsonBy } from '../staticJson.js'
import { shiftDays } from '../../lib/time/standingsDates.js'

export const CARD_WINDOW_DAYS = 7

const read = staticJsonBy((season) => `/data/nuggets/${season}.json`, { fallback: null })

// One season's store, or null (no file yet, a MiLB-only season, a failed read).
export const loadNuggets = (season) => (/^\d{4}$/.test(String(season ?? '')) ? read(season) : Promise.resolve(null))

// The nuggets a game card may show: for `players`, dated strictly before `gameDate` and
// no more than CARD_WINDOW_DAYS before it. Each carries its threshold id.
export function nuggetsForGame(store, { gameDate, players }) {
  if (!store?.nuggets || !/^\d{4}-\d{2}-\d{2}$/.test(String(gameDate ?? ''))) return []
  const ids = new Set((players ?? []).filter((id) => id != null).map(Number))
  if (!ids.size) return []
  const from = shiftDays(gameDate, -CARD_WINDOW_DAYS)
  const out = []
  for (const [threshold, list] of Object.entries(store.nuggets)) {
    for (const n of list ?? []) {
      if (ids.has(Number(n.player)) && n.date < gameDate && n.date >= from) out.push({ threshold, ...n })
    }
  }
  return out
}
