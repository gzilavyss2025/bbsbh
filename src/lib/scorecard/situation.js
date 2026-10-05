// The lens bar's situation and half totals (#724): "Top 3 · 1 out · on 2nd,
// 3rd" while a half is stepped, and "Top 3 · 1 R · 1 H · 0 E · 1 LOB" once it
// has committed.
//
// READS ONLY THE CLAMPED VIEW. Every function here takes the scorecard page's
// own `view` (scorecardFull, built at the reader's reveal mark and step
// cursor) or cards off it, never the feed. A box past the clamp is not in that
// view, so nothing here can count an out, a runner or a run the reader has not
// opened (ADR-0047). The step cap already set each card's reached / scored /
// outAt as of the cursor (ADR-0016, ADR-0072), so the runners are the runners
// at that cursor. A steal during the NEXT plate appearance leads the next
// step (ADR-0016's midAtBat), so it is correctly not here yet.
//
// The view is ONE side's page: pass the view of the side that bats `half`.

import { runnersOnBase } from '../../api/expresslane/runners.js'

export const baseWord = (base) => ['', '1st', '2nd', '3rd', 'home'][base] ?? ''

// The man on base as the sheet names him: the last pinch runner in the chain
// (halfInningFeed adds one only once his notice is opened), else the placed
// runner, else the batter.
export const runnerName = (card) =>
  card.pinchRunners?.at(-1)?.last ?? (card.kind === 'placed' ? card.runner?.last : card.batter?.last) ?? ''

export const halfLabel = ({ inning, half }) => `${half === 'bottom' ? 'Bottom' : 'Top'} ${inning}`

// The opened boxes of one inning on this page, in the order they were batted.
// The extra-innings placed runner has no atBatIndex and goes first.
export function halfCards(view, inning) {
  const { columns = [], slots = [] } = view?.grid ?? {}
  const cards = []
  for (const slot of slots) {
    for (const [ci, card] of Object.entries(slot.cells ?? {})) {
      if (columns[ci]?.inning === inning) cards.push(card)
    }
  }
  return cards.sort((a, b) => (a.atBatIndex ?? -1) - (b.atBatIndex ?? -1))
}

// Outs and runners after the last opened step of this half. `bases` is the
// bases held, low to high; `runners` names the man on each, for the carry
// strip. An out's number is the feed's own count in the half, so the highest
// one is the outs so far.
//
// THIS IS A COPY, on purpose, of deriveLiveState (api/playbyplay/entriesView.js),
// which the innings viewer's scorebug uses. That one reads the half's feed
// entries; this one may read only the clamped cards (the header above, and the
// spoiler manifest's entry for expresslane/runners.js), so one helper cannot
// serve both. test/scorecard-lens-situation-parity.test.js walks a real game and
// fails if the two ever give a different answer. Fix both, or neither.
export function situation(view, inning, half) {
  const cards = halfCards(view, inning)
  const runners = runnersOnBase(cards)
    .reverse()
    .map(({ base, card }) => ({ base, name: runnerName(card), atBatIndex: card.atBatIndex ?? null }))
  return {
    inning,
    half,
    outs: Math.max(0, ...cards.map((c) => c.outNumber ?? 0)),
    bases: runners.map((r) => r.base),
    runners,
  }
}

export function situationText(s) {
  if (!s) return ''
  const outs = s.outs === 0 ? 'no outs' : s.outs === 1 ? '1 out' : `${s.outs} outs`
  // Three outs end the half: runners left on base are not on a base for the
  // next play, so the line names no bases (#1468). The handoff's totals carry LOB.
  if (s.outs >= 3) return `${halfLabel(s)} · ${outs}`
  const bases = s.bases.length ? `on ${s.bases.map(baseWord).join(', ')}` : 'bases empty'
  return `${halfLabel(s)} · ${outs} · ${bases}`
}

// R / H / E / LOB for a half, or null until it has committed. The committed
// line is the sheet's own P/WH/FO row (`perInning`, which inks on revealTo),
// and `endsHalf` is the inning-end slash, so a half that is committed but
// still live shows no totals (ADR-0055). E is the fielding club's errors in
// this half (ADR-0006); scorecardPlays reads it that way.
export function halfTotals(view, inning, half) {
  const line = view?.grid?.perInning?.[inning]
  if (!line || !halfCards(view, inning).some((c) => c.endsHalf)) return null
  return { inning, half, r: line.runs, h: line.hits, e: line.errors, lob: line.lob }
}

export function totalsText(t) {
  return t ? `${halfLabel(t)} · ${t.r} R · ${t.h} H · ${t.e} E · ${t.lob} LOB` : ''
}
