// Regenerates public/data/abs-challenges.json — every Automated Ball-Strike
// challenge of the season, at every level that runs the system, and the splits
// the /abs-challenges report page reads
// (src/api/around-the-game/absChallenges.js).
//
// 2026 is the first MLB season of the ABS Challenge System. A club is issued
// two challenges, keeps one every time the plate umpire's call is overturned,
// and loses one every time the call stands. Nothing in this app aggregated
// that across a season before: src/api/challenges.js derives one game's
// challenges live for the box score, and gen-umpire-accuracy.mjs counts them
// per umpire, but neither answers "who challenges, who wins, and what has it
// been worth".
//
// LEVELS: MLB (sportId 1) and TRIPLE-A (sportId 11). Triple-A has run the
// challenge system for several seasons and its feeds carry the same real `MJ`
// reviews — verified against gamePks 815863, 816463 and 816544, three and four
// challenges apiece. (The LIVE box-score row is still MLB-only, because
// challenges.js's gameHasAbs gate reads sport.id === 1. That gate is a live-UI
// question with its own spoiler footing and is deliberately untouched here;
// this generator decides its own levels.) AA and below run no ABS at all.
//
// APPEND-ONLY, same shape as gen-comeback-wins.mjs / gen-fouls.mjs: each run
// sweeps a small trailing window of newly-Final games and ingests only the
// gamePks the ledger has not seen. A Final game's challenges are immutable, so
// a swept game is never refetched.
//
//   node scripts/gen-abs-challenges.mjs                    # trailing 3 days
//   node scripts/gen-abs-challenges.mjs --days=7
//   node scripts/gen-abs-challenges.mjs --since=2026-03-26 [--until=2026-07-10]
//   node scripts/gen-abs-challenges.mjs --since=2026-03-26 --sports=11
//   node scripts/gen-abs-challenges.mjs --export-only
//   node scripts/gen-abs-challenges.mjs --rebuild --since=2026-03-26
//
// The --since form is the one-time backfill (2026-03-26 is Opening Day, and
// there is no MLB history before it — the system did not exist). --sports
// restricts the sweep to a comma-separated list of sportIds, which is how a
// level is added to a file that already holds the other. --export-only
// re-derives every split from the rows already on file and writes the JSON: it
// is what a new cut of the data costs, because the database stores FACTS and
// scripts/lib/abs-challenges.mjs derives everything else. --rebuild clears
// both tables first, for a schema change that makes old rows unusable.
//
// Every pure part of this job — the per-game row derivation and every export
// split — lives in scripts/lib/abs-challenges.mjs, because this file does its
// work at import and so nothing inside it could be unit-tested. This file is
// the sweep: dates in, feeds fetched, rows written, JSON out.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs, dateRange } from './lib/args.mjs'
import { buildExport, challengeRowsForGame } from './lib/abs-challenges.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'abs-challenges.json')
const reTablePath = join(here, '..', 'public', 'data', 'run-expectancy.json')

const DEFAULT_DAYS = 3
const CONCURRENCY = 6
const BATCH = CONCURRENCY * 4
const CHECKPOINT_EVERY = 240

// The levels that run the ABS challenge system, most senior first. AA and
// below carry neither the rig nor the rule, so they stay out.
const ALL_LEVELS = [
  { sportId: 1, level: 'MLB' },
  { sportId: 11, level: 'AAA' },
]

// Regular season plus postseason. The All-Star Game (gameType A) is left out
// on purpose: it is an exhibition, and folding its challenges into a league
// success rate would put the only unserious rows on the board.
const GAME_TYPES = 'R,F,D,L,W'

// The run-expectancy table, loaded once. Absent until gen-run-expectancy.mjs
// has been run at least once, in which case `favor` stays null on every row
// swept this run and the page's run figures degrade to "not computed" rather
// than to zero.
const reTable = await readJsonOr(reTablePath, null)
if (!reTable) console.log('run-expectancy.json not found — favor will be null this run')

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++
      try {
        results[i] = await fn(items[i])
      } catch (err) {
        console.error(`gamePk ${items[i]?.gamePk}: ${err.message}`)
        results[i] = null
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

const args = parseArgs(process.argv.slice(2))
const { startDate, endDate } = dateRange(args, DEFAULT_DAYS)
const season = Number(endDate.slice(0, 4))

const db = await openDb()
if (args.rebuild) {
  db.exec('DELETE FROM abs_challenges; DELETE FROM abs_ingested_games;')
  console.log('--rebuild: cleared abs_challenges + abs_ingested_games')
}

const insertRow = db.prepare(
  `INSERT OR REPLACE INTO abs_challenges
     (game_pk, seq, season, date, level, team_id, opp_id, side, player_id, player_name,
      role, outcome, inning, half, umpire_id, umpire_name, call_type, favor, miss_inches)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
)
const markIngested = db.prepare(
  `INSERT OR REPLACE INTO abs_ingested_games
     (game_pk, date, season, level, away_team_id, home_team_id, umpire_id, challenges)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
)

async function writeOut() {
  await dumpGroup(db, 'abs-challenges')
  const rows = db.prepare('SELECT * FROM abs_challenges ORDER BY game_pk, seq').all()
  const games = db.prepare('SELECT * FROM abs_ingested_games ORDER BY game_pk').all()
  const latest = games.reduce((m, g) => (g.season > m ? g.season : m), 0)
  await writeJsonAtomic(out, buildExport(rows, games, { season: latest || season }))
  return { rows: rows.length, games: games.length }
}

if (args['export-only']) {
  const { rows, games } = await writeOut()
  console.log(`wrote ${out} — export only (${rows} challenges over ${games} games on file)`)
  db.close()
} else {
  const sportsFilter = args.sports
    ? new Set(String(args.sports).split(',').map((s) => Number(s.trim())))
    : null
  const levels = sportsFilter ? ALL_LEVELS.filter((l) => sportsFilter.has(l.sportId)) : ALL_LEVELS

  const existing = new Set(
    db.prepare('SELECT game_pk FROM abs_ingested_games').all().map((r) => String(r.game_pk)),
  )

  // Collect every Final game in the window, skipping what is already on file.
  // Same postponed-replay dedup as gen-umpire-accuracy.mjs: a replayed game is
  // listed under both its original date and its officialDate, and only the
  // bucket matching officialDate is kept.
  const targets = []
  for (const { sportId, level } of levels) {
    const schedule = await getJson(
      `/api/v1/schedule?sportId=${sportId}&startDate=${startDate}&endDate=${endDate}` +
        `&gameType=${GAME_TYPES}&hydrate=officials,team`,
    )
    for (const d of schedule.dates ?? []) {
      for (const g of d.games ?? []) {
        if (g.status?.abstractGameState !== 'Final') continue
        if (g.status?.detailedState === 'Postponed') continue
        if (d.date !== g.officialDate) continue
        if (existing.has(String(g.gamePk))) continue
        const hp = (g.officials ?? []).find((o) => o.officialType === 'Home Plate')
        targets.push({
          gamePk: g.gamePk,
          date: g.officialDate ?? (g.gameDate ?? '').slice(0, 10),
          level,
          awayTeamId: g.teams?.away?.team?.id ?? null,
          homeTeamId: g.teams?.home?.team?.id ?? null,
          umpId: hp?.official?.id ?? null,
          umpName: hp?.official?.fullName ?? '',
        })
      }
    }
  }

  console.log(`${targets.length} game(s) to ingest (${startDate}..${endDate})`)

  let ingested = 0
  let found = 0
  let sinceCheckpoint = 0
  // Fetched in parallel, written serially: node:sqlite writes are synchronous,
  // and a batch boundary is also the checkpoint boundary, so a killed backfill
  // resumes from the last completed batch rather than from the top.
  for (let i = 0; i < targets.length; i += BATCH) {
    const fetched = await mapWithConcurrency(targets.slice(i, i + BATCH), CONCURRENCY, async (t) => ({
      target: t,
      feed: await getJson(`/api/v1.1/game/${t.gamePk}/feed/live`),
    }))
    for (const item of fetched) {
      // A failed fetch is NOT marked ingested, so a transient outage is retried
      // on the next run rather than leaving a permanent hole in the season.
      if (!item) continue
      const { target: t, feed } = item
      // The plate umpire, from the schedule's own officials hydration, falling
      // back to the feed's box score. A game with neither still counts toward
      // every club figure; only the umpire board loses it.
      const boxHp = (feed?.liveData?.boxscore?.officials ?? []).find(
        (o) => o.officialType === 'Home Plate',
      )
      const umpId = t.umpId ?? boxHp?.official?.id ?? null
      const umpName = t.umpName || boxHp?.official?.fullName || ''
      const rows = challengeRowsForGame(feed, reTable)
      const seasonOf = Number(t.date.slice(0, 4))
      for (const r of rows) {
        insertRow.run(
          t.gamePk, r.seq, seasonOf, t.date, t.level, r.team_id, r.opp_id,
          r.side, r.player_id, r.player_name, r.role, r.outcome, r.inning, r.half,
          umpId, umpName, r.call_type, r.favor, r.miss_inches,
        )
      }
      markIngested.run(
        t.gamePk, t.date, seasonOf, t.level, t.awayTeamId, t.homeTeamId, umpId, rows.length,
      )
      ingested++
      sinceCheckpoint++
      found += rows.length
    }
    if (sinceCheckpoint >= CHECKPOINT_EVERY) {
      sinceCheckpoint = 0
      await writeOut()
      console.log(`checkpoint: ${ingested} games ingested, ${found} challenges found`)
    }
  }

  const { rows, games } = await writeOut()
  console.log(
    `wrote ${out} — ${rows} challenges over ${games} games on file ` +
      `(+${ingested} games, +${found} challenges this run)`,
  )
  db.close()
}
