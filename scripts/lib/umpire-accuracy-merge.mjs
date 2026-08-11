// Merge logic for gen-umpire-accuracy.mjs, pulled out because a generator is
// a top-level script — importing one RUNS it — so a helper worth
// unit-testing can't stay inline (see pitcher-starts.mjs for the same split).

// Merge one game row into an umpire's list, deduped by gamePk (a Final game
// is immutable, so a re-run overwrites with identical numbers), newest first.
export function upsertGame(games, row) {
  const byPk = new Map(games.map((g) => [g.gamePk, g]))
  byPk.set(row.gamePk, row)
  return [...byPk.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

// Merge freshly-swept rows into the carried-forward `prevUmpires` map. MLB
// occasionally corrects a past crew assignment (e.g. a similarly-named
// official swapped in after the fact) — the fresh sweep then reports the
// same gamePk under a DIFFERENT umpire id than the one it was merged under
// on a previous run. A naive merge would leave the stale copy under the old
// (wrong) umpire forever, permanently crediting him a game he never called
// and leaving him with accuracy data but no gen-umpires.mjs shard (that
// generator always rebuilds fresh from the current schedule, so it never
// carries the mistake forward). This strips any stale copy of a gamePk from
// every OTHER umpire before upserting it under its current official, then
// drops any umpire a purge left with zero games — a pure ghost, not a real
// official, that would otherwise write an empty umpire-with-no-shard row and
// fail the shard/accuracy invariant (test/umpire-shards.test.js).
export function mergeAccuracyRows(prevUmpires, rows) {
  const umpires = {}
  for (const [id, u] of Object.entries(prevUmpires ?? {})) {
    umpires[id] = { id: u.id ?? Number(id), name: u.name, games: [...(u.games ?? [])] }
  }
  for (const r of rows) {
    if (!r) continue
    const key = String(r.umpId)
    for (const [otherId, u] of Object.entries(umpires)) {
      if (otherId !== key) u.games = u.games.filter((g) => g.gamePk !== r.gamePk)
    }
    if (!umpires[key]) umpires[key] = { id: r.umpId, name: r.umpName, games: [] }
    else umpires[key].name = r.umpName // keep the freshest spelling
    umpires[key].games = upsertGame(umpires[key].games, {
      gamePk: r.gamePk,
      date: r.date,
      level: r.level,
      gameType: r.gameType,
      ...r.acc,
    })
  }
  for (const id of Object.keys(umpires)) {
    if (!umpires[id].games.length) delete umpires[id]
  }
  return umpires
}
