// The `nugget` note family (issue #2809): the sentence built from a nugget
// (src/api/nuggets/nuggets.js). "One of 11 pitchers with a shutout, fewer than the 12 people who
// have walked on the moon." The count and the anchor were frozen when the nugget was
// minted; this file only words them. Entering tense (ADR-0014): the caller hands in only
// nuggets dated before the game, and the date cut lives in nuggets/nuggets.js, not here.
//
// Rules (Gary, 2026-11-03; docs/callouts.md, "nugget"):
// - Only the top-ranked nugget on a card gets its anchor; the rest are plain counts.
// - A plain count shows only at or under its threshold's `plainMax`.
// - No date on a game's own card. Elsewhere `viewDate` ages the lead: a month name later
//   that season, the year after it. Never "first", "fastest" or "fewest".
import { thresholdById, GROUP_NOUN } from '../../lib/nuggets/thresholds.js'
import { anchorById } from '../../lib/anchors/pick.js'
import { SCORE_BASE, magnitudeOf, clampScore } from './shared.js'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const RELATION = { fewer: 'fewer than', equal: 'as many as', more: 'more than' }
const DAY_MS = 86_400_000

// The aged lead for a nugget dated `date` read on `viewDate`: '' the day after (or with
// no viewDate), "In May, " later that season, "In 2026, " in a later season.
export function agedLead(date, viewDate) {
  if (!viewDate || !date) return ''
  if (viewDate.slice(0, 4) !== date.slice(0, 4)) return `In ${date.slice(0, 4)}, `
  if (Date.parse(viewDate) - Date.parse(date) <= DAY_MS) return ''
  return `In ${MONTHS[Number(date.slice(5, 7)) - 1]}, `
}

// The sentence, without the subject's name (house rule: the card shows it).
export function nuggetText(n, { anchored, viewDate = null }) {
  const t = thresholdById(n.threshold)
  if (!t) return null
  const noun = GROUP_NOUN[t.group]
  const head = n.count === 1 ? `The only ${noun.one} with ${t.label}` : `One of ${n.count} ${noun.many} with ${t.label}`
  const lead = agedLead(n.date, viewDate)
  const first = lead ? `${lead}${head[0].toLowerCase()}${head.slice(1)}` : head
  const anchor = anchored ? anchorById(n.anchor) : null
  if (!anchor || !RELATION[n.relation]) return first
  return `${first}, ${RELATION[n.relation]} the ${anchor.count} ${anchor.phrase}`
}

// A count of one earns the whole bonus; twenty or more earns none.
const scoreOf = (count) => clampScore(SCORE_BASE.nugget + magnitudeOf(20 - Math.min(count, 20), 19))

// Notes for one card, best first. `sideOf(playerId)` -> 'away' | 'home' | null.
export function buildNuggetNotes(list, { sideOf = () => null, viewDate = null } = {}) {
  const ranked = (list ?? [])
    .filter((n) => thresholdById(n.threshold) && Number.isInteger(n.count) && n.count > 0)
    .map((n) => ({ n, score: scoreOf(n.count) }))
    .sort((a, b) => b.score - a.score || b.n.date.localeCompare(a.n.date) || a.n.player - b.n.player)
  const notes = []
  let anchorUsed = false
  for (const { n, score } of ranked) {
    const anchored = !anchorUsed && anchorById(n.anchor) != null
    if (!anchored && n.count > thresholdById(n.threshold).plainMax) continue
    if (anchored) anchorUsed = true
    notes.push({
      text: nuggetText(n, { anchored, viewDate }),
      personId: n.player,
      side: sideOf(n.player),
      kind: 'nugget',
      dedupeKey: `nugget-${n.threshold}-${n.player}`,
      score,
    })
  }
  return notes
}
