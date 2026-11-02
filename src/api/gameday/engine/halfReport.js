// What PlayByPlay reports up for one half at one step (#2747, row 1b): the pure arithmetic that used
// to sit in PlayByPlay.jsx's render. Reveal-only (ADR-0001): computeHalfInningFeed and the entriesView
// helpers it calls read the whole half, so call it only inside a SealBox reveal render function.
// `stepCap` (ADR-0016) is the one reveal boundary; null once the half is committed.
import {
  buildTrailItems, computeHalfInningFeed, deriveLiveState, focusWindows, lastVisibleAtBatIndex,
  liveCapFor, nextStepBoundary, stepCommitReady, stepTotals,
} from '../../playbyplay.js'

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
