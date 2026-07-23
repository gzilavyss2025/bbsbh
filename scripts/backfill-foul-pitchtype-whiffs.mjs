// One-time migration: populate `whiffs` on foul_pitch_types (the league-wide
// by-pitch-type table) for rows ingested before that column existed (see
// scripts/lib/schema.sql). Ordinary nightly gen-fouls.mjs runs only add
// whiffs going forward — a season already partway ingested needs its
// existing rows backfilled once.
//
// Unlike backfill-foul-maxgame.mjs (which has to re-fetch each batter's game
// feed), this needs NO network calls: foul_team_pitch_types_pitching already
// carries a per-team, per-pitch-type whiffs count from the SAME per-pitch
// loop that built foul_pitch_types (see gen-fouls.mjs), so summing it across
// all 30 teams reconstructs the league total for free. Sets the absolute
// value (not additive), so it's safe to re-run — each run just recomputes
// from the team tables' current state rather than accumulating.
//
//   node scripts/backfill-foul-pitchtype-whiffs.mjs
import { openDb, dumpGroup } from './lib/db.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportFouls } from './gen-fouls.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'fouls.json')

async function main() {
  const db = await openDb()

  const rows = db
    .prepare(
      `SELECT code, (SELECT COALESCE(SUM(whiffs), 0) FROM foul_team_pitch_types_pitching t WHERE t.code = foul_pitch_types.code) AS whiffs
       FROM foul_pitch_types`,
    )
    .all()

  console.log(`backfilling whiffs for ${rows.length} pitch type(s)`)

  const update = db.prepare('UPDATE foul_pitch_types SET whiffs = ? WHERE code = ?')
  for (const row of rows) {
    update.run(row.whiffs, row.code)
    console.log(`  ${row.code}: whiffs -> ${row.whiffs}`)
  }

  await dumpGroup(db, 'fouls')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(exportFouls(db)))
  console.log(`wrote ${out}`)
  db.close()
}

await main()
