// Score-revealing selectors. IMPORTANT (spoiler rule): callers must only
// invoke these when the user has tapped to reveal — the returned numbers must
// never be rendered into the DOM while a box is still sealed.

// Per-inning, per-side R / H / E / LOB straight from the linescore. `side` is
// 'away' or 'home'; `inningNum` is 1-based.
export function revealInning(feed, inningNum, side) {
  const innings = feed?.liveData?.linescore?.innings ?? []
  const inning = innings.find((i) => i.num === inningNum)
  const half = inning?.[side]
  if (!half) return null
  return {
    runs: half.runs ?? 0,
    hits: half.hits ?? 0,
    errors: half.errors ?? 0,
    leftOnBase: half.leftOnBase ?? 0,
  }
}

// Full-game R / H / E / LOB totals for the global reveal — the box score's
// LineTotals card reads this directly rather than re-deriving the same
// liveData.linescore.teams[side] fields itself (see boxscore.js's teamLine).
export function revealTotals(feed, side) {
  const t = feed?.liveData?.linescore?.teams?.[side]
  if (!t) return null
  return {
    runs: t.runs ?? 0,
    hits: t.hits ?? 0,
    errors: t.errors ?? 0,
    leftOnBase: t.leftOnBase ?? 0,
  }
}

// Runs THROUGH the reveal mark for one side — the "score as of your own
// reveal progress" figure RollingLine's own running-line total already shows
// (its per-side `totals()`), exposed here so another reveal-gated surface
// (the scorebug) can read the same number without re-deriving it a second
// way inline. Deliberately NOT `revealTotals` above, which is the FULL-GAME
// final and would spoil a game the user hasn't finished revealing — this
// sums only the innings whose BATTING half (the side's own half-type: top
// for away, bottom for home) is at or below `revealedThrough`, same gate
// RollingLine's `r`/`h` totals use.
export function revealRunsThrough(feed, unlocked, revealedThrough, side) {
  const battingHalf = side === 'away' ? 'top' : 'bottom'
  let r = 0
  for (let n = 1; n <= unlocked; n++) {
    const idx = (n - 1) * 2 + (battingHalf === 'top' ? 0 : 1)
    if (idx > revealedThrough) continue
    r += revealInning(feed, n, side)?.runs ?? 0
  }
  return r
}
