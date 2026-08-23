// Regenerates public/data/spray/{NN}.json — every batter's season balls in
// play, with where each one landed, how hard it was hit, and which hand threw
// the pitch. The player page's spray map reads one bucket (src/api/spray.js).
//
// WHY MLB + AAA, NOT JUST MLB. Landing coordinates come from the park, not from
// the league: every MLB and every AAA park is Hawk-Eye tracked, and below AAA
// the data is simply absent. Measured across four sampled windows of this
// season's feeds, 4,409 of 4,411 MLB and AAA balls in play carried a landing
// point. So this sweeps sportIds 1 and 11 and nothing else — the same two-level
// split gen-pitch-arsenal.mjs and gen-umpire-accuracy.mjs already make, and for
// the same reason.
//
// WHY A SWEEP (not a one-call rebuild). Batted-ball coordinates are not
// pre-totaled anywhere in the API. The one place they exist is each game's
// per-play `playEvents[].hitData`, whose coordinate space this repo has already
// verified against real feeds and pinned in test/hitchart.test.js — which is
// why the sweep reads the feed rather than Baseball Savant's statcast_search
// export. Savant's `hc_x`/`hc_y` are a DIFFERENT projection with a different
// origin and scale; adopting them would mean re-deriving both constants from
// scratch and running two coordinate spaces in one app, with a mirrored spray
// map as the failure mode nobody can see.
//
// DECIDED GAMES ONLY, NEVER TODAY'S. A Final game's batted balls are immutable,
// which is what makes this an append-only sweep — and it is also the whole
// spoiler footing of the card that reads it (src/api/spray.js's header). The
// filter is deliberately belt-and-braces: `abstractGameState === 'Final'` AND
// an officialDate strictly before today, so a game that goes Final while the
// nightly job is running still waits for tomorrow.
//
// THE STORE IS THE OUTPUT, which is this script's one deviation from
// gen-pitch-arsenal.mjs / gen-fouls.mjs. Those two accumulate into the shared
// SQLite layer (docs/adr/0021) and export a much smaller JSON view from it.
// Here the two would be the same rows: a season is ~190,000 balls in play, and
// a TEXT dump of one row each (scripts/data/*.sql, plain INSERT statements) is
// roughly 17 MB — nine times the largest group on file, committed twice over
// alongside the JSON it would export. So the committed shards ARE the
// accumulator: each run reads them back, folds the new games in, and rewrites
// them. Everything else about the sweep is the sibling generators' shape —
// trailing window, Final-only, the postponed-replay dedup, bounded concurrency,
// periodic checkpoints, and an ingested-games ledger so a re-run never
// double-counts. The ledger is scripts/data/spray-ingested.json, beside the SQL
// dumps and owned by this script alone.
//
// Runs on the nightly cron; also by hand:
//   node scripts/gen-spray.mjs                     # trailing 3 days, both levels
//   node scripts/gen-spray.mjs --days=7
//   node scripts/gen-spray.mjs --since=2026-03-20 [--until=2026-08-22]
//   node scripts/gen-spray.mjs --since=2026-03-20 --sports=11   # backfill AAA alone
// The --since form is the one-time / full-season backfill; nightly runs use the
// default trailing window.
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readdir } from 'node:fs/promises'
import { getJson } from './lib/statsapi.mjs'
import { readJsonOr, writeJsonAtomic, writeShards } from './lib/io.js'
import { shardKey100 } from '../src/lib/shardKey.js'
import { HARD_HIT_MPH } from '../src/lib/ballpark/hitProjection.js'
import { parseArgs, dateRange, isoDay } from './lib/args.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'spray')
const ledgerPath = join(here, 'data', 'spray-ingested.json')

const DEFAULT_DAYS = 3
const CHECKPOINT_EVERY = 400
const CONCURRENCY = 8

// The levels swept, most-senior first — see the header for why AAA rides along
// and AA/below don't.
const ALL_LEVELS = [
  { sportId: 1, level: 'mlb' },
  { sportId: 11, level: 'aaa' },
]

// A whole feed/live body is ~800 KB and this sweep reads eleven paths out of
// it. `fields` is a flat allowlist of KEY NAMES (not paths), so it drags a few
// harmless extras along and cuts the body to ~29 KB — a 30x saving that turns a
// full-season backfill from a bandwidth problem into a few minutes. Verified
// against gamePk 823427: same play count, same hitData blocks, same coordinates
// as the unfiltered body.
const FEED_FIELDS = [
  'gameData', 'game', 'pk', 'season', 'teams', 'away', 'home', 'id', 'players',
  'fullName', 'batSide', 'code', 'liveData', 'plays', 'allPlays', 'about',
  'halfInning', 'result', 'eventType', 'matchup', 'batter', 'pitcher',
  'pitchHand', 'playEvents', 'hitData', 'coordinates', 'coordX', 'coordY',
  'launchSpeed',
].join(',')

// --- the stored row's coded columns -----------------------------------------
//
// One row per tracked ball in play:
//   [coordX, coordY, launchSpeed, result, hand, side, level, pitcherId]
// Positional and integer-coded, because a season is ~190,000 of them and
// spelling out eight keys apiece multiplies the committed bytes by four for
// nothing a reader gains. src/api/spray.js's decodeSprayBalls names them back.
const RESULT_CODE = { out: 0, single: 1, double: 2, triple: 3, hr: 4 }
const HAND_CODE = { R: 0, L: 1 }
const LEVEL_CODE = { mlb: 0, aaa: 1 }

// WHAT COUNTS AS A BALL IN PLAY: the presence of a `hitData` block, not a list
// of eventTypes. Measured over sixteen MLB and AAA games, the two coincide
// exactly — every in-play result carried one (field_out, single, double,
// triple, home_run, force_out, the double plays, fielders_choice, sac_fly,
// sac_bunt, field_error) and no strikeout, walk, hit-by-pitch or caught
// stealing did. Reading the block rather than enumerating the words means a
// result type this repo has never seen still lands in the right bucket.
//
// THE LAST BLOCK ON THE PLAY, not the first — the same rule
// api/hitchart.js's selectPlayBattedBall follows. A park that tracks a foul
// ball records it exactly the way it records the ball that ended the at-bat,
// and it is the terminal one the play's result describes.
function lastHitData(play) {
  const events = play?.playEvents ?? []
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i]?.hitData) return events[i].hitData
  }
  return null
}

const RESULT_OF = {
  single: 'single',
  double: 'double',
  triple: 'triple',
  home_run: 'hr',
}

// --- pure per-game aggregation (exported for tests) --------------------------
//
// Walks one game's live feed and returns each batter's deltas. No network, no
// disk — a pure function of the feed, so a synthetic fixture can drive the exact
// counting rules. Shape: Map batterId -> { name, teamId, bats, rows, totals },
// where `totals` is { R | L: [bip, hits, xbh, hr, hard] }.
//
// TOTALS AND ROWS ARE COUNTED SEPARATELY, on purpose. A ball in play with no
// landing point still counts in the totals and contributes no row — rare (about
// one in two thousand) but real, and home runs are among them. The card reads
// the totals for its numbers and the rows for its marks, then says so when the
// two disagree. Deriving the totals from the rows instead would under-report a
// man's home runs forever, with nothing on screen to show it.
export function aggregateGameSpray(feed, level) {
  const plays = feed?.liveData?.plays?.allPlays ?? []
  const awayId = feed?.gameData?.teams?.away?.id ?? null
  const homeId = feed?.gameData?.teams?.home?.id ?? null
  const people = feed?.gameData?.players ?? {}
  const levelCode = LEVEL_CODE[level] ?? 0

  const batters = new Map()
  for (const play of plays) {
    const half = play?.about?.halfInning
    if (half !== 'top' && half !== 'bottom') continue
    const hitData = lastHitData(play)
    if (!hitData) continue

    const batterId = play?.matchup?.batter?.id
    if (batterId == null) continue

    // Top bats away, bottom bats home — the same convention every other walk
    // of a feed in this repo uses.
    const teamId = half === 'bottom' ? homeId : awayId
    let entry = batters.get(batterId)
    if (!entry) {
      entry = {
        name: play?.matchup?.batter?.fullName ?? '',
        teamId,
        // His LISTED side, which is the only place 'S' appears — the per-plate-
        // appearance `matchup.batSide` resolves a switch-hitter to the side he
        // actually used, so it can never say he switch-hits.
        bats: people[`ID${batterId}`]?.batSide?.code ?? null,
        rows: [],
        totals: {},
      }
      batters.set(batterId, entry)
    }
    if (teamId != null) entry.teamId = teamId

    const hand = play?.matchup?.pitchHand?.code === 'L' ? 'L' : 'R'
    const side = play?.matchup?.batSide?.code === 'L' ? 'L' : 'R'
    const result = RESULT_OF[play?.result?.eventType] ?? 'out'
    const exitVelo = hitData.launchSpeed ?? null

    const totals = entry.totals[hand] ?? (entry.totals[hand] = [0, 0, 0, 0, 0])
    totals[0] += 1
    if (result !== 'out') totals[1] += 1
    if (result === 'double' || result === 'triple' || result === 'hr') totals[2] += 1
    if (result === 'hr') totals[3] += 1
    if (exitVelo != null && exitVelo >= HARD_HIT_MPH) totals[4] += 1

    const coordX = hitData.coordinates?.coordX ?? null
    const coordY = hitData.coordinates?.coordY ?? null
    if (coordX == null || coordY == null) continue
    entry.rows.push([
      round1(coordX),
      round1(coordY),
      exitVelo == null ? null : round1(exitVelo),
      RESULT_CODE[result],
      HAND_CODE[hand],
      HAND_CODE[side],
      levelCode,
      play?.matchup?.pitcher?.id ?? null,
    ])
  }
  return batters
}

const round1 = (n) => Math.round(n * 10) / 10

// --- the accumulating store (exported for tests) -----------------------------
//
// Folds one game's deltas into the carried-forward store, which is exactly the
// committed shards' `bat` maps merged (see the header). `date` is the game's
// officialDate, and it is what decides the club: a sweep runs concurrently and
// a backfill runs in whatever order the schedule hands it over, so "his current
// club" has to be the club from the LATEST game on file rather than the club
// from whichever fetch happened to land last.
export function foldGame(store, agg, date) {
  for (const [batterId, delta] of agg) {
    const entry = store[batterId] ?? (store[batterId] = { n: '', t: null, b: null, d: null, p: [], o: {} })
    if (entry.d == null || date >= entry.d) {
      entry.d = date
      entry.n = delta.name || entry.n
      if (delta.teamId != null) entry.t = delta.teamId
    }
    if (delta.bats) entry.b = delta.bats
    for (const row of delta.rows) entry.p.push(row)
    for (const [hand, totals] of Object.entries(delta.totals)) {
      const carried = entry.o[hand] ?? (entry.o[hand] = [0, 0, 0, 0, 0])
      for (let i = 0; i < carried.length; i++) carried[i] += totals[i]
    }
  }
}

// --- store IO ----------------------------------------------------------------

// Every committed bucket, merged back into one map. A season boundary resets:
// this card is season-to-date, so shards written for last season are simply not
// carried into this one (writeShards then sweeps the files they lived in).
async function readStore(season) {
  const files = (await readdir(outDir).catch(() => [])).filter((f) => /^\d\d\.json$/.test(f))
  const store = {}
  let carried = 0
  for (const f of files) {
    const shard = await readJsonOr(join(outDir, f), null)
    if (!shard || shard.season !== season) continue
    for (const [id, entry] of Object.entries(shard.bat ?? {})) {
      store[id] = entry
      carried++
    }
  }
  return { store, carried }
}

// One file per `personId % 100` bucket (shardKey100, imported from the app so
// the generator and the reader agree on where a batter went). A whole-league
// file would be ~7 MB for a page that prints one man's card.
async function writeStore(store, season) {
  const buckets = new Map()
  const asOf = new Date().toISOString()
  for (const [id, entry] of Object.entries(store)) {
    const key = shardKey100(id)
    if (!buckets.has(key)) buckets.set(key, { season, asOf, bat: {} })
    buckets.get(key).bat[id] = entry
  }
  // Every bucket, including the empty ones: a reader that asks for bucket 37
  // and gets a 404 caches the miss for the session, so the file exists and says
  // "nobody here" instead.
  for (let i = 0; i < 100; i++) {
    const key = String(i).padStart(2, '0')
    if (!buckets.has(key)) buckets.set(key, { season, asOf, bat: {} })
  }
  return writeShards(outDir, [...buckets].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
}

// --- CLI ---------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const { startDate, endDate } = dateRange(args, DEFAULT_DAYS)
  const today = isoDay(new Date())
  const sportsFilter = args.sports
    ? new Set(String(args.sports).split(',').map((s) => Number(s.trim())))
    : null
  const LEVELS = sportsFilter ? ALL_LEVELS.filter((l) => sportsFilter.has(l.sportId)) : ALL_LEVELS

  const season = new Date().getFullYear()
  const { store, carried } = await readStore(season)
  const ledger = await readJsonOr(ledgerPath, { season, games: [] })
  const ingested = new Set(ledger.season === season ? ledger.games : [])
  console.log(`carried ${carried} batters and ${ingested.size} ingested games for ${season}`)

  // Regular season only, both levels. Same postponed-replay dedup as the other
  // sweeps: a replayed game is listed under both dates, so keep only the
  // officialDate bucket.
  const pending = []
  for (const { sportId, level } of LEVELS) {
    const schedule = await getJson(
      `/api/v1/schedule?sportId=${sportId}&startDate=${startDate}&endDate=${endDate}&gameType=R` +
        '&fields=dates,date,games,gamePk,officialDate,status,abstractGameState,detailedState',
    )
    for (const d of schedule.dates ?? []) {
      for (const g of d.games ?? []) {
        if (g.status?.abstractGameState !== 'Final') continue
        // A CANCELLED GAME REPORTS AS FINAL. Twenty AAA games this season carry
        // `abstractGameState: 'Final'` with `detailedState: 'Cancelled'` and a
        // linescore that never reached the first inning — a game that was
        // called off, not one that was decided. Fetching them is a wasted
        // request that reads as a feed-shape failure downstream, since a
        // cancelled game's feed holds no contact at all.
        if (g.status?.detailedState === 'Cancelled') continue
        if (d.date !== g.officialDate) continue
        if (g.officialDate >= today) continue // decided games only, never today's
        if (ingested.has(g.gamePk)) continue
        pending.push({ gamePk: g.gamePk, level, date: g.officialDate })
      }
    }
  }
  console.log(
    `${startDate}..${endDate}: ${pending.length} un-ingested decided regular-season games across ${LEVELS.length} level(s)`,
  )

  const writeOut = async () => {
    await writeStore(store, season)
    await writeJsonAtomic(ledgerPath, { season, games: [...ingested].sort((a, b) => a - b) })
  }

  let done = 0
  let empty = 0
  const queue = [...pending]
  async function worker() {
    while (queue.length) {
      const g = queue.shift()
      if (!g) return
      try {
        const feed = await getJson(`/api/v1.1/game/${g.gamePk}/feed/live?fields=${FEED_FIELDS}`)
        const agg = aggregateGameSpray(feed, g.level)
        // A decided game with no tracked contact at all is either a very short
        // weather-shortened game or a `fields` allowlist that has stopped
        // matching the feed. Neither should fail the run, and neither should
        // pass unremarked — a silent zero is how a 30x bandwidth saving turns
        // into an empty dataset nobody notices.
        if (agg.size === 0) empty += 1
        foldGame(store, agg, g.date)
        ingested.add(g.gamePk)
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
  const { written, swept } = await writeStore(store, season)
  await writeJsonAtomic(ledgerPath, { season, games: [...ingested].sort((a, b) => a - b) })

  if (empty > 0) console.error(`${empty} decided game(s) yielded no tracked contact — check the feed shape`)
  const balls = Object.values(store).reduce((n, e) => n + e.p.length, 0)
  console.log(
    `wrote ${written} buckets (${swept} swept) — ${Object.keys(store).length} batters, ` +
      `${balls} plotted balls, ${ingested.size} games on file (+${done} swept this run)`,
  )
}

// Only sweep when run as a script — keeps aggregateGameSpray/foldGame
// importable for tests without triggering a live fetch and a file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
