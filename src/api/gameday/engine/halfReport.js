// What PlayByPlay reports up for one half at one step (#2747, row 1b): the pure arithmetic that used
// to sit in PlayByPlay.jsx's render. Reveal-only (ADR-0001): computeHalfInningFeed and the entriesView
// helpers it calls read the whole half, so call it only inside a SealBox reveal render function.
// `stepCap` (ADR-0016) is the one reveal boundary; null once the half is committed.
import {
  buildTrailItems, computeHalfInningFeed, deriveLiveState, focusWindows, lastVisibleAtBatIndex,
  liveCapFor, nextStepBoundary, stepCommitReady, stepTotals,
} from '../../playbyplay.js'

// The pieces, from PlayByPlay.jsx (where each comment used to sit):
//  - Pass stepCap through to computeHalfInningFeed so a runner advance or out on a later, not-yet-
//    revealed play is not written back onto an earlier card's diamond.
//  - The cap snap: the first tap into a fresh half hardcodes stepCap to 1 (InningViewer cannot know
//    what entries[0] is: computeHalfInningFeed is reveal-only). If entries[0] is a leading event note,
//    that tap would strand the note without a batter, so the cap snaps past the first at-bat card, and
//    the entries are rebuilt at the corrected cap. Gameday's stepCapAt (steps/subStep.js) snaps the
//    count itself and may hold a change back.
//  - The commit test is stepCommitReady (entriesView.js: three conditions, one the live-half hold,
//    ADR-0016/0055).
//  - Focus windows: one per revealed AT-BAT (focusWindows), clamped to the cap, built for a stacked
//    half too (the trail needs the boundaries). The cap is `effectiveCap ?? entries.length`, which
//    carries the windows PAST the commit: the last at-bat commits the half, dropping `stepCap` to
//    null, and the windows must not go with it or the tap that revealed the 3rd out would dump the
//    whole half on screen. Past the commit the whole half is already revealed.
export function halfReport(feed, inning, half, battingSide, stepCap, { halfInProgress = false, windowed = false, focusStep = null, codeOf = () => undefined } = {}) {
  const stepping = stepCap != null
  const rawEntries = computeHalfInningFeed(feed, inning, half, battingSide, stepCap)
  // The first tap into a fresh half hardcodes stepCap to 1: snap it past the first at-bat card, and
  // rebuild the entries at the corrected cap so the bundled card keeps its diamond.
  const effectiveCap = stepping ? Math.max(stepCap, rawEntries.findIndex((e) => e.kind === 'atbat') + 1) : stepCap
  const entries = effectiveCap > stepCap ? computeHalfInningFeed(feed, inning, half, battingSide, effectiveCap) : rawEntries
  const exhausted = stepping && stepCommitReady(entries, effectiveCap, halfInProgress)

  // Windows are cut at the cap, or the full array once committed (the post-half hold).
  const wins = focusWindows(entries, effectiveCap ?? entries.length)
  const items = buildTrailItems(entries, wins, codeOf)
  const { runs, hits } = stepTotals(entries, effectiveCap)

  // The step report: only while stepping, and not on the commit tap.
  const reporting = stepping && entries.length > 0 && !exhausted
  const nextCap = reporting ? nextStepBoundary(entries, effectiveCap) : null

  // The scorebug's snapshot follows the window on screen, not only the cap (liveCapFor says why).
  const revealCap = effectiveCap ?? entries.length
  const liveCap = liveCapFor({ wins, focusStep, windowed, effectiveCap, entriesLength: entries.length })
  const liveEntries = liveCap === revealCap ? entries : computeHalfInningFeed(feed, inning, half, battingSide, liveCap)

  return {
    entries, wins, effectiveCap, exhausted,
    nextCap,
    isLastStep: reporting && nextCap >= entries.length,
    lastAtBatIndex: reporting ? lastVisibleAtBatIndex(entries, effectiveCap) : null,
    atHalfEdge: reporting && effectiveCap >= entries.length, // caught up to a half still in play (ADR-0055)
    runs, hits,
    steps: wins.length, items,
    liveCap, live: deriveLiveState(liveEntries, liveCap),
  }
}
