// Shared bounded-concurrency worker pool for the gen-*.mjs generators.
//
// mapConcurrent(items, limit, mapper) — cursor-based pool of `limit` workers,
// each running `mapper(item, index)`. Best-effort: a rejected mapper call is
// caught and that slot resolves to null rather than failing the whole run,
// the shape every generator using this needs since one bad person/game
// shouldn't abort an otherwise-good nightly sweep.
//
// gen-mono-logos.mjs intentionally does NOT use this — its own pool has no
// per-item try/catch, so a failure there aborts the run instead of silently
// producing a null entry. That's a deliberate behavioral difference (a bad
// logo conversion should stop the run, not ship a hole), so it keeps its own
// copy rather than being swept into this best-effort helper.

export async function mapConcurrent(items, limit, mapper) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch {
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
