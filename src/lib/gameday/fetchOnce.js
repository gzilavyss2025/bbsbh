// Gameday's per-session memo for reads it would otherwise repeat (review finding 8): the checkpoint
// remounts every half and the Scout line every batter, and each mount asked the network again. It
// memoizes the REQUEST, as staticJson does, so callers that start on one tick share one fetch. A read
// that answers `empty` (the fetchers' failure value) is dropped, so a later mount tries again.
export function fetchOnce(fetcher, empty = (v) => v == null) {
  const memo = new Map()
  return (...args) => {
    const key = JSON.stringify(args)
    if (!memo.has(key)) {
      const p = fetcher(...args).then((v) => {
        if (empty(v)) memo.delete(key)
        return v
      }, (e) => {
        memo.delete(key)
        throw e
      })
      memo.set(key, p)
    }
    return memo.get(key)
  }
}
