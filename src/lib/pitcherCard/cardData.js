// ONE ANSWER PER KEY (ADR-0113, slice 3). The full Now Pitching card appears twice for an arm
// who comes in mid-inning: where he takes the mound, and again at the head of the next
// at-bat (the lead-in repeat). Both ask for the same season line, last game and arsenal.
// `fetchPitcherSeasonLine` and `fetchPitcherLastGame` already keep their own answers, but a
// second card still waits a tick for them and would draw plain before it filled in.
// This keeps the whole answer instead: `peek` is the finished answer or null, so a repeat that
// follows a loaded card draws complete on its first render, and `load` hands every asker the one request. A read that
// fails, or that `keep` refuses (an answer missing a part), is not kept, so the next ask tries
// again. One small entry per arm for the life of the page; nothing evicts it.
export function keyedCache() {
  const done = new Map()
  const asked = new Map()
  return {
    peek: (key) => done.get(key) ?? null,
    load(key, read, keep = (value) => value != null) {
      if (!asked.has(key)) {
        asked.set(
          key,
          read().then(
            (value) => {
              if (keep(value)) done.set(key, value)
              else asked.delete(key)
              return value
            },
            (error) => {
              asked.delete(key)
              throw error
            },
          ),
        )
      }
      return asked.get(key)
    },
  }
}
