// Shared bounded-concurrency worker pool for the gen-*.mjs generators.
//
// mapConcurrent(items, limit, mapper, { strict }) — cursor-based pool of
// `limit` workers, each running `mapper(item, index)`. By default it is
// best-effort: a rejected mapper call is caught and that slot resolves to null
// rather than failing the whole run, the shape most generators need since one
// bad person/game shouldn't abort an otherwise-good nightly sweep.
//
// `{ strict: true }` catches nothing: the first rejected mapper call rejects
// the whole call, so a failure stops the run instead of shipping a hole (a bad
// logo conversion, a history backfill that would write a partial file).

export async function mapConcurrent(items, limit, mapper, { strict = false } = {}) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await mapper(items[i], i)
      } catch (err) {
        if (strict) throw err
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
