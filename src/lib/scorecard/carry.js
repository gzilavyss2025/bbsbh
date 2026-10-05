// THE LENS'S CARRY STRIP (#724, ADR-0092) — pure.
//
// When the batting order wraps (the 9-hitter reaches, then row 1 is up) the
// pane scrolls far up the sheet, and the last result and the runners' boxes
// leave the screen. The strip pins copies of them at the top of the pane so
// the reader can still write them on paper.
//
// `carryBoxes` says WHICH boxes. It reads only the scorecard page's clamped
// `view`, so it names only boxes already open (G8, ADR-0047). `carryShows` says
// WHEN, from rects the hook measured: a row number cannot say where a box is,
// because a bat-around inning widens into columns and a substitute stacks lines
// in the rail (G2).

import { baseWord, halfCards, runnerName, situation } from './situation.js'

const MAX_CARRIED = 3
// Sub-pixel slack: a box measured a fraction of a pixel under the header is
// still in view.
const SLACK = 1

// True when any box is not fully inside the visible paper. `see` is the part
// of the pane a reader can read: below the sticky header, above the foot row,
// right of the rail. All rects are viewport rects (getBoundingClientRect).
export function carryShows(see, rects) {
  return rects.some(
    (r) =>
      r.top < see.top - SLACK ||
      r.bottom > see.bottom + SLACK ||
      r.left < see.left - SLACK ||
      r.right > see.right + SLACK,
  )
}

// The last opened box of this half, then each runner still on base, three at
// most (the last box first, then the runner nearest home). A box that is both
// shows once. { atBatIndex, label, card }; the label is "Varganyi · last · on
// 1st", and a missing name (a minor-league lineup not posted) reads as the
// slot number. A placed extra-innings runner has no atBatIndex and no box of
// his own to copy, so he is not carried.
export function carryBoxes(view, inning, half) {
  const cards = halfCards(view, inning)
  const last = cards.at(-1)?.atBatIndex ?? null
  const { runners } = situation(view, inning, half)
  const ids = [last, ...[...runners].reverse().map((r) => r.atBatIndex)]
  const unique = [...new Set(ids.filter((id) => id != null))].slice(0, MAX_CARRIED)

  const slotOf = new Map()
  for (const s of view?.grid?.slots ?? []) {
    for (const c of Object.values(s.cells)) slotOf.set(c.atBatIndex, s.slot)
  }
  return unique.map((atBatIndex) => {
    const card = cards.find((c) => c.atBatIndex === atBatIndex)
    const runner = runners.find((r) => r.atBatIndex === atBatIndex)
    const name = (runner ? runnerName(card) : card.batter?.last) || `#${slotOf.get(atBatIndex)}`
    const label = [name, atBatIndex === last && 'last', runner && `on ${baseWord(runner.base)}`]
    return { atBatIndex, card, label: label.filter(Boolean).join(' · ') }
  })
}
