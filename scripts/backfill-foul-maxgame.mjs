// One-time migration: populate max_game_pa / max_game_pitches / max_game_opp_id
// on foul_batter_totals for batters whose single-game-high already predates the
// schema addition (see scripts/lib/schema.sql). Ordinary nightly gen-fouls.mjs
// runs only touch those columns when a NEW game beats the stored max, so a
// batter whose max happened before this migration would otherwise carry zeros
// forever. Same footing as gen-rookies-backfill.mjs: a one-time historical sweep,
// not part of the nightly cron, safe to re-run (only fills rows that still read
// max_game_pa = 0, so an interrupted run resumes without re-fetching).
//
// Deliberately scoped to the TOP N batters by max_game_fouls (the only ones any
// Single-Game-Highs board actually shows) rather than every batter on file —
// walking every batter's own game would mean fetching several hundred distinct
// game feeds for rows nothing renders. Any batter outside this cut keeps zeros
// until his own max-game event happens to be a NEW one after this migration
// (which the ordinary nightly run then fills in naturally).
//
//   node scripts/backfill-foul-maxgame.mjs [--top=20]
import { openDb, dumpGroup } from './lib/db.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportFouls } from './gen-fouls.mjs'

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

// Walks one game's feed for one batter's PA/pitches-seen + opponent, same
// counting rule as aggregateGameFouls's isPA test.
async function maxGameStatsFor(feed, personId) {
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const NON_PA = new Set([
    'stolen_base_2b', 'stolen_base_3b', 'stolen_base_home', 'caught_stealing_2b',
    'caught_stealing_3b', 'caught_stealing_home', 'pickoff_1b', 'pickoff_2b',
    'pickoff_3b', 'wild_pitch', 'passed_ball', 'balk', 'defensive_indiff', 'other_advance',
  ])
  let pa = 0
  let pitches = 0
  let opponentId = null
  for (const play of plays) {
    if (play.matchup?.batter?.id !== personId) continue
    const half = play.about?.halfInning
    opponentId = half === 'top' ? homeId : awayId
    if (!NON_PA.has(play.result?.eventType)) pa += 1
    pitches += (play.playEvents ?? []).filter((e) => e.isPitch).length
  }
  return { pa, pitches, opponentId }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const top = Number(args.top) || 20

  const db = await openDb()
  const rows = db
    .prepare(
      `SELECT person_id, max_game_pk FROM foul_batter_totals
       WHERE max_game_pk IS NOT NULL AND max_game_pa = 0
       ORDER BY max_game_fouls DESC LIMIT ?`,
    )
    .all(top)

  console.log(`backfilling ${rows.length} batter(s)' max-game PA/pitches/opponent`)

  const update = db.prepare(
    `UPDATE foul_batter_totals SET max_game_pa = ?, max_game_pitches = ?, max_game_opp_id = ?
     WHERE person_id = ?`,
  )

  const feedCache = new Map()
  for (const row of rows) {
    let feed = feedCache.get(row.max_game_pk)
    if (!feed) {
      feed = await getJson(`/api/v1.1/game/${row.max_game_pk}/feed/live`)
      feedCache.set(row.max_game_pk, feed)
    }
    const { pa, pitches, opponentId } = await maxGameStatsFor(feed, row.person_id)
    update.run(pa, pitches, opponentId, row.person_id)
    console.log(`  person ${row.person_id}: gamePk ${row.max_game_pk} -> ${pa} PA, ${pitches} pitches, opp ${opponentId}`)
  }

  await dumpGroup(db, 'fouls')
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(exportFouls(db)))
  console.log(`wrote ${out}`)
  db.close()
}

await main()
