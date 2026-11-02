// The scorebug's live snapshot Gameday reads, composed (#2747, row 1b): lifted from HalfInning.jsx.
// Reveal-only (ADR-0001): `live` is deriveLiveState's output and the batter line reads the box score
// through `revealedThrough`. With `live` null it is the entering baseline, which reads only
// spoiler-free selectors (selectDueUpNow, the starter) and may run before anything is revealed.
import { battingSlot, pitchingChangePitcher } from '../../playbyplay.js'
import { selectDueUpNow } from '../../dueup.js'
import { preGameAvg, computeBatterLine } from '../../boxscore.js'
import { liveAtThirdOut } from '../../../lib/scorebug/liveState.js'

// Pitches `nowPitching` had thrown entering the half, from computePitcherLines(feed, halfIndex - 1).
export function enteringPitchesFor(lines, nowPitching) {
  return nowPitching ? [...lines.away, ...lines.home].find((r) => r.id === nowPitching.id)?.pitches : null
}

export function battingLineFor(feed, battingSide, revealedThrough, id) {
  const box = feed?.liveData?.boxscore?.teams?.[battingSide]?.players?.[`ID${id}`]
  if (!box) return null
  // Reveal-gated, NOT box.stats.batting (the always-live true line — see computeBatterLine's doc
  // for why reading that directly would show a batter's real at-bats before they are revealed).
  const { hits, atBats } = computeBatterLine(feed, id, revealedThrough)
  if (atBats > 0 || hits > 0) return `${hits}-${atBats}`
  return preGameAvg(box)
}

export function composeLive(live, { feed, inning, half, battingSide, revealedThrough, windowed, nowPitching, enteringPitches }) {
  const lineFor = (id) => battingLineFor(feed, battingSide, revealedThrough, id)
  const bases = live?.bases ?? { first: false, second: false, third: false }
  const outs = live?.outs ?? 0
  let batter = null
  // Once the last visible at-bat has actually FINISHED (batterDone — false only for a mid-count
  // stoppage, where the same guy is still up) and the half isn't over, the "current" batter is
  // whoever's next in the order, not the one who just finished.
  //
  // NOT WHILE WINDOWED, where that same advance is a contradiction. The whole screen is built around
  // ONE at-bat card, and the band sits directly above it: the hero named ABRAMS while the band beside
  // it said "2. ORTIZ", who has not batted. Who's up next is already answered, in more detail, by
  // DueUpConsole in the same row (which shows only while `currentSealed`). The pitch count is
  // untouched either way: it stays the tally AFTER the at-bat on screen finished.
  if (!windowed && live?.batter && live.batterDone && outs < 3) {
    const finishedSlot = battingSlot(feed, battingSide, live.batter.id)
    const nextSlot = finishedSlot != null ? (finishedSlot >= 9 ? 1 : finishedSlot + 1) : null
    const upcoming =
      nextSlot != null
        ? selectDueUpNow(feed, inning, half, revealedThrough, 9)?.batters?.find((b) => b.slot === nextSlot)
        : null
    if (upcoming) batter = { order: upcoming.slot, last: upcoming.last, line: lineFor(upcoming.id) }
  }
  if (!batter && live?.batter) {
    const slot = battingSlot(feed, battingSide, live.batter.id)
    batter = { order: slot ?? '', last: live.batter.last, line: lineFor(live.batter.id) }
  } else if (!batter) {
    const due = selectDueUpNow(feed, inning, half, revealedThrough, 1)?.batters?.[0]
    if (due) batter = { order: due.slot, last: due.last, line: lineFor(due.id) }
  }
  let pitcher = null
  if (live?.midHalfPitcherId != null) {
    const p = pitchingChangePitcher(feed, live.midHalfPitcherId)
    if (p) pitcher = { last: p.name.split(',')[0], pitches: live.pitchesSoFar ?? 0 }
  } else if (nowPitching) {
    pitcher = { last: nowPitching.name.split(',')[0], pitches: (enteringPitches ?? 0) + (live?.pitchesSoFar ?? 0) }
  }
  // The 3rd out is revealed and the reader has not navigated on: see liveAtThirdOut.
  const last = live?.last ?? null // Gameday's hero keeps the last result
  // Gameday's Pitcher rail and stage read the revealed mid-half change by id (InningViewer's
  // panels, GamedayNextMount's `reliever`); dropped here, the rail named the starter all half.
  const midHalfPitcherId = live?.midHalfPitcherId ?? null
  if (outs >= 3) return { ...liveAtThirdOut({ batter, pitcher, inning, half }), last, midHalfPitcherId }
  return { bases, outs, batter, pitcher, inning, half, last, midHalfPitcherId }
}
