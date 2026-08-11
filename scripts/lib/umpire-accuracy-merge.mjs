// Merge logic for gen-umpire-accuracy.mjs, pulled out because a generator is
// a top-level script — importing one RUNS it — so a helper worth
// unit-testing can't stay inline (see pitcher-starts.mjs for the same split).
import { mergeReassignableRows } from './reassignable-merge.mjs'

// Merge freshly-swept rows into the carried-forward `prevUmpires` map. MLB
// occasionally corrects a past crew assignment (e.g. a similarly-named
// official swapped in after the fact) — the fresh sweep then reports the
// same gamePk under a DIFFERENT umpire id than the one it was merged under
// on a previous run. mergeReassignableRows handles the general case: it
// strips any stale copy of a gamePk from every OTHER umpire before
// upserting it under its current official, then drops any umpire a purge
// left with zero games — a pure ghost, not a real official, that would
// otherwise write an empty umpire-with-no-shard row and fail the
// shard/accuracy invariant (test/umpire-shards.test.js).
export function mergeAccuracyRows(prevUmpires, rows) {
  const prevByKey = {}
  for (const [id, u] of Object.entries(prevUmpires ?? {})) {
    prevByKey[id] = { id: u.id ?? Number(id), name: u.name, rows: u.games ?? [] }
  }
  const merged = mergeReassignableRows(prevByKey, rows, {
    getKey: (r) => r.umpId,
    getRowId: (r) => r.gamePk,
    getName: (r) => r.umpName,
    toRow: (r) => ({ gamePk: r.gamePk, date: r.date, level: r.level, gameType: r.gameType, ...r.acc }),
  })
  const umpires = {}
  for (const [id, entry] of Object.entries(merged)) {
    umpires[id] = {
      id: entry.id,
      name: entry.name,
      games: [...entry.rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    }
  }
  return umpires
}
