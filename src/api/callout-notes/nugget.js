// The `nugget` note family (issue #2809): the sentence built from a nugget
// (src/api/nuggets/nuggets.js). "One of 11 pitchers with a shutout, fewer than the 12 people who
// have walked on the moon." The count and the anchor were frozen when the nugget was
// minted; this file only words them. Entering tense (ADR-0014): the caller hands in only
// nuggets dated before the game, and the date cut lives in nuggets/nuggets.js, not here.
//
// Rules (Gary, 2026-11-03; docs/callouts.md, "nugget"):
// - Only the top-ranked nugget on a card gets its anchor (none, if it has none); the rest
//   are plain counts. A plain count shows only at or under its threshold's `plainMax`.
// - No date on a game's own card. The aged lead ("In May, ...") waits for the player-page
//   list, the first surface that shows an older nugget. Never "first", "fastest" or "fewest".
import { thresholdById, GROUP_NOUN } from '../../lib/nuggets/thresholds.js'
import { anchorById, isExpired, relationOf } from '../../lib/anchors/pick.js'
import { SCORE_BASE, magnitudeOf, clampScore } from './shared.js'

const RELATION = { fewer: 'fewer than', equal: 'as many as', more: 'more than' }

// The nugget's anchor as it reads on `date`, or null: still verified and inside its re-check
// window. The relation is worked out from the anchor's count as it reads now, never the one frozen at mint, so a
// changed anchor (a 14th Triple Crown winner) cannot make a note contradict itself.
function liveAnchor(id, date) {
  const a = anchorById(id)
  return a && a.status === 'verified' && !isExpired(a, date) ? a : null
}

// The sentence, without the subject's name (house rule: the card shows it).
export function nuggetText(n, { anchored, date }) {
  const t = thresholdById(n.threshold)
  if (!t) return null
  const noun = GROUP_NOUN[t.group]
  const head = n.count === 1 ? `The only ${noun.one} with ${t.label}` : `One of ${n.count} ${noun.many} with ${t.label}`
  const anchor = anchored ? liveAnchor(n.anchor, date) : null
  if (!anchor) return head
  return `${head}, ${RELATION[relationOf(n.count, anchor.count)]} the ${anchor.count} ${anchor.phrase}`
}

// A count of one earns the whole bonus; twenty or more earns none.
const scoreOf = (count) => clampScore(SCORE_BASE.nugget + magnitudeOf(20 - Math.min(count, 20), 19))

const keyOf = (n) => `nugget-${n.threshold}-${n.player}`

// Notes for one card, best first. `sideOf(playerId)` -> 'away' | 'home' | null. A nugget is a
// once-a-game fact (ONCE_PER_GAME_KINDS), so one this reader already saw (`shownCounts`, the
// ledger's read) is left out here, before the anchor is handed out: the anchor goes to the
// nugget that leads among those still to show. `date`: the game's date, for the anchor's
// re-check window.
export function buildNuggetNotes(list, { sideOf = () => null, shownCounts = null, date = null } = {}) {
  const ranked = (list ?? [])
    .filter((n) => thresholdById(n.threshold) && Number.isInteger(n.count) && n.count > 0 && !(shownCounts?.get(keyOf(n)) > 0))
    .map((n) => ({ n, score: scoreOf(n.count) }))
    .sort((a, b) => b.score - a.score || b.n.date.localeCompare(a.n.date) || a.n.player - b.n.player)
  const notes = []
  for (const { n, score } of ranked) {
    const anchored = notes.length === 0 && liveAnchor(n.anchor, date) != null
    if (!anchored && n.count > thresholdById(n.threshold).plainMax) continue
    notes.push({
      text: nuggetText(n, { anchored, date }),
      personId: n.player,
      side: sideOf(n.player),
      kind: 'nugget',
      dedupeKey: keyOf(n),
      score,
    })
  }
  return notes
}
