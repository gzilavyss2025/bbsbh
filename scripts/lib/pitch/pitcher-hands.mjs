// Which way each pitcher throws, for the player page's "Pitches like" card
// (src/lib/pitcherSimilarity.js), where it's a hard filter — a lefty and a
// righty with the same repertoire are not a useful answer to "who pitches like
// this guy". Moved out of gen-pitch-arsenal.mjs, which is at its size budget.
//
// Resolved at EXPORT time from one bulk call per level rather than stored per
// game in pitch_arsenal_totals, which is why this needs no schema change and no
// backfill: every pitcher already on file gains a hand on the very next run,
// including every row swept before this existed. A per-game column would only
// have filled in as each pitcher next happened to appear.
//
// ~50 KB per level and never fatal — a failed lookup means the card filters
// more conservatively for a run (an unknown hand is skipped, never guessed),
// not that the sweep fails.
import { getJson } from '../statsapi.mjs'

export async function fetchPitcherHands(sportIds, season) {
  const hands = {}
  for (const sportId of sportIds) {
    try {
      const data = await getJson(
        `/api/v1/sports/${sportId}/players?season=${season}&fields=people,id,pitchHand,code`,
      )
      for (const p of data?.people ?? []) {
        const code = p?.pitchHand?.code
        if (p?.id != null && (code === 'L' || code === 'R')) hands[p.id] = code
      }
    } catch (err) {
      console.error(`pitcher hands (sportId ${sportId}): ${err.message}`)
    }
  }
  return hands
}
