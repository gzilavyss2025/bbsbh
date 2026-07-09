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
export function selectWinProbPath(winProb, { throughHalf = Infinity } = {}) {
  if (!Array.isArray(winProb) || winProb.length === 0) return []
  const points = []
  for (const e of winProb) {
    const home = e.homeTeamWinProbability
    const inning = e.about?.inning
    if (typeof home !== 'number' || inning == null) continue
    const half = e.about?.isTopInning ? 'top' : 'bottom'
    if (halfIndex(inning, half) > throughHalf) continue
    points.push({
      home, // home team's win probability at this play, 0–100
      inning,
      half,
      isScoring: !!e.about?.isScoringPlay,
      desc: e.result?.description ?? '',
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
