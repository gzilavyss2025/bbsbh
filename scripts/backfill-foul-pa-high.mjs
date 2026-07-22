// One-time migration: populate foul_batter_pa_high for games ingested BEFORE
// that table existed. Unlike backfill-foul-maxgame.mjs (which only needed to
// re-fetch each CURRENT max-game holder's one known gamePk), the most-fouled
// PLATE APPEARANCE of the season could belong to any batter in any game — so
// there is no way to scope this to a handful of already-known rows. This
// re-walks every already-ingested game's feed through the same pure
// aggregateGameFouls used by the ordinary nightly sweep and folds each game's
// bestPa into foul_batter_pa_high via the SAME CASE-guarded upsert gen-fouls
// itself uses, so it's exactly as if PA-tracking had been live all season.
//
// Deliberately DOES NOT touch foul_batter_totals or foul_ingested_games —
// those are already correct; re-adding to them would double-count. Safe to
// re-run/interrupt: the CASE guard means replaying the same game twice never
// regresses a stored max.
//
//   node scripts/backfill-foul-pa-high.mjs [--days=N] [--concurrency=8]
import { openDb, dumpGroup } from './lib/db.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { aggregateGameFouls, exportFouls } from './gen-fouls.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'fouls.json')
const BASE = 'https://statsapi.mlb.com'

function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) args[m[1]] = m[2]
  }
  return args
}

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

const upsertPaHigh = (db) =>
  db.prepare(
    `INSERT INTO foul_batter_pa_high
       (person_id, fouls, game_pk, pitcher_id, pitcher_name, result_event,
        result_type, inning, half, outs, on_first, on_second, on_third,
        away_score, home_score, batting_team_id, opponent_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(person_id) DO UPDATE SET
       fouls = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                    THEN excluded.fouls ELSE foul_batter_pa_high.fouls END,
       game_pk = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                      THEN excluded.game_pk ELSE foul_batter_pa_high.game_pk END,
       pitcher_id = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                         THEN excluded.pitcher_id ELSE foul_batter_pa_high.pitcher_id END,
       pitcher_name = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                           THEN excluded.pitcher_name ELSE foul_batter_pa_high.pitcher_name END,
       result_event = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                           THEN excluded.result_event ELSE foul_batter_pa_high.result_event END,
       result_type = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                          THEN excluded.result_type ELSE foul_batter_pa_high.result_type END,
       inning = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                     THEN excluded.inning ELSE foul_batter_pa_high.inning END,
       half = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                   THEN excluded.half ELSE foul_batter_pa_high.half END,
       outs = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                   THEN excluded.outs ELSE foul_batter_pa_high.outs END,
       on_first = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                       THEN excluded.on_first ELSE foul_batter_pa_high.on_first END,
       on_second = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                        THEN excluded.on_second ELSE foul_batter_pa_high.on_second END,
       on_third = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                       THEN excluded.on_third ELSE foul_batter_pa_high.on_third END,
       away_score = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                         THEN excluded.away_score ELSE foul_batter_pa_high.away_score END,
       home_score = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                         THEN excluded.home_score ELSE foul_batter_pa_high.home_score END,
       batting_team_id = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                              THEN excluded.batting_team_id ELSE foul_batter_pa_high.batting_team_id END,
       opponent_id = CASE WHEN excluded.fouls > foul_batter_pa_high.fouls
                          THEN excluded.opponent_id ELSE foul_batter_pa_high.opponent_id END`,
  )

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const concurrency = Number(args.concurrency) || 8

  const db = await openDb()
  let rows = db.prepare('SELECT game_pk, date FROM foul_ingested_games ORDER BY date DESC').all()
  if (args.days) {
    const cutoff = new Date()
    cutoff.setUTCDate(cutoff.getUTCDate() - Number(args.days))
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    rows = rows.filter((r) => r.date >= cutoffStr)
  }
  console.log(`re-walking ${rows.length} already-ingested game(s) for per-PA foul highs`)

  const upsert = upsertPaHigh(db)
  const queue = [...rows]
  let done = 0
  let bestSoFar = 0

  async function worker() {
    while (queue.length) {
      const row = queue.shift()
      if (!row) return
      try {
        const feed = await getJson(`/api/v1.1/game/${row.game_pk}/feed/live`)
        const agg = aggregateGameFouls(feed)
        db.exec('BEGIN')
        for (const [id, b] of agg.batters) {
          if (!b.bestPa) continue
          bestSoFar = Math.max(bestSoFar, b.bestPaFouls)
          const pa = b.bestPa
          upsert.run(
            id, b.bestPaFouls, row.game_pk, pa.pitcherId, pa.pitcherName, pa.resultEvent,
            pa.resultType, pa.inning, pa.half, pa.outs, pa.onFirst ? 1 : 0, pa.onSecond ? 1 : 0,
            pa.onThird ? 1 : 0, pa.awayScore, pa.homeScore, pa.battingTeamId, pa.opponentId,
          )
        }
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        console.error(`gamePk ${row.game_pk}: ${err.message}`)
      }
      done += 1
      if (done % 100 === 0) console.log(`${done}/${rows.length} games swept, best PA foul count so far: ${bestSoFar}`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))

  await dumpGroup(db, 'fouls')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(exportFouls(db)))
  console.log(`wrote ${out} — best single-PA foul count found: ${bestSoFar}`)
  db.close()
}

await main()
