// The merge behind gen-manager-history.mjs's partial runs (--current-only and
// --from/--to). Kept here because a generator file runs on import and cannot be
// unit-tested (scripts/CLAUDE.md).

// Swap the swept seasons into the carried-forward store: drop every stored
// stint inside [from, to], keep the rest, splice the fresh rows in. A person
// left with no stints is dropped.
export function mergeSeasonRange(existing, fresh, from, to) {
  const bySeason = (a, b) => a.season - b.season || a.teamId - b.teamId
  const out = {}
  for (const id of new Set([...Object.keys(existing), ...Object.keys(fresh)])) {
    const kept = (existing[id] ?? []).filter((s) => s.season < from || s.season > to)
    const stints = [...kept, ...(fresh[id] ?? [])].sort(bySeason)
    if (stints.length) out[id] = stints
  }
  return out
}

// The range a shard claims after a partial run: the stored range widened by
// the swept one, never narrowed. A slice that leaves a gap would claim seasons
// nobody fetched, so it throws.
export function mergeCoverage(prev, from, to) {
  const [a, b] = prev?.seasons ?? [from, to]
  if (to < a - 1 || from > b + 1) throw new Error(`${from}-${to} leaves a gap in stored ${a}-${b}`)
  return { seasons: [Math.min(a, from), Math.max(b, to)], mode: 'backfill' }
}
