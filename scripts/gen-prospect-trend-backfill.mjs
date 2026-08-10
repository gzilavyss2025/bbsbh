// One-time historical sweep for the prospect-trend percentile: reconstructs a
// weekly, level-relative OPS/ERA percentile checkpoint for every tracked
// prospect from each MiLB level's own real season-opening day through today,
// so the Prospect Card's trend chart shows the whole season on day one
// instead of building up two weeks at a time from whenever this script last
// ran.
//
// NOT ON THE NIGHTLY CRON (see scripts/gen-prospect-trend.mjs for that) — same
// category as gen-rookies-backfill.mjs/gen-milb-history.mjs: a one-time
// backfill, hand-run once, safe to re-run (every write is an upsert keyed on
// (date, player_id, board, source), so a re-run just recomputes the same
// rows) but not meant to run nightly — the nightly generator already keeps
// today's row current on its own schedule.
//
// THE KEY FACT THIS SCRIPT RESTS ON, verified live before writing it: statsapi's
// bulk `/api/v1/stats?stats=byDateRange&...&playerPool=all` returns a WHOLE
// LEVEL'S population bounded to a date range, in the same data.stats[0].splits
// shape fetchLevelSeasonStats already parses for "the season so far" — so a
// weekly checkpoint costs one call per (level, group), the same as the nightly
// generator's own "today" call, just with startDate/endDate instead of
// season-to-date. No per-player calls, no MLE, no invented coefficients — see
// scripts/lib/prospectPercentile.mjs's header for why this was scoped that way
// from the start.
//
// Because each checkpoint's population is built from THAT checkpoint's own
// bulk splits, a player who changed levels mid-season falls out correctly for
// free: his byDateRange line at a level only has stats if he actually played
// there in that window, so an early checkpoint attributes him to his spring
// level and a later one to wherever he was promoted — no separate roster-as-
// of-date lookup needed. That's also what lets the Prospect Card's trend
// chart mark a promotion: consecutive history points simply carry different
// sportId values.
//
// Run by hand: node scripts/gen-prospect-trend-backfill.mjs
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchLevelDateRangeStats, combineToPool } from '../src/api/statsLevels.js'
import {
  meetsPlayingTimeFloor,
  percentileRank,
  primaryGroupFor,
  buildPopulations,
  populationKey,
} from './lib/prospectPercentile.mjs'
import { getJson } from './lib/statsapi.mjs'
import { openDb, dumpGroup } from './lib/db.js'

const here = dirname(fileURLToPath(import.meta.url))
const topProspectsFile = join(here, '..', 'public', 'data', 'top-prospects.json')
const SOURCE = 'prospect-trend'
const LEVEL_SPORT_IDS = [11, 12, 13, 14]
const CHECKPOINT_INTERVAL_DAYS = 7
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

// The level's actual first game date this season, via the same schedule
// endpoint the app's own game-slate fetch already trusts — queried live
// rather than hardcoded, so a future season's backfill doesn't need an edit
// here. Falls back to null (level skipped entirely) if the level has no games
// in the window, e.g. a sportId that never fielded a schedule this season.
async function openingDayFor(sportId) {
  const data = await getJson(
    `/api/v1/schedule?sportId=${sportId}&season=${season}&startDate=${season}-01-01&endDate=${season}-07-01`,
  )
  const dates = (data.dates ?? []).map((d) => d.date).sort()
  return dates[0] ?? null
}

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const todayIso = () => new Date().toISOString().slice(0, 10)

// Every weekly checkpoint from the EARLIEST level's opening day through
// today — a single shared calendar rather than one per level, so all four
// levels' history lines up on the same x-axis. A level that opens later
// (A+/A historically starts ~10 days after AAA/AA) simply has no data for the
// checkpoints before its own opening day (see buildCheckpoint below).
function weeklyCheckpoints(earliestOpen) {
  const checkpoints = []
  let d = earliestOpen
  const today = todayIso()
  while (d <= today) {
    checkpoints.push(d)
    d = addDays(d, CHECKPOINT_INTERVAL_DAYS)
  }
  if (checkpoints[checkpoints.length - 1] !== today) checkpoints.push(today)
  return checkpoints
}

const settled = (results) => results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))

const upsertSnapshot = (db) =>
  db.prepare(
    `INSERT INTO player_snapshots (date, player_id, board, source, payload_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(date, player_id, board, source) DO UPDATE SET payload_json = excluded.payload_json`,
  )

// One checkpoint: fetch every level's byDateRange line from ITS OWN opening
// day through `checkpointDate` (skipping a level that hasn't opened yet),
// build the qualified populations, attribute each tracked prospect to his
// primary level, and upsert one row per prospect who has a line.
async function runCheckpoint(db, insert, checkpointDate, openingDayBySport, prospectIds) {
  const eligibleSports = LEVEL_SPORT_IDS.filter((sid) => openingDayBySport[sid] && openingDayBySport[sid] <= checkpointDate)
  if (!eligibleSports.length) return 0

  const [hit, pit] = await Promise.all([
    Promise.allSettled(
      eligibleSports.map((sid) => fetchLevelDateRangeStats(sid, 'hitting', season, openingDayBySport[sid], checkpointDate)),
    ),
    Promise.allSettled(
      eligibleSports.map((sid) => fetchLevelDateRangeStats(sid, 'pitching', season, openingDayBySport[sid], checkpointDate)),
    ),
  ])
  const hitSplits = settled(hit)
  const pitSplits = settled(pit)
  const populations = buildPopulations(hitSplits, pitSplits)
  const pool = combineToPool(hitSplits, pitSplits).filter((p) => prospectIds.has(p.id))

  let written = 0
  for (const p of pool) {
    const group = primaryGroupFor(p.position, Boolean(p.hitting), Boolean(p.pitching))
    if (!group) continue
    const line = group === 'hitting' ? p.hitting : p.pitching
    const qualified = meetsPlayingTimeFloor(group, line)
    const population = populations.get(populationKey(p.sportId, group)) ?? []
    const metric = Number(group === 'hitting' ? line.ops : line.era)
    const percentile = qualified ? percentileRank(metric, population, group === 'hitting') : null
    const sampleSize = group === 'hitting' ? Number(line.plateAppearances) || 0 : Number(line.outs) || 0
    const payload = { sportId: p.sportId, percentile, qualified, sampleSize, populationSize: population.length }
    insert.run(checkpointDate, p.id, group, SOURCE, JSON.stringify(payload))
    written++
  }
  return written
}

async function main() {
  const prospectIds = await loadProspectIds()
  if (!prospectIds.size) {
    console.log('gen-prospect-trend-backfill: no prospects in top-prospects.json yet, nothing to backfill')
    return
  }

  const openingDays = await Promise.all(LEVEL_SPORT_IDS.map(openingDayFor))
  const openingDayBySport = Object.fromEntries(LEVEL_SPORT_IDS.map((sid, i) => [sid, openingDays[i]]))
  const earliestOpen = openingDays.filter(Boolean).sort()[0]
  if (!earliestOpen) {
    console.log('gen-prospect-trend-backfill: no MiLB schedule found for this season, nothing to backfill')
    return
  }
  console.log(`level opening days: ${JSON.stringify(openingDayBySport)}`)

  const checkpoints = weeklyCheckpoints(earliestOpen)
  console.log(`backfilling ${checkpoints.length} weekly checkpoints from ${earliestOpen} through ${todayIso()}`)

  const db = await openDb()
  const insert = upsertSnapshot(db)
  let totalWritten = 0
  for (const checkpointDate of checkpoints) {
    const written = await runCheckpoint(db, insert, checkpointDate, openingDayBySport, prospectIds)
    totalWritten += written
    console.log(`  ${checkpointDate}: ${written} prospect rows`)
  }
  await dumpGroup(db, 'player-snapshots')
  db.close()
  console.log(
    `gen-prospect-trend-backfill: wrote ${totalWritten} rows across ${checkpoints.length} checkpoints. ` +
      `Run node scripts/gen-prospect-trend.mjs next to regenerate public/data/prospect-trend.json with the new history.`,
  )
}

main().catch((err) => {
  console.error('gen-prospect-trend-backfill failed:', err.message)
  process.exit(1)
})
