// One-time migration: populate result_description / pa_pitches on
// foul_batter_pa_high for rows ingested before those columns existed (see
// scripts/lib/schema.sql). Ordinary nightly gen-fouls.mjs runs only set them
// going forward — a season already partway ingested needs its existing best-
// PA rows backfilled once. Same footing as backfill-foul-maxgame.mjs: a
// one-time historical sweep, not part of the nightly cron, safe to re-run
// (only fetches rows the WHERE clause still finds missing).
//
// Re-fetches each row's OWN game_pk (not every ingested game) and reruns the
// SAME aggregateGameFouls used at ingest time, so the recovered fields are
// guaranteed to describe the identical plate appearance already on file —
// no separate play-matching logic to keep in sync.
//
//   node scripts/backfill-foul-pa-description.mjs
import { openDb, dumpGroup } from './lib/db.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportFouls, aggregateGameFouls } from './gen-fouls.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'fouls.json')
const BASE = 'https://statsapi.mlb.com'

async function getJson(path) {
  const res = await fetch(BASE + path)
  if (!res.ok) throw new Error(`statsapi ${res.status} ${path}`)
  return res.json()
}

async function main() {
  const db = await openDb()
  const rows = db
    .prepare(
      `SELECT person_id, game_pk FROM foul_batter_pa_high
       WHERE game_pk IS NOT NULL AND (result_description IS NULL OR pa_pitches IS NULL)`,
    )
    .all()

  console.log(`backfilling ${rows.length} batter(s)' best-PA description/pitch count`)

  const update = db.prepare(
    'UPDATE foul_batter_pa_high SET result_description = ?, pa_pitches = ? WHERE person_id = ?',
  )

  const feedCache = new Map()
  for (const row of rows) {
    let feed = feedCache.get(row.game_pk)
    if (!feed) {
      feed = await getJson(`/api/v1.1/game/${row.game_pk}/feed/live`)
      feedCache.set(row.game_pk, feed)
    }
    const bestPa = aggregateGameFouls(feed).batters.get(row.person_id)?.bestPa
    if (!bestPa) {
      console.log(`  person ${row.person_id}: gamePk ${row.game_pk} — no best PA found, skipping`)
      continue
    }
    update.run(bestPa.resultDescription, bestPa.paPitches, row.person_id)
    console.log(
      `  person ${row.person_id}: gamePk ${row.game_pk} -> ${bestPa.paPitches} pitches, "${bestPa.resultDescription}"`,
    )
  }

  await dumpGroup(db, 'fouls')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(exportFouls(db)))
  console.log(`wrote ${out}`)
  db.close()
}

await main()
