// The nightly `gen-fouls.mjs` sweep (#2024): which Final games to fetch, and the fetch loop.
// A game whose fetch fails stays out of foul_ingested_games, so a later run takes it again:
// each run reads the whole season's schedule, not only the trailing window. A failed game is
// kept in foul_failed_games, and the run fails only when the same game fails twice in a row.
import { scopeOfGameType } from '../records/postseason.mjs'

// Games older than the trailing window that one run takes, so one bad night cannot make a run slow.
export const GAP_CAP = 50
const CHECKPOINT_EVERY = 100
const CONCURRENCY = 8

// Same postponed-replay dedup as the other sweeps: a replayed game is listed under both dates;
// keep only the officialDate bucket. The window's games come first, then up to `cap` older ones.
export function pendingGames(schedule, ingested, startDate, cap = GAP_CAP) {
  const window = []
  const gap = []
  for (const d of schedule.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== 'Final' || d.date !== g.officialDate || ingested.has(g.gamePk)) continue
      // The season comes from the game, never the clock (#1200).
      const row = { gamePk: g.gamePk, date: g.officialDate, season: Number(g.season ?? g.officialDate.slice(0, 4)), scope: scopeOfGameType(g.gameType) }
      ;(d.date < startDate ? gap : window).push(row)
    }
  }
  return [...window, ...gap.slice(0, cap)]
}

// -> { pending, done, failed, again }. `again` are the failed games that also failed on the
// run before. `ingest(game)` fetches and folds one game; it is passed in, so a test needs no network.
export async function sweepFouls(db, { schedule, startDate, ingest, touched, checkpoint = async () => {} }) {
  const ingested = new Set(db.prepare('SELECT game_pk FROM foul_ingested_games').all().map((r) => r.game_pk))
  const failedBefore = new Set(db.prepare('SELECT game_pk FROM foul_failed_games').all().map((r) => r.game_pk))
  const pending = pendingGames(schedule, ingested, startDate)
  const queue = [...pending]
  const failed = []
  let done = 0
  async function worker() {
    for (let g = queue.shift(); g; g = queue.shift()) {
      try {
        await ingest(g)
        db.prepare('DELETE FROM foul_failed_games WHERE game_pk = ?').run(g.gamePk)
      } catch (err) {
        console.error(`gamePk ${g.gamePk}: ${err.message}`)
        failed.push(g)
        db.prepare('INSERT OR IGNORE INTO foul_failed_games (game_pk, season) VALUES (?, ?)').run(g.gamePk, g.season)
      }
      touched.add(g.season)
      done += 1
      if (done % CHECKPOINT_EVERY === 0) {
        console.log(`${done}/${pending.length} swept, checkpointing...`)
        await checkpoint()
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  return { pending, done, failed, again: failed.filter((g) => failedBefore.has(g.gamePk)) }
}
