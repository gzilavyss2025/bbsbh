// Win-probability path — the shaped input for the win-probability chart
// (WinProbChart). REVEAL-ONLY, the same rule as linescore.js / derive.js
// (ADR-0001): a team's in-game win % is score-revealing (a 4% away win prob in
// the 8th says the game is all but over), so this is only ever called from a
// spot that already honors the seal —
//   • inside the box score's SealBox reveal render (full game), or
//   • gated by `revealedThrough` in the innings view (through the revealed half
//     only), the same high-water-mark gate the Pitchers table and running line
//     use (ADR-0009).
// Never call it at render top-level or in an eager useMemo over the whole feed.
//
// Source: the separate /api/v1/game/{gamePk}/winProbability endpoint
// (fetchWinProbability in api/game.js) — one entry per completed play, carrying
// the cumulative `homeTeamWinProbability` (0–100; the away share is 100 − that),
// its `about` (inning / isTopInning / isScoringPlay) and the play description.
// Absent at most MiLB parks, where the endpoint resolves null — this then
// returns [] and the chart renders nothing (graceful MiLB degrade).

import { halfIndex } from './select.js'

// Ordered chart points from the raw win-probability array. `throughHalf` clamps
// to a reveal high-water mark (a half-index; see halfIndex): only plays in a
// half at or below it are included, so the innings view can draw the line as it
// stands "so far" without ever plotting a sealed half. Default Infinity = whole
// game (the box score, already behind its own seal).
//
// `stepHalfIndex`/`throughAtBatIndex` extend that clamp one notch finer, for
// the ONE half currently being STEPPED through one at-bat at a time (ADR-0016)
// rather than committed whole. `throughAtBatIndex` is the atBatIndex (matches
// `about.atBatIndex`, present on both this array's entries and the play-by-
// play's own) of the last entry PlayByPlay has actually rendered for that
// half — reported back via its onStepInfo, never guessed here, since this
// module can't see the reveal-only play-by-play entries itself (ADR-0001).
// Leaving both at their null default reproduces the old whole-halves-only
// behavior exactly.
//
// `stepHalfIndex` is honored ONLY when it's exactly `throughHalf + 1` — the
// single half immediately after the reveal mark — never any half further out.
// ADR-0016's stepping cursor is keyed to whatever half the user is VIEWING,
// which (per RollingLine's own half-inning navigator) can be any unlocked
// regulation half regardless of revealedThrough: a user can jump straight to,
// say, bottom 8 and start stepping it with nothing else revealed. Every other
// reveal-only surface tolerates that navigation because each half's own data
// is self-contained, but win probability is CUMULATIVE — a single plotted
// point from bottom 8 encodes the whole game's trajectory up to that moment,
// not just that half's own events. Without this adjacency check, stepping a
// non-adjacent half would plot a full-game spoiler through nothing but a bare
// "Next at-bat" tap. This guard lives here, not just in the caller, so it
// holds regardless of what any future caller passes in.
export function selectWinProbPath(
  winProb,
  { throughHalf = Infinity, stepHalfIndex = null, throughAtBatIndex = null } = {},
) {
  if (!Array.isArray(winProb) || winProb.length === 0) return []
  const steppingHalfIdx = stepHalfIndex === throughHalf + 1 ? stepHalfIndex : null
  const points = []
  for (const e of winProb) {
    const home = e.homeTeamWinProbability
    const inning = e.about?.inning
    if (typeof home !== 'number' || inning == null) continue
    const half = e.about?.isTopInning ? 'top' : 'bottom'
    const atBatIndex = e.about?.atBatIndex ?? null
    const hIdx = halfIndex(inning, half)
    if (hIdx > throughHalf) {
      const withinStep =
        steppingHalfIdx != null &&
        hIdx === steppingHalfIdx &&
        throughAtBatIndex != null &&
        atBatIndex != null &&
        atBatIndex <= throughAtBatIndex
      if (!withinStep) continue
    }
    points.push({
      home, // home team's win probability at this play, 0–100
      inning,
      half,
      isScoring: !!e.about?.isScoringPlay,
      desc: e.result?.description ?? '',
      atBatIndex,
    })
  }
  return points
}

// The current (or final) win-probability split, for the chart's caption and
// accessible summary. Reads only the LAST plotted point, so it inherits the
// caller's reveal gate. Null when there's nothing to show.
export function winProbSplit(points) {
  if (!points || points.length === 0) return null
  const home = Math.round(points[points.length - 1].home)
  return { home, away: 100 - home }
}

// The game opens even — 0–0 at first pitch — so the first play's delta is
// measured from a 50% home share, matching WinProbChart's synthetic origin.
const EVEN = 50

// The biggest momentum plays so far, newest first — the "how we got here"
// ledger. Each entry is a single play's per-play delta (home share vs. the play
// before it, the first measured from even), kept only if it cleared a swing
// threshold, then the top `limit` by magnitude, re-sorted newest-first for
// display. REVEAL-ONLY (same `throughHalf` clamp); [] when there's no data.
export function selectWinProbBigPlays(
  winProb,
  { throughHalf = Infinity, stepHalfIndex = null, throughAtBatIndex = null, limit = 4, minSwing = 8 } = {},
) {
  const points = selectWinProbPath(winProb, { throughHalf, stepHalfIndex, throughAtBatIndex })
  if (points.length === 0) return []
  let prev = EVEN
  const plays = []
  for (let idx = 0; idx < points.length; idx++) {
    const p = points[idx]
    const delta = p.home - prev
    prev = p.home
    if (Math.abs(delta) >= minSwing) {
      plays.push({ idx, delta, home: p.home, inning: p.inning, half: p.half, desc: p.desc })
    }
  }
  return plays
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, limit)
    .sort((a, b) => b.idx - a.idx) // newest first for the ledger
}
