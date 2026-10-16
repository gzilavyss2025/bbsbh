// ONE ANSWER PER KEY (ADR-0113, slice 3). The full Now Pitching card appears twice for an arm
// who comes in mid-inning: where he takes the mound, and again at the head of the next
// at-bat (the lead-in repeat). Both ask for the same season line, last game and arsenal.
// `fetchPitcherSeasonLine` and `fetchPitcherLastGame` already keep their own answers, but a
// second card still waits a tick for them and would draw plain before it filled in.
// This keeps the whole answer instead: `peek` is the finished answer or null, so the repeat
// draws complete on its first render, and `load` hands every asker the one request. A failed
// read is not kept, so the next ask tries again.
export function keyedCache() {
  const done = new Map()
  const asked = new Map()
  return {
    peek: (key) => done.get(key) ?? null,
    load(key, read) {
      if (!asked.has(key)) {
        asked.set(
          key,
          read().then(
            (value) => {
              done.set(key, value)
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
