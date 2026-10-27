import { computeHalfInningFeed, nextStepBoundary } from '../../../../api/playbyplay.js'
import { lineupEntering } from '../../../../api/battingorder.js'
import { battingSideOf } from '../../../../api/gameday/stepCut.js'

// What the panels read at the reader's cursor. REVEAL-ONLY (cutAt): call it inside a SealBox
// reveal render function, as the panels do.

// A called third strike has no code of its own (scorebookCode.js); the chip says K, as the trail does.
export const chipCode = (card) => card.code || (card.calledLooking ? 'K' : '')

// The at-bat cards on screen at `step`, at the cap PlayByPlay renders (a first entry that is a note
// bundles forward to the first at-bat), and whether the half has plays left. `step` null: committed.
export function cutAt(feed, inning, half, step) {
  if (step === 0) return { cards: [], cap: 0, more: true } // a reached half with nothing stepped yet
  const side = battingSideOf(half)
  let entries = computeHalfInningFeed(feed, inning, half, side, step)
  if (step == null) return { cards: entries.filter((e) => e.kind === 'atbat'), cap: null, more: false }
  const cap = Math.max(step, nextStepBoundary(entries, 0))
  if (cap > step) entries = computeHalfInningFeed(feed, inning, half, side, cap)
  return { cards: entries.slice(0, cap).filter((e) => e.kind === 'atbat'), cap, more: entries.length > cap }
}

// The batting order entering the half (lineupEntering gates itself), each slot with the codes of
// every at-bat on screen by anyone who held it, so a pinch hitter's at-bat stays on its row.
export function orderAt(feed, side, inning, half, mark, cards) {
  const slotOf = (id) => Math.floor(Number(feed?.liveData?.boxscore?.teams?.[side]?.players?.[`ID${id}`]?.battingOrder) / 100)
  return (lineupEntering(feed, side, inning, half, mark) ?? []).map(({ slot, entries }) => {
    const now = entries.at(-1)
    const mine = cards.filter((c) => slotOf(c.batter?.id) === slot)
    // `trip` is his latest at-bat when he reached on it (the diamond reads its legs); `outcome` is its code
    // when he did not (K, F9), drawn in the diamond's column.
    const latest = mine.at(-1) ?? null
    const trip = latest && (latest.reached > 0 || latest.scored) ? latest : null
    const outcome = latest && !trip ? chipCode(latest) || null : null
    return { slot, id: now.id, last: now.last, first: now.first, jersey: now.jersey, position: now.position, codes: mine.map(chipCode), trip, outcome }
  })
}
