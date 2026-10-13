// `gen-fouls.mjs --rebuild-counts[=<season>]`: forget one season's by-count cells and per-game
// rows (#1881, #1914) and re-read every game of that season on file. The cells ACCUMULATE
// across games, so filling gaps would double-count: it wipes first, like
// --backfill-team-pitch-types. The wipe and the walk take the same rows (every ingested
// game of the season, both scopes), so no game is wiped and then left out.
import { foldBatterCounts } from './byCount.mjs'

export function wipeCounts(db, season) {
  db.prepare('DELETE FROM foul_batter_counts WHERE season = ?').run(season)
  db.prepare('DELETE FROM foul_batter_games WHERE season = ?').run(season)
  return db.prepare('SELECT game_pk, date, season, scope FROM foul_ingested_games WHERE season = ?').all(season)
}

// -> { done, failed }. `failed` are the ledger rows whose feed did not come back: they
// were good data before the wipe, so the caller must say so and fail the run.
// `getFeed(gamePk)` and `aggregate(feed)` are passed in, so a test needs no network.
export async function rebuildCounts(db, stmts, { season, aggregate, getFeed, checkpoint = async () => {} }) {
  const queue = wipeCounts(db, season)
  const total = queue.length
  const failed = []
  let done = 0
  async function worker() {
    for (let g = queue.shift(); g; g = queue.shift()) {
      try {
        const agg = aggregate(await getFeed(g.game_pk))
        db.exec('BEGIN')
        try {
          for (const [id, b] of agg.batters) foldBatterCounts(stmts, g.game_pk, g.season, g.scope, id, b)
          db.exec('COMMIT')
        } catch (err) {
          db.exec('ROLLBACK')
          throw err
        }
      } catch (err) {
        console.error(`rebuild-counts gamePk ${g.game_pk}: ${err.message}`)
        failed.push(g)
      }
      done += 1
      if (done % 100 === 0) {
        console.log(`${done}/${total} rebuilt, checkpointing...`)
        await checkpoint()
      }
    }
  }
  await Promise.all(Array.from({ length: 8 }, worker))
  return { done, failed }
}

// The CLI half: `season` is the flag's value. Sets a non-zero exit code when any game failed.
export async function rebuildCommand(db, stmts, season, { aggregate, getFeed, touched, writeOut }) {
  const year = Number(season)
  if (!(year > 1900)) throw new Error('--rebuild-counts needs a season: --rebuild-counts=2026')
  touched.add(year)
  const { done, failed } = await rebuildCounts(db, stmts, { season: year, aggregate, getFeed, checkpoint: writeOut })
  await writeOut()
  console.log(`rebuilt ${year} foul_batter_counts/games from ${done - failed.length} games`)
  if (!failed.length) return
  console.error(
    `${failed.length} game(s) failed and are missing from the rebuild: ${failed.map((g) => g.game_pk).join(', ')}. ` +
      'Run the same command again (it re-reads the whole season), and do not commit before it ends clean.',
  )
  process.exitCode = 1
}
