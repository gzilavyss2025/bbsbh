// The season sheet's groups (#2599): one per run of seasons under one name and league, from the
// franchise-history spans (api/franchiseHistory.js). A span splits at every park change, so
// adjacent spans with the same name and league merge. The file ends at `through`, the season
// before today's, so the last run reaches `current`. Newest group first, newest year first.
export function seasonEras(spans, current) {
  const runs = []
  for (const s of [...(spans ?? [])].sort((a, b) => a.from - b.from)) {
    const last = runs[runs.length - 1]
    if (last && last.name === s.name && last.league === s.league && s.from === last.to + 1) last.to = s.to
    else runs.push({ name: s.name, league: s.league, from: s.from, to: s.to })
  }
  const tail = runs[runs.length - 1]
  if (tail && current > tail.to) tail.to = current
  return runs.reverse().map((r) => ({ ...r, years: Array.from({ length: r.to - r.from + 1 }, (_, i) => r.to - i) }))
}
