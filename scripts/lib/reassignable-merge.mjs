// Shared merge for any "append-only/incremental" generator that carries a
// per-key entity forward across runs and folds in freshly-swept rows keyed
// by an upstream-asserted identity field (see scripts/CLAUDE.md's
// "reassignable merge" convention). If the upstream source corrects that
// identity after the fact — a crew assignment, an official's attribution,
// anything the source can retroactively fix — a naive per-key merge leaves
// a ghost row on the OLD key forever, since nothing re-validates
// carried-forward history against the fresh sweep. This purges a row from
// every OTHER key before crediting it to its current one, and drops any key
// a purge leaves with zero rows. Extracted from gen-umpire-accuracy.mjs
// after a real incident: MLB corrected an AAA game's Home Plate umpire, and
// the old umpire kept permanent (wrong) accuracy credit for it — see
// scripts/lib/umpire-accuracy-merge.mjs for the concrete case.
//
// `prevByKey`: { [key]: { id, name, rows } } — the carried-forward store.
// `freshRows`: array of fresh objects (nulls allowed, filtered out).
// `getKey(row)` — the CURRENT entity id this row belongs to.
// `getRowId(row)` — identifies "the same underlying event" across a
//   reassignment (e.g. a gamePk) — deliberately NOT the entity key.
// `getName(row)` — the entity's display name, refreshed to the latest
//   spelling seen.
// `toRow(row)` — builds the row object actually stored.
export function mergeReassignableRows(prevByKey, freshRows, { getKey, getRowId, getName, toRow }) {
  const merged = {}
  for (const [key, entry] of Object.entries(prevByKey ?? {})) {
    merged[key] = { id: entry.id, name: entry.name, rows: [...(entry.rows ?? [])] }
  }
  for (const fresh of freshRows) {
    if (!fresh) continue
    const key = String(getKey(fresh))
    const rowId = getRowId(fresh)
    for (const [otherKey, entry] of Object.entries(merged)) {
      if (otherKey !== key) entry.rows = entry.rows.filter((r) => getRowId(r) !== rowId)
    }
    if (!merged[key]) merged[key] = { id: getKey(fresh), name: getName(fresh), rows: [] }
    else merged[key].name = getName(fresh)
    const byId = new Map(merged[key].rows.map((r) => [getRowId(r), r]))
    byId.set(rowId, toRow(fresh))
    merged[key].rows = [...byId.values()]
  }
  for (const key of Object.keys(merged)) {
    if (!merged[key].rows.length) delete merged[key]
  }
  return merged
}
