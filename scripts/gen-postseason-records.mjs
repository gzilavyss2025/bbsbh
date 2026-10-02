// Regenerates public/data/postseason-records/{season}.json — the per-game
// LEDGER every club's POSTSEASON situational records are read off, MLB only,
// 1995 to now (the Wild Card era). The postseason twin of gen-team-records.mjs:
// the same row shape, so the app's situational-record predicates
// (src/api/teamRecords.js's RECORD_GROUPS) run over it unchanged. What differs
// is in scripts/lib/records/postseason.mjs's header.
//
// One file per season, all clubs inside, rather than a file per club: a
// postseason has ten to twelve clubs and ~40 games, so a season is a few KB, and
// the all-years view reads thirty-one small files instead of three hundred.
// `index.json` beside them carries the run's timestamp and the seasons on file.
//
// Same facts-not-flags design as the regular-season ledger (see that
// generator's header): the SQLite group stores raw per-game facts, and every
// flag is derived at export, so a changed definition is `--export-only` with no
// network. APPEND-ONLY: a Final game's box score is immutable, so a game is
// ingested once (postseason_record_ingested_games is the guard).
//
// RUN BY: the nightly cron (update-nightly-data.yml, "Postseason situational
// records"), whose default sweep is the current season only — one schedule call,
// so the other eleven months it ingests nothing and only re-exports.
//
// Run by hand:
//   node scripts/gen-postseason-records.mjs                       # this season
//   node scripts/gen-postseason-records.mjs --seasons=1995-2025   # the backfill
//   node scripts/gen-postseason-records.mjs --export-only         # no network
//   REFREEZE=1 node scripts/gen-postseason-records.mjs --seasons=1995-2025 --refetch
//                                  # re-read games already on file, for a new
//                                  # stored fact; REFREEZE lets the frozen
//                                  # season dumps change, on purpose
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { writeShardsWithStamp } from './lib/io.js'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs } from './lib/args.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { refreshRoleFacts, storedRoleFacts } from './lib/team-records.mjs'
import { pitchHandsFor, pitcherRolesFor, rowsForGame } from './lib/records/ingest.mjs'
import {
  POSTSEASON_GAME_TYPES,
  parseSeasons,
  postseasonCandidates,
  addPostseasonFacts,
  buildSeasonFile,
} from './lib/records/postseason.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'postseason-records')

const GROUP = 'postseason-records'
const TABLES = { games: 'postseason_record_games', roles: 'postseason_record_pitcher_roles' }
const CONCURRENCY = 6
const CHECKPOINT_EVERY = 300
const MLB = 1

async function sweepSeason(db, season, { refetch = false } = {}) {
  let slate
  try {
    slate = await getJson(
      `/api/v1/schedule?sportId=${MLB}&season=${season}&gameType=${POSTSEASON_GAME_TYPES}` +
        '&hydrate=linescore,team',
    )
  } catch (err) {
    console.error(`schedule ${season}: ${err.message}`)
    return
  }
  // --refetch ignores the ingested guard and reads every Final game again,
  // which is how a new fact reaches games already on file (see the header).
  const existing = refetch
    ? new Set()
    : new Set(
        db.prepare('SELECT game_pk FROM postseason_record_ingested_games').all().map((r) => String(r.game_pk)),
      )
  const candidates = postseasonCandidates(slate, existing)
  console.log(`${season}: ${candidates.length} game(s) to ingest`)
  if (candidates.length === 0) return

  const hands = await pitchHandsFor(MLB, season)
  const insertRow = db.prepare(
    `INSERT OR REPLACE INTO postseason_record_games (
       game_pk, team_id, season, sport_id, date, opp_id, result, payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const markIngested = db.prepare(
    'INSERT OR IGNORE INTO postseason_record_ingested_games (game_pk, date, season) VALUES (?, ?, ?)',
  )

  let ingested = 0
  for (let i = 0; i < candidates.length; i += CHECKPOINT_EVERY) {
    const chunk = candidates.slice(i, i + CHECKPOINT_EVERY)
    const results = await mapConcurrent(chunk, CONCURRENCY, async (c) => {
      const rows = await rowsForGame(c, hands)
      return rows ? addPostseasonFacts(rows, c.game) : null
    })
    for (let j = 0; j < chunk.length; j++) {
      const rows = results[j]
      if (!rows) {
        console.error(`gamePk ${chunk[j].game.gamePk}: fetch failed, will retry next run`)
        continue
      }
      for (const r of rows) {
        insertRow.run(
          r.game_pk, r.team_id, r.season, r.sport_id, r.date, r.opp_id, r.result,
          JSON.stringify(r.payload),
        )
      }
      markIngested.run(rows[0].game_pk, rows[0].date, rows[0].season)
      ingested++
    }
    if (candidates.length > CHECKPOINT_EVERY) {
      await dumpGroup(db, GROUP)
      console.log(`${season}: checkpoint ${ingested}/${candidates.length} ingested`)
    }
  }
  console.log(`${season}: ${ingested} game(s) ingested`)
  if (ingested > 0) {
    // After the sweep, so tonight's games can name a first pitcher nobody had
    // seen; a season is refreshed only when it grew, never on an idle night.
    console.log(await refreshRoleFacts(db, season, [MLB], pitcherRolesFor, TABLES))
    await dumpGroup(db, GROUP)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const db = await openDb()

  if (!args['export-only']) {
    for (const season of parseSeasons(args.seasons, new Date().getUTCFullYear())) {
      await sweepSeason(db, season, { refetch: Boolean(args.refetch) })
    }
  }

  // Always re-export: byte-identical files when nothing changed, so no churn.
  const seasons = db
    .prepare('SELECT DISTINCT season FROM postseason_record_games ORDER BY season')
    .all()
    .map((r) => r.season)
  const entries = seasons.map((season) => {
    const roles = storedRoleFacts(
      db.prepare('SELECT * FROM postseason_record_pitcher_roles WHERE season = ?').all(season),
    )
    const raw = db.prepare('SELECT * FROM postseason_record_games WHERE season = ?').all(season)
    return [String(season), buildSeasonFile(season, raw, roles)]
  })
  const { written, swept } = await writeShardsWithStamp(outDir, entries, { seasons })
  console.log(`wrote ${written} season file(s)${swept ? `, swept ${swept}` : ''}`)
  const total = db.prepare('SELECT COUNT(*) AS n FROM postseason_record_ingested_games').get().n
  console.log(`${total} total postseason games on file`)
  db.close()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
