// Regenerates public/data/spray/{season}/{NN}.json — every batter's season balls in
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
// THE POSTSEASON RIDES BESIDE THE REGULAR SEASON, NEVER BLENDED. MLB's sweep asks
// for `R,F,D,L,W`; a postseason game folds into a second map, `post`, which sits
// beside `bat` in the same bucket and has the same entry shape. A reader that
// knows only `bat` never sees it, so every regular-season chart is byte-for-byte
// what it was (ADR-0094 did the same for the pitch stores). A bucket with no
// postseason batter carries no `post` key at all. The ledger already keys on the
// gamePk, which is unique across game types, so a postseason game is swept once.
// Old postseason games are outside the nightly window: backfill by hand with
// `--since=<date> --sports=1`.
//
// ONE FOLDER PER SEASON (ADR-0086). A run folds games into its own season's
// folder and nothing else, and `spray/seasons.json` names the season the card
// serves: the latest one with data. The run's season is the year of the
// window's last day (or --season), and a game from another year is skipped. A
// run that has nothing for its season (January 1 to Opening Day) writes
// nothing, so the card keeps last season all winter. Before this, the January
// run wrote 100 empty buckets over the 2026 data. The ledger holds ONE season,
// the one last written: a new season's first game replaces it, and by then the
// season before is complete and never swept again.
//
// Runs on the nightly cron; also by hand:
//   node scripts/gen-spray.mjs                     # trailing 3 days, both levels
//   node scripts/gen-spray.mjs --days=7
//   node scripts/gen-spray.mjs --since=2026-03-20 [--until=2026-08-22]
//   node scripts/gen-spray.mjs --since=2026-03-20 --sports=11   # backfill AAA alone
//   node scripts/gen-spray.mjs --since=2026-09-29 --sports=1    # backfill the postseason
//   node scripts/gen-spray.mjs --season=2026 --since=2026-09-20  # name the season
//   node scripts/gen-spray.mjs --season=2026 --rebuild   # sweep the season again from scratch
// THE CONTACT STORE (#1912) is `NN.contact.json` beside each shard: launch angle,
// distance, the ball's xBA and the gamePk of each run of balls, aligned to the spray rows. It
// is no schema bump, on purpose: a bump would make the nightly cron rebuild the season. Until
// the full rebuild, a batter's older rows have no contact (`n` in his entry says so), and the
// reader takes either. The full rebuild is a separate run:
//   node scripts/gen-spray.mjs --season=2026 --rebuild
// A season stored under an older schema version rebuilds itself on the next
// run (see SCHEMA_VERSION), so the nightly cron performs that migration.
// The --since form is the one-time / full-season backfill; nightly runs use the
// default trailing window.
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readdir } from 'node:fs/promises'
import { getJson } from './lib/statsapi.mjs'
import { readJsonOr, writeJsonAtomic, writeSeasons, writeShards } from './lib/io.js'
import { shardKey100 } from '../src/lib/shardKey.js'
import { coveringRuns } from '../src/lib/seasons/combine.js'
import { readXwobaTable, xwobaOf } from './lib/pitch/xwoba.mjs'
import { round1 } from '../src/lib/math/number.js'
import { HARD_HIT_MPH } from '../src/lib/ballpark/hitProjection.js'
import { parseArgs, dateRange, isoDay } from './lib/args.mjs'
import { POSTSEASON_GAME_TYPES, scopeOfGameType } from './lib/records/postseason.mjs'
import { GAP_CAP, collectPending, runSweep } from './lib/sweep/retry.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const storeDir = join(here, '..', 'public', 'data', 'spray')
const seasonDir = (season) => join(storeDir, String(season))
const ledgerPath = join(here, 'data', 'spray-ingested.json')

const DEFAULT_DAYS = 3
const CHECKPOINT_EVERY = 400

// The levels swept, most-senior first — see the header for why AAA rides along
// and AA/below don't. MLB also reads its postseason (see the header); Triple-A's
// postseason game types are unverified, so it asks for `R` alone (ADR-0094).
const ALL_LEVELS = [
  { sportId: 1, level: 'mlb', gameTypes: `R,${POSTSEASON_GAME_TYPES}` },
  { sportId: 11, level: 'aaa', gameTypes: 'R' },
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
  'launchSpeed', 'venue', 'launchAngle', 'totalDistance',
].join(',')
// `venue` (with `id`, already above) keeps gameData.venue.id: the park each
// ball was hit in, for the park view (#1859). Measured on gamePk 823427: the
// body grows by the venue's id alone. `launchAngle` and `totalDistance` feed the
// contact store (#1912, see aggregateGameSpray).

// THE STORE'S SCHEMA VERSION, written into every bucket as `v`. Version 2 adds
// the park runs (`g`, see foldGame). A season whose buckets are older is
// REBUILT once, from January 1 with an empty store and an empty ledger, because
// its rows cannot be given a park after the fact: the rows of one batter are
// in fold order, not game order, and nothing in a row names its game. The
// version is written only when that sweep finishes, so a rebuild cut short
// starts over on the next run rather than leaving half a season unattributed.
export const SCHEMA_VERSION = 2

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
// THE CONTACT ROWS (#1912). `contact[i]` is the row beside `rows[i]`:
// [launchAngle, totalDistance, xBA in thousandths]. They go to a sibling store, not into
// the row: one shard holds one page's data, and these columns plus a gamePk run per game
// would push the busiest spray bucket from 153 KB to about 250 KB, past the 160 KB
// ceiling. Its own sibling file is about 60 KB there (measured on a synthetic file built from
// 1,633 real rows; see the ceiling in test/bucket-shards.test.js). `xba` is the season's xBA lattice (readXwobaTable(season, 'xba-table')), or
// null: the ball's xBA is then null.
//
// TOTALS AND ROWS ARE COUNTED SEPARATELY, on purpose. A ball in play with no
// landing point still counts in the totals and contributes no row — rare (about
// one in two thousand) but real, and home runs are among them. The card reads
// the totals for its numbers and the rows for its marks, then says so when the
// two disagree. Deriving the totals from the rows instead would under-report a
// man's home runs forever, with nothing on screen to show it.
export function aggregateGameSpray(feed, level, xba = null) {
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
        contact: [],
        totals: {},
      }
      batters.set(batterId, entry)
    }
    if (teamId != null) entry.teamId = teamId

    const hand = play?.matchup?.pitchHand?.code === 'L' ? 'L' : 'R'
    const side = play?.matchup?.batSide?.code === 'L' ? 'L' : 'R'
    const result = RESULT_OF[play?.result?.eventType] ?? 'out'
    const exitVelo = hitData.launchSpeed ?? null
    const launchAngle = hitData.launchAngle ?? null

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
    entry.contact.push([
      launchAngle == null ? null : round1(launchAngle),
      hitData.totalDistance == null ? null : round1(hitData.totalDistance),
      xba && exitVelo != null && launchAngle != null ? Math.round(1000 * xwobaOf(xba, exitVelo, launchAngle)) : null,
    ])
  }
  return batters
}


// --- the accumulating store (exported for tests) -----------------------------
//
// Folds one game's deltas into the carried-forward store, which is exactly the
// committed shards' `bat` maps merged (see the header). `date` is the game's
// officialDate, and it is what decides the club: a sweep runs concurrently and
// a backfill runs in whatever order the schedule hands it over, so "his current
// club" has to be the club from the LATEST game on file rather than the club
// from whichever fetch happened to land last.
//
// THE PARK RUNS (`g`, schema version 2). `venueId` is the Stats API venue id
// of the game. Each entry keeps `g: [[count, venueId], …]`: the next `count`
// rows of `p` were hit at `venueId`. A run per GAME would do; consecutive games
// at one park (a home stand) merge into one run, so a season costs about
// twenty-five runs a batter, not a column on every one of his ~450 rows (a
// column would push the largest bucket past bucket-shards.test.js's 160 KB
// ceiling). The season is the folder's, and every ballpark configuration
// covers whole seasons (lib/ballpark/layout/configurations.js), so venue and
// season are all a reader needs to pick the wall. A null venue is a game the
// feed named no park for.
//
// THE CONTACT STORE (`contacts`, optional: the same part's map in the contact store).
// An entry is { n, c, g }: `n` is the number of spray rows `p` held when it was
// written; `c` is the contact rows of the LAST `c.length / 3` of them, FLAT
// ([launchAngle, distance, xBA, launchAngle, …], three numbers a row); and `g` is
// FLAT pairs, [count, gamePk, count, gamePk, …], over those rows. Flat saves the
// brackets: on the busiest bucket 60 KB against 73 KB nested. Rows folded before this
// store existed have no contact and always come first. A reader that finds `n`
// different from `p.length` reads no contact at all, never a shifted column. #1912.
export function foldGame(store, agg, date, venueId = null, contacts = null, gamePk = null) {
  for (const [batterId, delta] of agg) {
    const entry = store[batterId] ?? (store[batterId] = { n: '', t: null, b: null, d: null, p: [], o: {} })
    if (entry.d == null || date >= entry.d) {
      entry.d = date
      entry.n = delta.name || entry.n
      if (delta.teamId != null) entry.t = delta.teamId
    }
    if (delta.bats) entry.b = delta.bats
    if (delta.rows.length) {
      // Rows carried from before the runs existed get one run of unknown park,
      // so `g` always covers `p` exactly (a rebuild makes this a no-op).
      const runs = (entry.g = coveringRuns(entry))
      const last = runs[runs.length - 1]
      if (last && last[1] === venueId) last[0] += delta.rows.length
      else runs.push([delta.rows.length, venueId])
    }
    if (contacts && delta.rows.length) {
      let c = contacts[batterId]
      if (c?.n !== entry.p.length) c = contacts[batterId] = { n: entry.p.length, c: [], g: [] }
      c.c.push(...delta.contact.flat())
      c.g.push(delta.contact.length, gamePk)
      c.n += delta.rows.length
    }
    for (const row of delta.rows) entry.p.push(row)
    for (const [hand, totals] of Object.entries(delta.totals)) {
      const carried = entry.o[hand] ?? (entry.o[hand] = [0, 0, 0, 0, 0])
      for (let i = 0; i < carried.length; i++) carried[i] += totals[i]
    }
  }
}

// --- store IO ----------------------------------------------------------------

// Every committed bucket of ONE season, merged back into two maps: `bat` (the
// regular season) and `post` (the postseason). Other seasons' folders are never
// read or written here.
async function readStore(season) {
  const dir = seasonDir(season)
  const files = (await readdir(dir).catch(() => [])).filter((f) => /^\d\d\.json$/.test(f))
  const store = { bat: {}, post: {} }
  let carried = 0
  let version = SCHEMA_VERSION
  for (const f of files) {
    const shard = await readJsonOr(join(dir, f), null)
    if (!shard || shard.season !== season) continue
    version = Math.min(version, shard.v ?? 1)
    for (const part of ['bat', 'post']) {
      for (const [id, entry] of Object.entries(shard[part] ?? {})) {
        store[part][id] = entry
        if (part === 'bat') carried++
      }
    }
  }
  // The contact store (#1912) rides in the same folder as `NN.contact.json`.
  const contact = { bat: {}, post: {} }
  for (const f of (await readdir(dir).catch(() => [])).filter((f) => /^\d\d\.contact\.json$/.test(f))) {
    const shard = await readJsonOr(join(dir, f), null)
    if (!shard || shard.season !== season) continue
    for (const part of ['bat', 'post']) Object.assign(contact[part], shard[part])
  }
  return { store, contact, carried, version }
}

// One file per `personId % 100` bucket (shardKey100, imported from the app so
// the generator and the reader agree on where a batter went). A whole-league
// file would be ~7 MB for a page that prints one man's card. The contact store
// (#1912) is `NN.contact.json` beside it, written only for a bucket that has a
// contact entry and in the SAME writeShards call, which sweeps every file it did
// not write.
async function writeStore(store, contact, season, v = SCHEMA_VERSION) {
  const buckets = new Map()
  const contactBuckets = new Map()
  const asOf = new Date().toISOString()
  const bucketFor = (id) => {
    const key = shardKey100(id)
    if (!buckets.has(key)) buckets.set(key, { season, v, asOf, bat: {} })
    return buckets.get(key)
  }
  for (const [id, entry] of Object.entries(store.bat)) bucketFor(id).bat[id] = entry
  // `post` only where a batter has one, so a regular-season-only bucket keeps
  // exactly the keys it had before the postseason was swept.
  for (const [id, entry] of Object.entries(store.post)) (bucketFor(id).post ??= {})[id] = entry
  for (const part of ['bat', 'post']) {
    for (const [id, entry] of Object.entries(contact[part])) {
      const key = `${shardKey100(id)}.contact`
      if (!contactBuckets.has(key)) contactBuckets.set(key, { season, asOf })
      ;(contactBuckets.get(key)[part] ??= {})[id] = entry
    }
  }
  // Every bucket, including the empty ones: a reader that asks for bucket 37
  // and gets a 404 caches the miss for the session, so the file exists and says
  // "nobody here" instead.
  for (let i = 0; i < 100; i++) {
    const key = String(i).padStart(2, '0')
    if (!buckets.has(key)) buckets.set(key, { season, v, asOf, bat: {} })
  }
  return writeShards(seasonDir(season), [...buckets, ...contactBuckets].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
}

// --- CLI ---------------------------------------------------------------------

// The ledger file: the games on file, and the ones whose fetch failed on the last run (#2069).
export const ledgerOf = (season, ingested, failed) => ({
  season,
  games: [...ingested].sort((a, b) => a - b),
  ...(failed.size ? { failed: [...failed].sort((a, b) => a - b) } : {}),
})

// The row to queue for one scheduled game, or null. Decided games only, this season's only.
export function acceptSprayGame(g, level, { ingested, season, today }) {
  // A CANCELLED GAME REPORTS AS FINAL. Twenty AAA games this season carry
  // `abstractGameState: 'Final'` with `detailedState: 'Cancelled'` and a
  // linescore that never reached the first inning — a game that was
  // called off, not one that was decided. Fetching them is a wasted
  // request that reads as a feed-shape failure downstream, since a
  // cancelled game's feed holds no contact at all.
  if (g.status?.detailedState === 'Cancelled') return null
  if (g.officialDate >= today) return null // decided games only, never today's
  if (!g.officialDate.startsWith(`${season}-`)) return null // this season's folder only
  if (ingested.has(g.gamePk)) return null
  return { gamePk: g.gamePk, level, date: g.officialDate, post: scopeOfGameType(g.gameType) === 'P' }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  let { startDate, endDate } = dateRange(args, DEFAULT_DAYS)
  const today = isoDay(new Date())
  const sportsFilter = args.sports
    ? new Set(String(args.sports).split(',').map((s) => Number(s.trim())))
    : null
  const LEVELS = sportsFilter ? ALL_LEVELS.filter((l) => sportsFilter.has(l.sportId)) : ALL_LEVELS

  const season = Number(args.season) || Number(endDate.slice(0, 4))
  const read = await readStore(season)
  const ledger = await readJsonOr(ledgerPath, { season, games: [] })
  let ingested = new Set(ledger.season === season ? ledger.games : [])
  // Games whose fetch failed on the last run that took them (#2069). Kept beside `games`.
  const failedBefore = new Set(ledger.season === season ? ledger.failed ?? [] : [])
  const failedNow = new Set(failedBefore)
  // An older schema (see SCHEMA_VERSION), or --rebuild: sweep the whole season
  // again into an empty store. Checkpoints keep the OLD version number, so only
  // a finished sweep marks the season current.
  const rebuild = Boolean(args.rebuild) || (read.carried > 0 && read.version < SCHEMA_VERSION)
  // A filtered sweep would empty the other levels and still stamp the season current.
  if (rebuild && sportsFilter) throw new Error('A rebuild sweeps every level: drop --sports')
  const store = rebuild ? { bat: {}, post: {} } : read.store
  const contact = rebuild ? { bat: {}, post: {} } : read.contact
  // Version 1 means "rows without parks": a rebuild cut short reads as one
  // and starts over, whatever version the store had before.
  const writeVersion = rebuild ? 1 : SCHEMA_VERSION
  if (rebuild) {
    ingested = new Set()
    failedNow.clear()
    startDate = `${season}-01-01`
    console.log(`rebuilding ${season} from ${startDate} (store schema v${read.version} → v${SCHEMA_VERSION})`)
  }
  // No xBA lattice: every ball swept now stores a null xBA, and the ledger keeps it that way.
  const xba = readXwobaTable(season, 'xba-table')
  if (!xba) console.warn(`no public/data/xba-table/${season}.json: xBA is stored null for this run`)
  console.log(`carried ${rebuild ? 0 : read.carried} batters and ${ingested.size} ingested games for ${season}`)

  // Regular season at both levels, plus the postseason at MLB. Same
  // postponed-replay dedup as the other sweeps: a replayed game is listed under
  // both dates, so keep only the officialDate bucket.
  // Each run reads the season's whole schedule: the window's games first, then up to GAP_CAP
  // older ones a failed fetch left out (#2069).
  const pending = []
  for (const { sportId, level, gameTypes } of LEVELS) {
    const schedule = await getJson(
      `/api/v1/schedule?sportId=${sportId}&startDate=${season}-01-01&endDate=${endDate}&gameType=${gameTypes}` +
        '&fields=dates,date,games,gamePk,gameType,officialDate,status,abstractGameState,detailedState',
    )
    pending.push(...collectPending(schedule, { startDate, accept: (g) => acceptSprayGame(g, level, { ingested, season, today }) }))
  }
  console.log(
    `${startDate}..${endDate}: ${pending.length} un-ingested decided games across ${LEVELS.length} level(s) (the window, then up to ${GAP_CAP} older each)`,
  )

  const writeOut = async () => {
    await writeStore(store, contact, season, writeVersion)
    await writeJsonAtomic(ledgerPath, ledgerOf(season, ingested, failedNow))
  }

  let empty = 0
  const { done, failed, again } = await runSweep({
    pending,
    failedBefore,
    keyOf: (g) => g.gamePk,
    ingest: async (g) => {
      const feed = await getJson(`/api/v1.1/game/${g.gamePk}/feed/live?fields=${FEED_FIELDS}`)
      const agg = aggregateGameSpray(feed, g.level, xba)
      // A decided game with no tracked contact at all is either a very short
      // weather-shortened game or a `fields` allowlist that has stopped
      // matching the feed. Neither should fail the run, and neither should
      // pass unremarked — a silent zero is how a 30x bandwidth saving turns
      // into an empty dataset nobody notices.
      if (agg.size === 0) empty += 1
      const part = g.post ? 'post' : 'bat'
      foldGame(store[part], agg, g.date, feed?.gameData?.venue?.id ?? null, contact[part], g.gamePk)
      ingested.add(g.gamePk)
    },
    onOk: (g) => failedNow.delete(g.gamePk),
    onFail: (g) => failedNow.add(g.gamePk),
    checkpoint: writeOut,
    every: CHECKPOINT_EVERY,
  })
  // Nothing for this season yet (the new year before Opening Day): write
  // nothing, so last season's folder, the ledger and the index stay as they are.
  if (Object.keys(store.bat).length + Object.keys(store.post).length === 0) {
    console.log(`no ${season} balls in play yet — wrote nothing; seasons.json still serves the last season on file`)
    return
  }
  const { written, swept } = await writeStore(store, contact, season, SCHEMA_VERSION)
  await writeJsonAtomic(ledgerPath, ledgerOf(season, ingested, failedNow))
  const index = await writeSeasons(storeDir, season)

  if (failed.length) console.error(`${failed.length} game(s) failed and stay out of the ledger, for the next run: ${failed.map((g) => g.gamePk).join(', ')}`)
  if (again.length) {
    console.error(`failed twice in a row: ${again.map((g) => g.gamePk).join(', ')}`)
    process.exitCode = 1
  }
  if (empty > 0) console.error(`${empty} decided game(s) yielded no tracked contact — check the feed shape`)
  const balls = Object.values(store.bat).reduce((n, e) => n + e.p.length, 0)
  const postBalls = Object.values(store.post).reduce((n, e) => n + e.p.length, 0)
  console.log(
    `wrote ${written} buckets (${swept} swept) — ${Object.keys(store.bat).length} batters, ` +
      `${balls} plotted balls (+${postBalls} postseason, ${Object.keys(store.post).length} batters), ` +
      `${ingested.size} games on file (+${done - failed.length} swept this run); ` +
      `serving ${index.current} of [${index.seasons.join(', ')}]`,
  )
}

// Only sweep when run as a script — keeps aggregateGameSpray/foldGame
// importable for tests without triggering a live fetch and a file write.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
