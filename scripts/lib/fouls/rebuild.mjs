// `gen-fouls.mjs --rebuild-counts[=<season>]`: forget one season's batter and pitcher totals,
// by-count cells and per-game rows (#1881, #1914) and re-read every game of that season on
// file, so the totals and the cells come from the same feeds and the same rules.
import { foldBatterTotals, foldPitcherTotals } from './byCount.mjs'

// One season's rows in every table the re-read refills: the by-count cells (batters', pitchers') and per-game rows, and
// the batter and pitcher season rows the cells are checked against (#1881). All of them ACCUMULATE
// across games, so filling gaps would double-count: wipe first, like --backfill-team-pitch-types.
// Other tables (teams, innings, pitch types, game totals) are not touched.
const TABLES = ['foul_batter_counts', 'foul_batter_games', 'foul_batter_totals', 'foul_batter_pa_high', 'foul_pitcher_totals', 'foul_pitcher_counts']
// The season totals and the pitcher cells are put back when a feed fails, in step, so a pitcher's cells
// still match his totals. The batter cells and games stay part-read: the exit code flags them.
const TOTAL_TABLES = TABLES.slice(2)
const CHUNK = 100 // games fetched at a time, then folded in order, so a tie for a season high goes to the earliest game

// The wipe and the walk take the same rows (every ingested game of the season, both scopes),
// so no game is wiped and then left out. Oldest first, as the nightly folds were.
export function wipeCounts(db, season) {
  inTransaction(db, () => {
    for (const t of TABLES) db.prepare(`DELETE FROM ${t} WHERE season = ?`).run(season)
  })
  return db
    .prepare('SELECT game_pk, date, season, scope FROM foul_ingested_games WHERE season = ? ORDER BY date, game_pk')
    .all(season)
}

// One transaction, so a crash leaves a season whole or untouched, never part wiped or part restored.
function inTransaction(db, fn) {
  db.exec('BEGIN')
  try {
    fn()
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

const saveRows = (db, season) => TOTAL_TABLES.map((t) => [t, db.prepare(`SELECT * FROM ${t} WHERE season = ?`).all(season)])
function restoreRows(db, season, saved) {
  inTransaction(db, () => {
    for (const [t, rows] of saved) {
      db.prepare(`DELETE FROM ${t} WHERE season = ?`).run(season)
      for (const r of rows) {
        const cols = Object.keys(r)
        db.prepare(`INSERT INTO ${t} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`).run(...Object.values(r))
      }
    }
  })
}

// -> { done, failed }. `failed` are the ledger rows whose feed did not come back: they
// were good data before the wipe, so the caller must say so and fail the run. Then the season
// totals go back as they were, so no total is ever a part-season; the cells stay part-read and
// exportByCount shows none until the next full re-read.
// `getFeed(gamePk)` and `aggregate(feed)` are passed in, so a test needs no network.
export async function rebuildCounts(db, stmts, { season, aggregate, getFeed, checkpoint = async () => {} }) {
  const saved = saveRows(db, season)
  const queue = wipeCounts(db, season)
  const total = queue.length
  const failed = []
  let done = 0
  for (let from = 0; from < total; from += CHUNK) {
    const chunk = queue.slice(from, from + CHUNK)
    const aggs = new Array(chunk.length)
    const pending = chunk.map((_, i) => i)
    async function worker() {
      for (let i = pending.shift(); i !== undefined; i = pending.shift()) {
        try {
          aggs[i] = aggregate(await getFeed(chunk[i].game_pk))
        } catch (err) {
          aggs[i] = err
        }
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker))
    chunk.forEach((g, i) => {
      try {
        if (aggs[i] instanceof Error) throw aggs[i]
        db.exec('BEGIN')
        try {
          for (const [id, b] of aggs[i].batters) foldBatterTotals(stmts, g.game_pk, g.season, g.scope, id, b)
          for (const [id, p] of aggs[i].pitchers) foldPitcherTotals(stmts, g.season, g.scope, id, p)
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
    })
    console.log(`${done}/${total} rebuilt, checkpointing...`)
    await checkpoint()
  }
  if (failed.length) restoreRows(db, season, saved)
  return { done, failed }
}

// The CLI half: `season` is the flag's value. Sets a non-zero exit code when any game failed.
export async function rebuildCommand(db, stmts, season, { aggregate, getFeed, touched, writeOut }) {
  const year = Number(season)
  if (!(year > 1900)) throw new Error('--rebuild-counts needs a season: --rebuild-counts=2026')
  touched.add(year)
  const { done, failed } = await rebuildCounts(db, stmts, { season: year, aggregate, getFeed, checkpoint: writeOut })
  await writeOut()
  console.log(`rebuilt ${year} foul totals, counts and per-game rows from ${done - failed.length} games`)
  if (!failed.length) return
  console.error(
    `${failed.length} game(s) failed and are missing from the rebuild: ${failed.map((g) => g.game_pk).join(', ')}. ` +
      'The season totals were put back to their old values, so those games\' batters have totals that include them and cells that do not, until a rerun. ' +
      'Run the same command again (it re-reads the whole season), and do not commit before it ends clean.',
  )
  process.exitCode = 1
}
