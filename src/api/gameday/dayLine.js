// Day lines for Gameday (#2606): the batter's line for today and the pitcher's
// line for today, as of the step the reader has tapped to — never one step
// further. REVEAL-ONLY (ADR-0001): a line names results ("2-for-3"), so call it
// only inside a SealBox's reveal render function (ADR-0002).
//
// THE CLAMP. The reader stands at `step` of half (`inning`, `half`) — `step` is
// the same entry count PlayByPlay passes computeHalfInningFeed as its `stepCap`
// (ADR-0016), or null for a half already committed in full. Every half BEFORE
// that one is revealed by construction: the only half a reader can step through
// is at or under revealedThrough + 1, and a half past that returns null here.
// The current half reads its first `step` entries, built WITH that cap, so a
// later play's write-back (a run scored two batters on, an out on the bases)
// never lands on a card the reader has already seen. Same two-job rule
// scorecardGame.js follows: the cap stops the write-back, the slice drops the
// cards past the cursor. There is no uncapped variant (the same footing as
// expressDeck in ../expresslane/runners.js).
//
// What counts, decided against the captured real game (gamePk 823035,
// test/fixtures/game-823035.trimmed.json):
//  - Earlier halves count, all of them: a batter's day is his whole game.
//  - The batter is the card's OWNER (`card.batterId`, computeHalfInningFeed's
//    credited batter), so a pinch hitter's plate appearance is his own line.
//  - An INTERRUPTED card (the half ended on the bases mid-count) and the extra-
//    inning placed runner are no plate appearance and count for nothing.
//  - A runner thrown out on the bases later changes nothing here: his at-bat
//    already counted, and an out on the bases is no batting stat. A run is the
//    runner's own (a pinch runner's, a placed runner's), from the plays on
//    screen.
//  - The live, still-open plate appearance counts for nothing until it ends.
//  - The pitcher's line is computePitcherLines' own step clamp (../pitchers.js,
//    via its `throughAtBatIndex`), cut at the last plate appearance on screen.
//    A pitcher who enters mid-half starts his line at his first batter, and an
//    inherited runner's run stays charged to the pitcher who put him on. A
//    baserunning out that leads the NEXT card (a caught stealing mid-count)
//    joins the pitcher's outs when that card's play is on screen — late by one
//    tap at most, never early.
//
// MiLB and thin feeds: every field reads with a fallback, and a missing
// player returns null rather than a line of zeros.

import { computePitcherLines } from '../pitchers.js'
import { halfIndex } from '../select.js'
import { NON_AB_EVENTS } from '../scorecard/notation.js'
import { visibleAtBatCards, stepCutAtBatIndex, safeStep } from './stepCut.js'

// Every at-bat card the reader may see, oldest first: whole earlier halves of
// this batting side, then the current half up to `step`.
function visibleCards(feed, inning, half, step) {
  const cards = []
  for (let inn = 1; inn < inning; inn++) cards.push(...visibleAtBatCards(feed, inn, half, null))
  cards.push(...visibleAtBatCards(feed, inning, half, step))
  return cards
}

// Runs he scored himself, read off each on-screen play's runners: earlier
// halves whole, the reader's half up to the cut. Not off the card's `scored`,
// which a pinch runner's run lands on (his card is the batter's he ran for;
// gamePk 823035, top 7th, 669003 for 641343), and which the placed runner's
// card never reaches.
function runsScored(feed, personId, here, cut) {
  let r = 0
  for (const play of feed?.liveData?.plays?.allPlays ?? []) {
    const inn = play?.about?.inning
    const h = play?.about?.halfInning
    if (!inn || !h) continue
    const i = halfIndex(inn, h)
    if (i > here) break
    if (i === here && (play.about?.atBatIndex ?? Infinity) > cut) continue
    for (const leg of play.runners ?? []) {
      if (leg?.details?.runner?.id === personId && leg.movement?.end === 'score' && !leg.movement?.isOut) r += 1
    }
  }
  return r
}

// The batter's line for today, or null when he has no plate appearance on
// screen yet (or the half is out of reach). Shape:
// { id, pa, ab, h, hr, bb, k, hbp, rbi, r }.
export function batterDayLine(feed, batterId, { inning, half, step = null, revealedThrough }) {
  if (batterId == null || !inning || !half) return null
  const here = halfIndex(inning, half)
  if (here > (revealedThrough ?? -1) + 1) return null
  step = safeStep(step, here, revealedThrough)
  const line = { id: batterId, pa: 0, ab: 0, h: 0, hr: 0, bb: 0, k: 0, hbp: 0, rbi: 0, r: 0 }
  line.r = runsScored(feed, batterId, here, stepCutAtBatIndex(feed, inning, half, step))
  for (const card of visibleCards(feed, inning, half, step)) {
    if (card.batterId !== batterId) continue
    // The live, still-open plate appearance has no result yet: not counted.
    if (card.interrupted || card.live) continue
    const et = card.eventType ?? ''
    line.pa += 1
    if (!NON_AB_EVENTS.has(et)) line.ab += 1
    if (card.codeKind === 'hit') line.h += 1
    if (et === 'home_run') line.hr += 1
    if (et === 'walk' || et === 'intent_walk') line.bb += 1
    if (et.startsWith('strikeout')) line.k += 1
    if (et === 'hit_by_pitch') line.hbp += 1
    line.rbi += card.rbi ?? 0
  }
  return line.pa > 0 || line.r > 0 ? line : null
}

// The pitcher's line for today, or null when he has thrown nothing on screen
// yet. Shape: computePitcherLines' row — { id, last, first, jersey, hand, ip,
// pitches, bf, h, r, er, bb, k }.
export function pitcherDayLine(feed, pitcherId, { inning, half, step = null, revealedThrough }) {
  if (pitcherId == null) return null
  const lines = pitchingDayLines(feed, { inning, half, step, revealedThrough })
  return [...lines.away, ...lines.home].find((row) => row.id === pitcherId) ?? null
}

// Every pitcher's line for today, both clubs, as of the step: the scorebook's pitching page (Gary,
// 2026-10-28). { away: [...], home: [...] } in the order each club's pitchers entered, rows as above;
// both empty past the reader's reach.
export function pitchingDayLines(feed, { inning, half, step = null, revealedThrough }) {
  if (!inning || !half) return { away: [], home: [] }
  const here = halfIndex(inning, half)
  if (here > (revealedThrough ?? -1) + 1) return { away: [], home: [] }
  step = safeStep(step, here, revealedThrough)
  // -1 admits nothing from this half: the lines are the earlier halves' alone.
  const cut = stepCutAtBatIndex(feed, inning, half, step)
  return computePitcherLines(feed, here - 1, { stepHalfIndex: here, throughAtBatIndex: cut })
}
