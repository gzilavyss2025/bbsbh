// Regenerates public/data/attendance.json — per-team, per-season HOME-game
// attendance: games counted, season average, high, and low. Powers the
// Ballpark card's attendance stats (src/screens/team/modules/ballpark/BallparkCard.jsx)
// via the reader src/api/attendance.js.
//
// SOURCE: the lightweight GET /api/v1/game/{gamePk}/boxscore endpoint's
// info[] array, an existing { label, value } list (Weather/Wind/Umpires/Att/
// etc — the same shape src/api/select.js's selectGameInfo already reads off
// the full live feed for the in-progress "Attendance" fact). The boxscore
// endpoint carries the identical info[] with none of the play-by-play, so
// this sweep is far cheaper per game than gen-fouls.mjs/gen-comeback-wins.mjs
// (verified live: Att arrives as "15,952." — a comma-grouped integer with a
// trailing period, same trailing-period convention selectGameInfo strips).
//
// COUNTED ONLY FOR THE HOME CLUB — attendance is a fact about that club's own
// park, not the visiting side, so an away game folds nothing in.
//
// APPEND-ONLY/incremental, same shape as gen-comeback-wins.mjs: each run
// sweeps a trailing window of Final MLB regular-season games (schedule dedup:
// a postponed/replayed game is listed under both dates, so only the
// officialDate bucket counts — same trap gen-fouls.mjs guards), fetches every
// gamePk not yet in attendance_ingested_games, and folds its Att figure into
// the home club's running season totals (SQLite, docs/adr/0021) via
// incrementing upserts. A Final game's attendance never changes, so an
// already-ingested game is never refetched. MLB only (sportId 1) — a league
// rank needs the whole 30-team pool, and MiLB gates degrade too unevenly
// (docs/api/static-data.md's MiLB-degrades-gracefully convention already
// covers a missing attendance figure on those pages).
//
// A game whose boxscore carries no parseable Att (rare — international/
// exhibition-adjacent openers sometimes omit it) is still marked ingested:
// a Final game's attendance is immutable, so retrying it forever buys
// nothing. A fetch/network error is NOT marked, so a transient outage
// retries next run.
//
// Run by hand:
//   node scripts/gen-attendance.mjs                  # trailing 3 days
//   node scripts/gen-attendance.mjs --days=200        # season-to-date backfill
//   node scripts/gen-attendance.mjs --since=2026-03-20 [--until=2026-07-19]
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { parseArgs, dateRange } from './lib/args.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'attendance.json')

const DEFAULT_DAYS = 3
const CHECKPOINT_EVERY = 200
const CONCURRENCY = 8

// Pure: pulls the attendance figure out of a boxscore's info[] rows, or null
// when absent/unparseable. Exported for tests — no network, no DB.
export function parseAttendance(infoRows) {
  const row = (infoRows ?? []).find((r) => r.label === 'Att')
  if (!row?.value) return null
  const n = Number(String(row.value).replace(/[^\d]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

function upsertTeam(db) {
  return db.prepare(
    `INSERT INTO attendance_team_totals (team_id, season, games, sum, high, low)
     VALUES (?, ?, 1, ?, ?, ?)
     ON CONFLICT(team_id, season) DO UPDATE SET
       games = attendance_team_totals.games + 1,
       sum = attendance_team_totals.sum + excluded.sum,
       high = CASE WHEN attendance_team_totals.high IS NULL OR excluded.high > attendance_team_totals.high
                   THEN excluded.high ELSE attendance_team_totals.high END,
       low = CASE WHEN attendance_team_totals.low IS NULL OR excluded.low < attendance_team_totals.low
                  THEN excluded.low ELSE attendance_team_totals.low END`,
  )
}

function markIngested(db) {
  return db.prepare('INSERT OR IGNORE INTO attendance_ingested_games (game_pk, season) VALUES (?, ?)')
}

async function ingestGame(db, stmts, gamePk, season) {
  const box = await getJson(`/api/v1/game/${gamePk}/boxscore`)
  const homeTeamId = box?.teams?.home?.team?.id ?? null
  const attendance = parseAttendance(box?.info)
  if (homeTeamId != null && attendance != null) {
    stmts.team.run(homeTeamId, season, attendance, attendance, attendance)
  }
  stmts.mark.run(gamePk, season)
}

export function exportAttendance(db) {
  const ingested = db.prepare('SELECT game_pk FROM attendance_ingested_games').all()
  const rows = db.prepare('SELECT * FROM attendance_team_totals ORDER BY season, team_id').all()
  const seasons = {}
  for (const r of rows) {
    const bucket = (seasons[r.season] ??= { byTeamId: {} })
    bucket.byTeamId[r.team_id] = {
      games: r.games,
      avg: r.games > 0 ? Math.round(r.sum / r.games) : null,
      high: r.high,
      low: r.low,
    }
  }
  return { generatedAt: new Date().toISOString(), gamesIngested: ingested.length, seasons }
}

async function writeAttendance(db) {
  await writeJsonAtomic(out, exportAttendance(db))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { startDate, endDate } = dateRange(args, DEFAULT_DAYS)

  const db = await openDb()
  const stmts = { team: upsertTeam(db), mark: markIngested(db) }

  const existing = new Set(db.prepare('SELECT game_pk FROM attendance_ingested_games').all().map((r) => r.game_pk))

  // MLB regular season only. Same postponed-replay dedup as gen-fouls.mjs: a
  // replayed game is listed under both dates; keep only the officialDate bucket.
  const schedule = await getJson(
    `/api/v1/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}&gameType=R`,
  )
  const pending = []
  for (const d of schedule.dates ?? []) {
    for (const g of d.games ?? []) {
      if (g.status?.abstractGameState !== 'Final') continue
      if (d.date !== g.officialDate) continue
      if (existing.has(g.gamePk)) continue
      pending.push({ gamePk: g.gamePk, season: g.season ?? Number(g.officialDate.slice(0, 4)) })
    }
  }
  console.log(`${startDate}..${endDate}: ${pending.length} un-ingested Final MLB regular-season games`)

  const writeOut = async () => {
    await dumpGroup(db, 'attendance')
    await writeAttendance(db)
  }

  let done = 0
  const queue = [...pending]
  async function worker() {
    while (queue.length) {
      const g = queue.shift()
      if (!g) return
      try {
        await ingestGame(db, stmts, g.gamePk, g.season)
      } catch (err) {
        console.error(`gamePk ${g.gamePk}: ${err.message}`)
      }
      done += 1
      if (done % CHECKPOINT_EVERY === 0) {
        console.log(`${done}/${pending.length} ingested, checkpointing...`)
        await writeOut()
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  await writeOut()

  const total = db.prepare('SELECT COUNT(*) AS n FROM attendance_ingested_games').get().n
  console.log(`wrote ${out} — ${total} games on file (+${done} swept this run)`)
  db.close()
}

// Only sweep when run as a script — keeps parseAttendance/exportAttendance
// importable for tests without triggering a live fetch + file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
