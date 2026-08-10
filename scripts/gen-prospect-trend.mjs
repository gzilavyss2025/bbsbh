// Regenerates public/data/prospect-trend.json — a stats-based, level-relative
// percentile signal for prospects in public/data/top-prospects.json, meant to
// complement (not replace) the weekly-refreshed Pipeline rank: a prospect's
// underlying performance can drift between re-ranks, and this reflects that
// drift straight from statsapi's own season splits.
//
// Deliberately NOT a Major League Equivalency — no external level-translation
// coefficients are hardcoded anywhere in this file or scripts/lib/
// prospectPercentile.mjs. A hitter's percentile is purely "how does his OPS
// compare to every other qualified hitter who logged time at his level this
// season" — see that module's header for the full reasoning.
//
// Same nightly SQLite snapshot + self-join pattern as gen-fever-radar.mjs:
// today's percentile is upserted into the shared player_snapshots table
// (scripts/lib/db.js, ADR-0021) under source 'prospect-trend' (board is the
// player's group, 'hitting' or 'pitching' — a player only ever carries one),
// and each exported row's `movement` compares against the nearest prior
// snapshot at least MOVEMENT_WINDOW_DAYS back — bbsbh's own recorded
// history, nothing an external source provides. The window is wider than
// gen-fever-radar.mjs's 6 days: a stat percentile moves slower than a
// third-party scouting radar's daily rank.
//
// Each row also carries `sampleSize` (PA or IP-outs — the same count the
// qualification gate already computed) and `populationSize` (how many
// players cleared the floor at his level), so a reader can weigh a 93rd
// percentile on 41 PA differently from one on 400; `history` is every
// snapshot this generator or scripts/gen-prospect-trend-backfill.mjs has ever
// recorded for him, oldest first — the full season's-worth once the one-time
// backfill has run — so a trend chart needs no separate fetch. `movement`
// itself is just `history`'s own two endpoints restated as a delta; once the
// backfill seeds real history, `movement` stops needing two live weeks to
// populate, because a snapshot 14+ days back already exists.
//
// Depends on public/data/top-prospects.json already existing
// (fetch-top-prospects.mjs, its own weekly GitHub Actions schedule) for the
// playerId list; skips gracefully — not a failure — if that snapshot is
// missing or empty, since the two crons run on independent schedules.
//
// This runs on a cron via .github/workflows/update-nightly-data.yml, NOT at
// request time. Run by hand: node scripts/gen-prospect-trend.mjs
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchLevelSeasonStats, combineToPool } from '../src/api/statsLevels.js'
import {
  meetsPlayingTimeFloor,
  percentileRank,
  primaryGroupFor,
  buildPopulations,
  populationKey,
} from './lib/prospectPercentile.mjs'
import { fetchLevelAverageAges } from './lib/prospectAgeBenchmark.mjs'
import { openDb, dumpGroup } from './lib/db.js'
import { writeJsonAtomic } from './lib/io.js'

const here = dirname(fileURLToPath(import.meta.url))
const topProspectsFile = join(here, '..', 'public', 'data', 'top-prospects.json')
const out = join(here, '..', 'public', 'data', 'prospect-trend.json')
const SOURCE = 'prospect-trend'
const MOVEMENT_WINDOW_DAYS = 14

// AAA/AA/A+/A — Rookie (16) excluded, same as gen-minors-leaders.mjs: no
// reliable stats there.
const LEVEL_SPORT_IDS = [11, 12, 13, 14]
const season = new Date().getFullYear()

async function loadProspectIds() {
  let snapshot
  try {
    snapshot = JSON.parse(await readFile(topProspectsFile, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return new Set()
    throw err
  }
  const ids = [...(snapshot.players ?? []), ...(snapshot.orgProspects ?? [])].map((p) => p.playerId)
  return new Set(ids.filter(Boolean))
}

const settled = (results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

const upsertSnapshot = (db) =>
  db.prepare(
    `INSERT INTO player_snapshots (date, player_id, board, source, payload_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, player_id, board, source) DO UPDATE SET payload_json = excluded.payload_json`,
  )

// Exports today's rows, each with a `movement` computed against the nearest
// EARLIER snapshot at least MOVEMENT_WINDOW_DAYS back — a plain self-join
// over the table this generator itself has been filling in, same pattern as
// gen-fever-radar.mjs's exportJson — plus the player's FULL recorded history
// (today's row included), oldest first, for the trend chart.
function exportJson(db, today, levelAverageAge) {
  const rows = db
    .prepare(
      `SELECT player_id, board, payload_json FROM player_snapshots
       WHERE date = ? AND source = ?
       ORDER BY player_id`,
    )
    .all(today, SOURCE)
  const historyStmt = db.prepare(
    `SELECT date, payload_json FROM player_snapshots
     WHERE player_id = ? AND board = ? AND source = ?
     ORDER BY date ASC`,
  )
  const players = rows.map((row) => {
    const payload = JSON.parse(row.payload_json)
    const prior = db
      .prepare(
        `SELECT date, payload_json FROM player_snapshots
         WHERE player_id = ? AND board = ? AND source = ? AND date <= date(?, '-${MOVEMENT_WINDOW_DAYS} days')
         ORDER BY date DESC LIMIT 1`,
      )
      .get(row.player_id, row.board, SOURCE, today)
    let movement = null
    if (prior) {
      const priorPayload = JSON.parse(prior.payload_json)
      if (payload.percentile != null && priorPayload.percentile != null) {
        movement = { delta: payload.percentile - priorPayload.percentile, sinceDate: prior.date }
      }
    }
    const history = historyStmt.all(row.player_id, row.board, SOURCE).map((h) => {
      const p = JSON.parse(h.payload_json)
      return { date: h.date, sportId: p.sportId, percentile: p.percentile, qualified: p.qualified }
    })
    return { playerId: row.player_id, group: row.board, ...payload, movement, history }
  })
  return { generatedAt: new Date().toISOString(), dataThrough: today, levelAverageAge, players }
}

async function main() {
  const prospectIds = await loadProspectIds()
  if (!prospectIds.size) {
    console.log('gen-prospect-trend: no prospects in top-prospects.json yet, skipping')
    return
  }

  const [hit, pit] = await Promise.all([
    Promise.allSettled(LEVEL_SPORT_IDS.map((sid) => fetchLevelSeasonStats(sid, 'hitting', season))),
    Promise.allSettled(LEVEL_SPORT_IDS.map((sid) => fetchLevelSeasonStats(sid, 'pitching', season))),
  ])
  const hitSplits = settled(hit)
  const pitSplits = settled(pit)
  const populations = buildPopulations(hitSplits, pitSplits)

  // Every qualified player's age, averaged per level — the Prospect Card's
  // age-benchmark fact. A separate bulk call (birthDate isn't on a season
  // split), so it runs once here rather than per prospect.
  const levelAverageAge = await fetchLevelAverageAges(hitSplits, pitSplits, LEVEL_SPORT_IDS)

  // Each prospect attributed to his PRIMARY level (highest reached, multi-
  // level lines summed) — the same combineToPool the app's own minors
  // leaderboards trust, so a promoted prospect lands on his current level's
  // line for free, no separate roster/affiliate lookup needed.
  const pool = combineToPool(hitSplits, pitSplits).filter((p) => prospectIds.has(p.id))

  const db = await openDb()
  const insert = upsertSnapshot(db)
  const today = new Date().toISOString().slice(0, 10)
  let qualifiedCount = 0
  for (const p of pool) {
    const group = primaryGroupFor(p.position, Boolean(p.hitting), Boolean(p.pitching))
    if (!group) continue
    const line = group === 'hitting' ? p.hitting : p.pitching
    const qualified = meetsPlayingTimeFloor(group, line)
    const population = populations.get(populationKey(p.sportId, group)) ?? []
    const metric = Number(group === 'hitting' ? line.ops : line.era)
    const percentile = qualified ? percentileRank(metric, population, group === 'hitting') : null
    if (percentile != null) qualifiedCount++
    const sampleSize = group === 'hitting' ? Number(line.plateAppearances) || 0 : Number(line.outs) || 0
    const payload = { sportId: p.sportId, percentile, qualified, sampleSize, populationSize: population.length }
    insert.run(today, p.id, group, SOURCE, JSON.stringify(payload))
  }
  await dumpGroup(db, 'player-snapshots')

  await writeJsonAtomic(out, exportJson(db, today, levelAverageAge))
  db.close()
  console.log(`wrote ${out} (${pool.length} prospects with a current-level line, ${qualifiedCount} qualified)`)
}

main().catch((err) => {
  console.error('gen-prospect-trend failed:', err.message)
  process.exit(1)
})
