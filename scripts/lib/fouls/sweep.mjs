// The nightly `gen-fouls.mjs` sweep (#2024): which Final games to fetch, and the fetch loop.
// A game whose fetch fails stays out of foul_ingested_games, so a later run takes it again:
// each run reads the whole season's schedule, not only the trailing window. A failed game is
// kept in foul_failed_games, and the run fails only when the same game fails twice in a row.
import { scopeOfGameType } from '../records/postseason.mjs'
import { CHECKPOINT_EVERY, CONCURRENCY, GAP_CAP, collectPending, runSweep } from '../sweep/retry.mjs'

export { CHECKPOINT_EVERY, CONCURRENCY }

// The Final games not yet in the ledger (`ingested`), window first, then up to `cap` older ones.
export function pendingGames(schedule, ingested, startDate, cap = GAP_CAP) {
  return collectPending(schedule, {
    startDate,
    cap,
    accept: (g) =>
      ingested.has(g.gamePk)
        ? null
        : // The season comes from the game, never the clock (#1200).
          { gamePk: g.gamePk, date: g.officialDate, season: Number(g.season ?? g.officialDate.slice(0, 4)), scope: scopeOfGameType(g.gameType) },
  })
}

// -> { pending, done, failed, again }. `again` are the failed games that also failed on the
// run before. A failed game adds no season to `touched`: a run writes only the seasons it
// ingested a game for (ADR-0086), so the caller dumps foul_failed_games itself. `ingest(game)` fetches and folds one game; it is passed in, so a test needs no network.
export async function sweepFouls(db, { schedule, startDate, ingest, touched, checkpoint }) {
  const ingested = new Set(db.prepare('SELECT game_pk FROM foul_ingested_games').all().map((r) => r.game_pk))
  const failedBefore = new Set(db.prepare('SELECT game_pk FROM foul_failed_games').all().map((r) => r.game_pk))
  const pending = pendingGames(schedule, ingested, startDate)
  console.log(`${pending.length} un-ingested Final MLB games (the window from ${startDate}, then up to ${GAP_CAP} older)`)
  const forget = db.prepare('DELETE FROM foul_failed_games WHERE game_pk = ?')
  const remember = db.prepare('INSERT OR IGNORE INTO foul_failed_games (game_pk, season) VALUES (?, ?)')
  const swept = await runSweep({
    pending,
    ingest,
    failedBefore,
    keyOf: (g) => g.gamePk,
    onOk: (g) => {
      forget.run(g.gamePk)
      touched.add(g.season)
    },
    onFail: (g) => remember.run(g.gamePk, g.season),
    checkpoint,
  })
  return { pending, ...swept }
}
