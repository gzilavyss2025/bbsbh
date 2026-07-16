// ONE-TIME migration: seeds scripts/data/bbsbh.sql (the SQLite layer's
// committed dump, docs/adr/0021) from the existing public/data/game-score.json,
// team-score.json, and season-score.json — so switching gen-game-score.mjs,
// gen-team-score.mjs, and gen-season-score.mjs to the SQLite-backed writer
// doesn't silently drop years of already-accumulated history. Run once when
// landing the migration; the three generators own the table from then on.
//
//   node scripts/migrate-json-to-sqlite.mjs
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb, dumpAll } from './lib/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const dataDir = join(here, '..', 'public', 'data')

async function readJson(name) {
  try {
    return JSON.parse(await readFile(join(dataDir, name), 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return null
    throw err
  }
}

async function migrateGameScores(db) {
  const data = await readJson('game-score.json')
  if (!data) return 0
  const insert = db.prepare(
    `INSERT INTO game_scores (game_pk, score, sport_id, home_id, away_id, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(game_pk) DO UPDATE SET
       score = excluded.score, sport_id = excluded.sport_id,
       home_id = excluded.home_id, away_id = excluded.away_id,
       updated_at = excluded.updated_at`,
  )
  const generatedAt = data.generatedAt ?? new Date().toISOString()
  let n = 0
  for (const [gamePk, entry] of Object.entries(data.scores ?? {})) {
    insert.run(Number(gamePk), entry.score, entry.sportId ?? null, entry.homeId ?? null, entry.awayId ?? null, generatedAt)
    n++
  }
  return n
}

// team-score.json and season-score.json share the same
// { seasons: { <year>: { byTeamId: { <teamId>: { <date>: snapshot } } } } }
// shape; only the metric name(s) written per snapshot differ.
async function migrateTeamSnapshots(db, filename, metricsFor) {
  const data = await readJson(filename)
  if (!data) return 0
  const insert = db.prepare(
    `INSERT INTO team_snapshots (season, team_id, date, metric, payload_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(season, team_id, date, metric) DO UPDATE SET payload_json = excluded.payload_json`,
  )
  let n = 0
  for (const [season, seasonData] of Object.entries(data.seasons ?? {})) {
    for (const [teamId, byDate] of Object.entries(seasonData.byTeamId ?? {})) {
      for (const [date, snapshot] of Object.entries(byDate)) {
        for (const [metric, payload] of metricsFor(snapshot)) {
          insert.run(Number(season), Number(teamId), date, metric, JSON.stringify(payload))
          n++
        }
      }
    }
  }
  return n
}

async function main() {
  const db = await openDb()

  const gameScores = await migrateGameScores(db)
  console.log(`game_scores: ${gameScores} row(s) imported`)

  const teamScores = await migrateTeamSnapshots(db, 'team-score.json', (snapshot) => [
    ['quality', snapshot.season],
    ['current_form', snapshot.currentForm],
  ])
  console.log(`team_snapshots (quality/current_form): ${teamScores} row(s) imported`)

  const seasonScores = await migrateTeamSnapshots(db, 'season-score.json', (snapshot) => [
    ['surprise', snapshot],
  ])
  console.log(`team_snapshots (surprise): ${seasonScores} row(s) imported`)

  await dumpAll(db)
  console.log('wrote scripts/data/{game-scores,team-snapshots}.sql')
  db.close()
}

await main()
