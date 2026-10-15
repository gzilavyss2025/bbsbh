// The retry half of a nightly Final-game sweep (#2069, after #2024's gen-fouls.mjs): which
// games to fetch, and the fetch loop. A game whose fetch fails stays out of its ledger, so a
// later run takes it again: each run reads the whole season's schedule, not only the trailing
// window. The caller keeps the failed games (a SQLite table, or a list in a JSON ledger) and
// the run fails only when the same game fails on two runs in a row.

// Games older than the trailing window that one run takes, so one bad night cannot make a run slow.
export const GAP_CAP = 50
export const CHECKPOINT_EVERY = 100
export const CONCURRENCY = 8

// `schedule` is one level's schedule from the season start. `accept(game, day)` returns the row
// to queue, or null to skip: it owns the ledger check and any per-sweep filter. Only Final games
// in their officialDate bucket (a replayed game is listed under both dates) reach it.
// The window's games come first, then up to `cap` older ones.
export function collectPending(schedule, { startDate, accept, cap = GAP_CAP }) {
  const window = []
  const gap = []
  for (const d of schedule.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== 'Final' || d.date !== g.officialDate) continue
      const row = accept(g, d)
      if (row) (d.date < startDate ? gap : window).push(row)
    }
  }
  return [...window, ...gap.slice(0, cap)]
}

// -> { done, failed, again }. `again` are the failed games that also failed on the run before
// (`failedBefore` holds their `keyOf` keys). `ingest(game)` fetches and folds one game; it is
// passed in, so a test needs no network. `onOk`/`onFail` let the caller update its failed list.
export async function runSweep({ pending, ingest, failedBefore, keyOf, onOk = () => {}, onFail = () => {}, checkpoint = async () => {}, every = CHECKPOINT_EVERY, concurrency = CONCURRENCY }) {
  const queue = [...pending]
  const failed = []
  let done = 0
  async function worker() {
    for (let g = queue.shift(); g; g = queue.shift()) {
      try {
        await ingest(g)
        onOk(g)
      } catch (err) {
        console.error(`gamePk ${g.gamePk}${g.level ? ` (${g.level})` : ''}: ${err.message}`)
        failed.push(g)
        onFail(g)
      }
      done += 1
      if (done % every === 0) {
        console.log(`${done}/${pending.length} swept, checkpointing...`)
        await checkpoint()
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return { done, failed, again: failed.filter((g) => failedBefore.has(keyOf(g))) }
}
