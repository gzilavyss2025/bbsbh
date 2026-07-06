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

// Full-game R / H / E totals for the global reveal.
export function revealTotals(feed, side) {
  const t = feed?.liveData?.linescore?.teams?.[side]
  if (!t) return null
  return {
    runs: t.runs ?? 0,
    hits: t.hits ?? 0,
    errors: t.errors ?? 0,
  }
}
