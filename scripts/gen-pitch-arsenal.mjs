// Regenerates public/data/pitch-arsenal.json — each pitcher's season pitch-type
// mix (share of pitches thrown + average velocity per type), split MLB vs AAA.
//
// WHY MLB + AAA, NOT JUST MLB. Every AAA park (like MLB's) feeds Hawk-Eye pitch
// tracking — confirmed live against a real AAA gamePk's feed, same
// `playEvents[].details.type.code` + `.pitchData.startSpeed` fields MLB carries
// (see scripts/CLAUDE.md's gen-umpire-accuracy.mjs entry for the same fact,
// established there first). AA and below carry no pitch-type data at all, so
// this script never sweeps them — same two-level split as gen-umpire-accuracy.mjs
// (`level: 'mlb' | 'aaa'`, kept SEPARATE rather than blended, since they're
// different peer pools).
//
// WHY A SWEEP (not a one-call rebuild). Pitch-type mix isn't pre-totaled
// anywhere in the API — the only source is each game's per-pitch play-by-play.
// A Final game's pitch mix is immutable, so this is an APPEND-ONLY/incremental
// sweep in the mould of gen-fouls.mjs: each run scans a trailing window of
// schedule Finals per level, fetches the live feed for every gamePk not yet
// ingested (at that level), folds the per-pitcher/pitch-type deltas into the
// shared SQLite layer (scripts/lib/schema.sql's pitch_arsenal_* tables,
// docs/adr/0021) via incrementing upserts, and marks it in
// pitch_arsenal_ingested_games so a resumed/re-run sweep never double-counts.
// NEVER stores a feed on disk.
//
// Runs on the nightly cron; also by hand:
//   node scripts/gen-pitch-arsenal.mjs                       # trailing 3 days, both levels
//   node scripts/gen-pitch-arsenal.mjs --days=7
//   node scripts/gen-pitch-arsenal.mjs --since=2026-03-20 [--until=2026-07-19]
//   node scripts/gen-pitch-arsenal.mjs --since=2026-03-20 --sports=11   # backfill AAA alone
//   node scripts/gen-pitch-arsenal.mjs --export-only                    # re-export, no sweep
// The --since form is the one-time / full-season backfill; nightly runs use the
// default trailing window. Checkpoints (dump + JSON export) every 100 games so a
// long backfill resumes cleanly. --export-only rebuilds the JSON view from the
// rows already on file, for when a derived (not per-game) field like handedness
// changes and re-fetching every ingested feed would change nothing in the DB.
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { openDb, dumpGroup } from './lib/db.js'
import { getJson } from './lib/statsapi.mjs'
import { writeShards } from './lib/io.js'
import { shardKey100 } from '../src/lib/shardKey.js'
import { MIN_SIMILARITY_PITCHES } from '../src/lib/pitcherSimilarity.js'
import { CENTURY_MPH } from '../src/api/pitchArsenal.js'
import { parseArgs, dateRange } from './lib/args.mjs'

const here = dirname(fileURLToPath(import.meta.url))
// TWO OUTPUTS, one per reader — see writeArsenal below and src/api/pitchArsenal.js.
// Per-pitcher buckets for the opposing-starter card, one slim per-level pool for
// the player page's similarity ranking. Nothing reads the league in full, so
// nothing is written in full.
const outDir = join(here, '..', 'public', 'data', 'pitch-arsenal')
const outPools = join(here, '..', 'public', 'data', 'pitch-arsenal-pool')
const DEFAULT_DAYS = 3
const CHECKPOINT_EVERY = 100
const CONCURRENCY = 8

// --- pure per-game aggregation (exported for tests) --------------------------
//
// Walks one game's live feed and returns each pitcher's pitch-type deltas.
// No network, no DB — a pure function of the feed, so a synthetic fixture can
// drive the exact counting rules. Shape: Map personId -> { name, teamId,
// types: Map code -> { description, pitches, velocitySum, velocityN,
// centuryPitches, maxVelo, tto: [{pitches, velocitySum, velocityN} x3] } } —
// centuryPitches counts this type's pitches at CENTURY_MPH+ (the
// veloVariety/centuryClub/veloPeak callout families' data, docs/callouts.md);
// maxVelo is this type's single fastest pitch on file, regardless of the
// century floor, so a pitcher's hardest-ever reading is never lost even on a
// type that never clears it.
//
// `tto` splits the same pitches by TIMES THROUGH THE ORDER — how many times
// this pitcher had already faced THIS batter in THIS game when the pitch was
// thrown. Buckets are 1st, 2nd, and 3rd-or-later, capped at three because a
// fourth look is rare enough that its own bucket would be mostly noise, and
// because a starter's third time through is the split the reading is
// actually about. Counted per (pitcher, batter) within the game, so a batter
// who bats twice against one reliever and once against another gives each
// arm its own first look. The MLB Stats API publishes no times-through
// split, but this sweep already walks every play and already holds the
// batter, so the count rides along for free.
export function aggregateGamePitchTypes(feed) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null

  const pitchers = new Map()
  const getPitcher = (id, name, teamId) => {
    let p = pitchers.get(id)
    if (!p) {
      p = { name, teamId, types: new Map() }
      pitchers.set(id, p)
    } else {
      if (name) p.name = name
      if (teamId != null) p.teamId = teamId
    }
    return p
  }
  const getType = (p, code, desc) => {
    let t = p.types.get(code)
    if (!t) {
      t = {
        description: desc || '', pitches: 0, velocitySum: 0, velocityN: 0, centuryPitches: 0, maxVelo: null,
        tto: [
          { pitches: 0, velocitySum: 0, velocityN: 0 },
          { pitches: 0, velocitySum: 0, velocityN: 0 },
          { pitches: 0, velocitySum: 0, velocityN: 0 },
        ],
      }
      p.types.set(code, t)
    } else if (desc && !t.description) {
      t.description = desc
    }
    return t
  }

  // How many times each pitcher has already faced each batter in THIS game.
  // Keyed on the pair, not on the batter alone, so a pitching change resets
  // the count for the arm that comes in — his first look at that hitter is a
  // first look however deep into the game it happens.
  const faced = new Map()

  for (const play of plays) {
    const half = play?.about?.halfInning
    if (!half) continue
    const fieldingTeamId = half === 'top' ? homeId : awayId
    const pitcherId = play.matchup?.pitcher?.id ?? null
    if (pitcherId == null) continue
    const p = getPitcher(pitcherId, play.matchup?.pitcher?.fullName ?? '', fieldingTeamId)

    // One plate appearance is one look, counted once for the whole play
    // rather than per pitch. A batter with no id on file (it happens on
    // MiLB feeds) still has his pitches counted in the season totals; he
    // simply contributes to no times-through bucket, which is why the
    // buckets are read as their own denominators downstream and never
    // assumed to foot to `pitches`.
    const batterId = play.matchup?.batter?.id ?? null
    let ttoIndex = null
    if (batterId != null) {
      const key = `${pitcherId}:${batterId}`
      const seen = (faced.get(key) ?? 0) + 1
      faced.set(key, seen)
      ttoIndex = Math.min(seen, 3) - 1
    }

    for (const e of play.playEvents ?? []) {
      if (!e.isPitch) continue
      const code = e.details?.type?.code
      if (!code) continue
      const t = getType(p, code, e.details?.type?.description)
      t.pitches += 1
      const bucket = ttoIndex == null ? null : t.tto[ttoIndex]
      if (bucket) bucket.pitches += 1
      const speed = e.pitchData?.startSpeed
      if (typeof speed === 'number' && Number.isFinite(speed)) {
        t.velocitySum += speed
        t.velocityN += 1
        if (speed >= CENTURY_MPH) t.centuryPitches += 1
        if (t.maxVelo == null || speed > t.maxVelo) t.maxVelo = speed
        if (bucket) {
          bucket.velocitySum += speed
          bucket.velocityN += 1
        }
      }
    }
  }

  return pitchers
}

// --- SQLite upserts ----------------------------------------------------------
const upsertPitchType = (db) =>
  db.prepare(
    `INSERT INTO pitch_arsenal_totals
       (person_id, level, code, season, name, team_id, description, pitches, velocity_sum, velocity_n, century_pitches, max_velo,
        tto1_pitches, tto1_velocity_sum, tto1_velocity_n,
        tto2_pitches, tto2_velocity_sum, tto2_velocity_n,
        tto3_pitches, tto3_velocity_sum, tto3_velocity_n)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(person_id, level, code) DO UPDATE SET
       season = excluded.season,
       name = excluded.name,
       team_id = excluded.team_id,
       description = excluded.description,
       pitches = pitch_arsenal_totals.pitches + excluded.pitches,
       velocity_sum = pitch_arsenal_totals.velocity_sum + excluded.velocity_sum,
       velocity_n = pitch_arsenal_totals.velocity_n + excluded.velocity_n,
       century_pitches = pitch_arsenal_totals.century_pitches + excluded.century_pitches,
       max_velo = CASE
         WHEN pitch_arsenal_totals.max_velo IS NULL THEN excluded.max_velo
         WHEN excluded.max_velo IS NULL THEN pitch_arsenal_totals.max_velo
         ELSE MAX(pitch_arsenal_totals.max_velo, excluded.max_velo)
       END,
       tto1_pitches = pitch_arsenal_totals.tto1_pitches + excluded.tto1_pitches,
       tto1_velocity_sum = pitch_arsenal_totals.tto1_velocity_sum + excluded.tto1_velocity_sum,
       tto1_velocity_n = pitch_arsenal_totals.tto1_velocity_n + excluded.tto1_velocity_n,
       tto2_pitches = pitch_arsenal_totals.tto2_pitches + excluded.tto2_pitches,
       tto2_velocity_sum = pitch_arsenal_totals.tto2_velocity_sum + excluded.tto2_velocity_sum,
       tto2_velocity_n = pitch_arsenal_totals.tto2_velocity_n + excluded.tto2_velocity_n,
       tto3_pitches = pitch_arsenal_totals.tto3_pitches + excluded.tto3_pitches,
       tto3_velocity_sum = pitch_arsenal_totals.tto3_velocity_sum + excluded.tto3_velocity_sum,
       tto3_velocity_n = pitch_arsenal_totals.tto3_velocity_n + excluded.tto3_velocity_n`,
  )

const markIngested = (db) =>
  db.prepare('INSERT OR IGNORE INTO pitch_arsenal_ingested_games (game_pk, level, date) VALUES (?, ?, ?)')

// Fetch the feed (the only await), then fold the whole game in as one atomic
// synchronous transaction — same pattern as gen-fouls.mjs's ingestGame.
async function ingestGame(db, stmts, gamePk, level, date, season) {
  const feed = await getJson(`/api/v1.1/game/${gamePk}/feed/live`)
  const pitchers = aggregateGamePitchTypes(feed)
  db.exec('BEGIN')
  try {
    for (const [id, p] of pitchers) {
      for (const [code, t] of p.types) {
        stmts.pitchType.run(
          id, level, code, season, p.name, p.teamId, t.description,
          t.pitches, t.velocitySum, t.velocityN, t.centuryPitches, t.maxVelo,
          t.tto[0].pitches, t.tto[0].velocitySum, t.tto[0].velocityN,
          t.tto[1].pitches, t.tto[1].velocitySum, t.tto[1].velocityN,
          t.tto[2].pitches, t.tto[2].velocitySum, t.tto[2].velocityN,
        )
      }
    }
    stmts.mark.run(gamePk, level, date)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

// --- handedness --------------------------------------------------------------
//
// Which way each pitcher throws, for the player page's "Pitches like" card
// (src/lib/pitcherSimilarity.js), where it's a hard filter — a lefty and a
// righty with the same repertoire are not a useful answer to "who pitches like
// this guy".
//
// Resolved at EXPORT time from one bulk call per level rather than stored per
// game in pitch_arsenal_totals, which is why this needs no schema change and no
// backfill: every pitcher already on file gains a hand on the very next run,
// including every row swept before this existed. A per-game column would only
// have filled in as each pitcher next happened to appear.
//
// ~50 KB per level and never fatal — a failed lookup means the card filters
// more conservatively for a run (an unknown hand is skipped, never guessed),
// not that the sweep fails.
async function fetchPitcherHands(sportIds, season) {
  const hands = {}
  for (const sportId of sportIds) {
    try {
      const data = await getJson(
        `/api/v1/sports/${sportId}/players?season=${season}&fields=people,id,pitchHand,code`,
      )
      for (const p of data?.people ?? []) {
        const code = p?.pitchHand?.code
        if (p?.id != null && (code === 'L' || code === 'R')) hands[p.id] = code
      }
    } catch (err) {
      console.error(`pitcher hands (sportId ${sportId}): ${err.message}`)
    }
  }
  return hands
}

// --- JSON export from the accumulated table ----------------------------------
export function exportPitchArsenal(db, hands = {}) {
  const ingested = db.prepare('SELECT game_pk, level, date FROM pitch_arsenal_ingested_games').all()
  const coverageSince = ingested.reduce((min, r) => (min == null || r.date < min ? r.date : min), null)
  const seasonRow = db.prepare('SELECT season FROM pitch_arsenal_totals LIMIT 1').get()
  const season = seasonRow?.season ?? (Number((coverageSince ?? '').slice(0, 4)) || null)

  const pit = {}
  for (const r of db.prepare('SELECT * FROM pitch_arsenal_totals ORDER BY person_id, level, pitches DESC').all()) {
    const entry = pit[r.person_id] ?? (pit[r.person_id] = { name: r.name, teamId: r.team_id, mlb: [], aaa: [] })
    entry.name = r.name
    entry.teamId = r.team_id
    // Absent rather than null for a pitcher with no hand on file — the reader
    // treats a missing hand as "don't guess", and an omitted key keeps the
    // committed file from growing a column of nulls.
    if (hands[r.person_id]) entry.throws = hands[r.person_id]
    const type = {
      code: r.code,
      description: r.description,
      pitches: r.pitches,
      avgVelo: r.velocity_n > 0 ? Math.round((r.velocity_sum / r.velocity_n) * 10) / 10 : null,
      century: r.century_pitches,
      maxVelo: r.max_velo,
    }
    // The times-through split, only when the row actually carries one. Rows
    // ingested before the sweep started counting it hold nine zeroes, and an
    // all-zero `tto` would tell the reader "he threw nothing on any look"
    // rather than "this was never measured" — so the key is omitted instead,
    // and the reader treats absent as unknown and hides the filter.
    //
    // PAIRS, not objects, and trailing empty looks trimmed: this rides in a
    // per-pitcher bucket the player page fetches on its own, and the bucket
    // has a 30 KB ceiling it is measured against (test/bucket-shards.test.js).
    // Spelled out as {pitches, avgVelo} the split alone pushed the largest
    // bucket past it; `[616, 101.3]` says the same thing in a third of the
    // bytes. The reader names the positions.
    const tto = [1, 2, 3].map((n) => [
      r[`tto${n}_pitches`],
      r[`tto${n}_velocity_n`] > 0
        ? Math.round((r[`tto${n}_velocity_sum`] / r[`tto${n}_velocity_n`]) * 10) / 10
        : null,
    ])
    while (tto.length && tto[tto.length - 1][0] === 0) tto.pop()
    if (tto.length) type.tto = tto
    entry[r.level].push(type)
  }

  return {
    season,
    asOf: new Date().toISOString(),
    coverageSince,
    gamesIngested: ingested.length,
    pit,
  }
}

// Both files, cut from ONE export so they cannot disagree:
//
//   • pitch-arsenal/{NN}.json — every pitcher's full entry, bucketed on
//     `personId % 100` (shardKey100, imported from the app so the generator and
//     the reader agree on where a man went). The mix bar wants one starter.
//   • pitch-arsenal-pool/{mlb,aaa}.json — the similarity pool, and deliberately
//     LESS than the buckets carry. One level per file (the two are never ranked
//     against each other), only arms past MIN_SIMILARITY_PITCHES (an arm below
//     it is dropped by the ranker anyway, so shipping him is pure weight), and
//     no `description` — the ranking reads `code`. 692 KB became 149 + 194.
async function writeArsenal(db, hands) {
  const data = exportPitchArsenal(db, hands)
  const buckets = new Map()
  for (const [id, entry] of Object.entries(data.pit ?? {})) {
    const key = shardKey100(id)
    if (!buckets.has(key)) buckets.set(key, { season: data.season, asOf: data.asOf, pit: {} })
    buckets.get(key).pit[id] = entry
  }
  await writeShards(outDir, [...buckets])

  const pools = new Map([
    ['mlb', { season: data.season, asOf: data.asOf, level: 'mlb', pit: {} }],
    ['aaa', { season: data.season, asOf: data.asOf, level: 'aaa', pit: {} }],
  ])
  for (const [id, entry] of Object.entries(data.pit ?? {})) {
    for (const level of ['mlb', 'aaa']) {
      const rows = entry[level]
      if (!rows?.length) continue
      if (rows.reduce((n, t) => n + t.pitches, 0) < MIN_SIMILARITY_PITCHES) continue
      pools.get(level).pit[id] = {
        name: entry.name,
        teamId: entry.teamId,
        throws: entry.throws,
        types: rows.map((t) => ({ code: t.code, pitches: t.pitches, avgVelo: t.avgVelo })),
      }
    }
  }
  await writeShards(outPools, [...pools])
}

// --- CLI ---------------------------------------------------------------------
// The levels swept, most-senior first — see header for why AAA rides along
// and AA/below don't.
const ALL_LEVELS = [
  { sportId: 1, level: 'mlb' },
  { sportId: 11, level: 'aaa' },
]

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { startDate, endDate } = dateRange(args, DEFAULT_DAYS)
  const sportsFilter = args.sports
    ? new Set(String(args.sports).split(',').map((s) => Number(s.trim())))
    : null
  const LEVELS = sportsFilter ? ALL_LEVELS.filter((l) => sportsFilter.has(l.sportId)) : ALL_LEVELS

  const db = await openDb()
  const stmts = {
    pitchType: upsertPitchType(db),
    mark: markIngested(db),
  }

  // Resolved once up front and reused by every checkpoint write below.
  const hands = await fetchPitcherHands(LEVELS.map((l) => l.sportId), new Date().getFullYear())
  console.log(`resolved throwing hand for ${Object.keys(hands).length} pitchers`)

  // Re-export the JSON view from the rows already on file, with no sweep. The
  // use is a derived field that isn't stored per game (handedness above): after
  // adding one, this refreshes the committed file in seconds instead of
  // re-fetching every ingested game's feed to change nothing in the database.
  if (args['export-only']) {
    await writeArsenal(db, hands)
    console.log(`wrote ${outDir} (export only — no games swept)`)
    db.close()
    return
  }

  const existing = new Set(
    db.prepare('SELECT game_pk, level FROM pitch_arsenal_ingested_games').all().map((r) => `${r.game_pk}:${r.level}`),
  )

  // Regular season only, both levels. Same postponed-replay dedup as the other
  // sweeps: a replayed game is listed under both dates; keep only the
  // officialDate bucket.
  const pending = []
  for (const { sportId, level } of LEVELS) {
    const schedule = await getJson(
      `/api/v1/schedule?sportId=${sportId}&startDate=${startDate}&endDate=${endDate}&gameType=R`,
    )
    for (const d of schedule.dates ?? []) {
      for (const g of d.games ?? []) {
        if (g.status?.abstractGameState !== 'Final') continue
        if (d.date !== g.officialDate) continue
        if (existing.has(`${g.gamePk}:${level}`)) continue
        pending.push({ gamePk: g.gamePk, level, date: g.officialDate, season: g.season ?? Number(g.officialDate.slice(0, 4)) })
      }
    }
  }
  console.log(`${startDate}..${endDate}: ${pending.length} un-ingested Final regular-season games across ${LEVELS.length} level(s)`)

  const writeOut = async () => {
    await dumpGroup(db, 'pitch-arsenal')
    await writeArsenal(db, hands)
  }

  let done = 0
  const queue = [...pending]
  async function worker() {
    while (queue.length) {
      const g = queue.shift()
      if (!g) return
      try {
        await ingestGame(db, stmts, g.gamePk, g.level, g.date, g.season)
      } catch (err) {
        console.error(`gamePk ${g.gamePk} (${g.level}): ${err.message}`)
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

  const total = db.prepare('SELECT COUNT(*) AS n FROM pitch_arsenal_ingested_games').get().n
  console.log(`wrote ${outDir} — ${total} games on file (+${done} swept this run)`)
  db.close()
}

// Only sweep when run as a script — keeps aggregateGamePitchTypes /
// exportPitchArsenal importable for tests without triggering a live fetch +
// file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
