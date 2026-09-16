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
// challenges apiece. Double-A (12) and High-A (13) run no ABS at all.
//
// This generator decides its own levels, and deliberately sweeps only those
// two. Single-A (14) runs the system in the FLORIDA STATE LEAGUE ALONE — real
// challenges, same `MJ` shape (issue #957 measured 116 of them over eight
// sampled dates) — while the Carolina and California Leagues do not. Adding
// that league here means a season backfill and a report page that splits one
// sportId into two populations, so it is left for its own change.
//
// The LIVE box-score row asks a different question and answers it its own way:
// challenges.js's gameHasAbs reads the feed's `gameData.absChallenges` key
// rather than a level, so it already covers every league that runs the system,
// this one included.
//
// APPEND-ONLY, same shape as gen-comeback-wins.mjs / gen-fouls.mjs: each run
// sweeps a small trailing window of newly-played games and ingests only the
// gamePks the ledger has not seen. A finished game's challenges are immutable,
// so a swept game is never refetched.
//
// WHICH GAMES ARE ADMITTED, and the exception append-only needs. A game is
// swept when its `codedGameState` is F — see isPlayedGame in
// scripts/lib/abs/rows.mjs for the evidence, and for why the detailed state's
// string is the wrong thing to match. The ledger is the DENOMINATOR every
// per-game figure divides by, so a game that was never played does not sit
// there harmlessly.
//
// A status can also change AFTER a sweep, and append-only alone would never
// notice: gamePk 815811 was taken in, then suspended by rain and cancelled
// outright, and its two innings sat in the ledger as a whole game. --recheck
// is the way back out. It re-reads the schedule over a window, compares every
// gamePk already on file, and DELETES the rows of any game that is no longer
// coded F, so the next ordinary run either re-ingests it properly or leaves it
// out. It is the only mode that removes anything short of --rebuild.
//
//   node scripts/gen-abs-challenges.mjs                    # trailing 3 days
//   node scripts/gen-abs-challenges.mjs --days=7
//   node scripts/gen-abs-challenges.mjs --since=2026-03-26 [--until=2026-07-10]
//   node scripts/gen-abs-challenges.mjs --since=2026-03-26 --sports=11
//   node scripts/gen-abs-challenges.mjs --export-only
//   node scripts/gen-abs-challenges.mjs --recheck [--since=2026-03-26]
//   node scripts/gen-abs-challenges.mjs --rebuild --since=2026-03-26
//
// The --since form is the one-time backfill (2026-03-26 is Opening Day, and
// there is no MLB history before it — the system did not exist). --sports
// restricts the sweep to a comma-separated list of sportIds, which is how a
// level is added to a file that already holds the other. --export-only
// re-derives every split from the rows already on file and writes the JSON: it
// is what a new cut of the data costs, because the database stores FACTS and
// scripts/lib/abs/ derives everything else. --rebuild clears both tables
// first, for a schema change that makes old rows unusable.
//
// Every pure part of this job — the per-game row derivation and every export
// split — lives in scripts/lib/abs/ (rows.mjs and export.mjs, behind
// index.mjs), because this file does its work at import and so nothing inside
// it could be unit-tested. This file is the sweep: dates in, feeds fetched,
// rows written, JSON out.
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs, dateRange } from './lib/args.mjs'
import { auditBank, buildExport, challengeRowsForGame, isPlayedGame } from './lib/abs/index.mjs'

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
  // THE CHALLENGE BANK, CHECKED AGAINST EVERY ROW ON FILE. A club cannot spend
  // a challenge it does not hold, so a club-game the model cannot pay for
  // means the REPLENISHMENT RULE has moved, not that a club overdrew. It is
  // the one rule in this job that MLB can change without changing a field
  // name, and nothing else would notice. See scripts/lib/abs/bank.mjs.
  const overdrawn = auditBank(rows)
  if (overdrawn.length) {
    console.log(`BANK RULE: ${overdrawn.length} club-game(s) the model cannot pay for:`)
    for (const b of overdrawn.slice(0, 10)) {
      console.log(`  gamePk ${b.gamePk} team ${b.teamId}: lost at [${b.failInnings}] (${b.overdrawn} over)`)
    }
  }
  return { rows: rows.length, games: games.length }
}

// --sports, shared by the sweep and --recheck.
const sportsFilter = args.sports
  ? new Set(String(args.sports).split(',').map((s) => Number(s.trim())))
  : null
const activeLevels = sportsFilter ? ALL_LEVELS.filter((l) => sportsFilter.has(l.sportId)) : ALL_LEVELS

if (args['export-only']) {
  const { rows, games } = await writeOut()
  console.log(`wrote ${out} — export only (${rows} challenges over ${games} games on file)`)
  db.close()
} else if (args.recheck) {
  // THE WAY BACK OUT OF AN APPEND-ONLY LEDGER. A game's status can change
  // after it was swept — 815811 was taken in, then suspended by rain and
  // cancelled — and nothing else in this job would ever look at it again.
  //
  // It re-reads the SCHEDULE rather than each game's feed: one call a month a
  // level answers for every gamePk at once, where a feed apiece would be a few
  // thousand. The two disagree for exactly this class of game — 815811's feed
  // still says `Suspended: Rain` while its schedule row says Cancelled — and
  // the schedule is the one that decides whether a game counts as played, so
  // it is also the right source, not only the cheap one.
  //
  // A gamePk the window does not carry is left alone. Absence from a schedule
  // slice is not evidence about a game; only a row that is present and no
  // longer coded F is.
  const onFile = db
    .prepare('SELECT game_pk, level, date, challenges FROM abs_ingested_games')
    .all()
  const seen = new Map()
  for (const { sportId } of activeLevels) {
    const schedule = await getJson(
      `/api/v1/schedule?sportId=${sportId}&startDate=${startDate}&endDate=${endDate}` +
        `&gameType=${GAME_TYPES}`,
    )
    for (const d of schedule.dates ?? []) {
      for (const g of d.games ?? []) {
        // Kept only for the row whose date IS the official one, the same
        // postponed-replay dedup the sweep uses: a replayed game is listed
        // under both dates, and the original row still reads Postponed.
        if (d.date !== g.officialDate) continue
        seen.set(String(g.gamePk), g.status)
      }
    }
  }

  const evict = onFile.filter((r) => {
    const status = seen.get(String(r.game_pk))
    return status && !isPlayedGame(status)
  })
  const dropGame = db.prepare('DELETE FROM abs_ingested_games WHERE game_pk = ?')
  const dropRows = db.prepare('DELETE FROM abs_challenges WHERE game_pk = ?')
  let lostChallenges = 0
  for (const r of evict) {
    const status = seen.get(String(r.game_pk))
    console.log(
      `evict ${r.game_pk} (${r.level} ${r.date}, ${r.challenges} challenge(s)) — ` +
        `${status.codedGameState} / ${status.detailedState}`,
    )
    lostChallenges += r.challenges
    dropRows.run(r.game_pk)
    dropGame.run(r.game_pk)
  }

  const { rows, games } = await writeOut()
  console.log(
    `--recheck ${startDate}..${endDate}: ${seen.size} scheduled game(s) read, ` +
      `${evict.length} evicted (-${lostChallenges} challenges) — ` +
      `${rows} challenges over ${games} games on file`,
  )
  db.close()
} else {
  const levels = activeLevels

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
        // WHICH GAMES COUNT — isPlayedGame, on codedGameState alone. A
        // cancelled game carries an abstract state of Final and no innings at
        // all, so the old abstract-Final-minus-Postponed rule put 23 non-games
        // on the Triple-A ledger and moved every per-game figure the page
        // prints. The rule and the evidence behind it are in
        // scripts/lib/abs/rows.mjs, where they can be unit-tested.
        if (!isPlayedGame(g.status)) continue
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
