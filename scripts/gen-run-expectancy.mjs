// Regenerates public/data/run-expectancy.json — a base(8)×outs(3)×count(12) =
// 288-state run-expectancy table (RE288), each state's value the mean runs
// scored from that exact pre-pitch state until its half-inning ends, averaged
// over real MLB regular-season play-by-play. Feeds scripts/gen-umpire-accuracy.mjs's
// per-missed-call "favor" figure (src/lib/runExpectancy.js's pitchFavor) and,
// live, the box score's reveal-only favor card — see
// .scratch/umpire-accuracy/consistency-favor-scope.md §2 for the full design
// and how this was verified against a real feed before being built.
//
// NOT ON THE NIGHTLY CRON. Run expectancy is a slow-moving league constant
// (real published tables refresh yearly at most), nothing like the nightly
// per-game accuracy sweep — this is a hand-run, one-time (or annual) backfill:
//   node scripts/gen-run-expectancy.mjs                    # last 2 complete seasons
//   node scripts/gen-run-expectancy.mjs --seasons=2024,2025
//
// ERA MODE (1960-2023, one decade at a time; never touches run-expectancy.json):
//   node scripts/gen-run-expectancy.mjs --era-sweep --seasons=1980,1981,...
//     one season at a time, 4 requests at once, writes
//     .scratch/run-expectancy-eras/season-YYYY.json (a committed checkpoint of
//     sums only, no feeds) and skips a season whose file exists
//   node scripts/gen-run-expectancy.mjs --era-aggregate --decade=1980
//     merges that decade's checkpoints into public/data/run-expectancy-eras/1980s.json;
//     exits 1 and writes nothing if a season has no checkpoint
//
// METHODOLOGY. For every Final regular-season game, walk liveData.plays.allPlays
// in feed order (this already includes stolen-base/caught-stealing/pickoff/
// wild-pitch/passed-ball/balk as their own top-level plays, interleaved with
// real plate appearances — see playbyplay.js's NON_PA_EVENT_TYPES), applying
// each play's runners[].movement.{start,end,isOut} to a 3-slot base-occupancy
// array, reset at each new half-inning. VERIFIED against a real 5–14 game
// (gamePk 823358): runs-per-half computed this way matched
// liveData.linescore.innings[].{away,home}.runs on all 17 halves.
//
// Every pitch is tagged with its PRE-pitch state — (baseMask, outs, balls,
// strikes) as they stood the instant the pitch was thrown — and the label is
// the half-inning's remaining runs from that pitch's own play forward
// (inclusive of any runs that very plate appearance goes on to drive in).
// CAUGHT ON VERIFICATION: playEvents[].count.{balls,strikes} is the count
// AFTER that pitch resolves, not before (the game's first pitch, a ball,
// carries count.balls: 1) — the pre-pitch count is the PRECEDING pitch
// event's count within the same play (or 0-0 for a play's first pitch).
//
// KNOWN, ACCEPTED EDGE CASE: a plate appearance interrupted mid-count by a
// genuine top-level baserunning play (e.g. a pickoff attempt between
// pitches) may in principle span more than one `play` object. This script
// does not special-case that — count tracking resets per `play` object's own
// pitch sequence. Rare, and 288 buckets aggregate many seasons' worth of
// instances, so a handful of mistagged pitches is noise, not bias.
//
// Thin per-count buckets (bases loaded / 2 outs / 3-2, genuinely rare) fall
// back at READ time (src/lib/runExpectancy.js's lookupRE) to a base/out-only
// RE24 total — this script writes BOTH `states` (288) and `re24` (24) sums so
// that fallback never needs a second pass over history.
import { existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { eraDecade } from '../src/lib/runExpectancy.js'
import { getJson } from './lib/statsapi.mjs'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import {
  checkpointOf,
  decadeSeasons,
  mergeCheckpoints,
  schedulePks,
  sweepGames,
} from './lib/run-expectancy/eras.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '..', 'public', 'data', 'run-expectancy.json')
const eraDir = join(here, '..', '.scratch', 'run-expectancy-eras')
const eraOutDir = join(here, '..', 'public', 'data', 'run-expectancy-eras')

// Strict on purpose: a bare `--flag` is ignored, so a mistyped value flag falls
// back to its default. The shared parseArgs in lib/args.mjs would make it `true`.
function parseArgs(argv) {
  const args = {}
  for (const a of argv) {
    const m = /^--([^=]+)=(.*)$/.exec(a)
    if (m) args[m[1]] = m[2]
  }
  return args
}

async function seasonGamePks(season) {
  return schedulePks(await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=R&hydrate=team`))
}

// --- main ---------------------------------------------------------------------
const args = parseArgs(process.argv.slice(2))
const currentYear = new Date().getUTCFullYear()
const seasons = args.seasons
  ? args.seasons.split(',').map((s) => s.trim())
  : [String(currentYear - 2), String(currentYear - 1)]

// Sweep one season's Final games into `states`/`re24`. Returns
// { scheduled, games, noPlays, failed } (see sweepGames). `options` is the
// accumulateGame flag: only the era sweep passes { perPlay: true }.
async function sweepSeason(season, limit, states, re24, options) {
  const pks = await seasonGamePks(season)
  console.log(`${season}: ${pks.length} Final games`)
  const result = await sweepGames(
    pks,
    limit,
    (pk) => getJson(`/api/v1.1/game/${pk}/feed/live`),
    states,
    re24,
    (done) => {
      if (done % 250 === 0) console.log(`${season}: ${done}/${pks.length} games processed`)
    },
    options,
  )
  console.log(`${season}: swept (${states.size} states populated so far)`)
  return { scheduled: pks.length, ...result }
}

if (process.argv.includes('--era-sweep')) {
  const list = (args.seasons ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!list.length || list.some((s) => !/^\d{4}$/.test(s) || !eraDecade(s))) {
    console.error('--era-sweep needs --seasons=YYYY,YYYY,... (1960 to 2023)')
    process.exit(1)
  }
  for (const season of list) {
    const file = join(eraDir, `season-${season}.json`)
    if (existsSync(file)) {
      console.log(`${season}: checkpoint exists, skipped`)
      continue
    }
    const started = Date.now()
    const states = new Map()
    const re24 = new Map()
    const { scheduled, games, noPlays, failed } = await sweepSeason(season, 4, states, re24, { perPlay: true })
    // A checkpoint is skipped on every re-run, so a hole in it would stay for good.
    if (failed.length) {
      console.error(`${season}: ${failed.length} feed fetches failed (${failed.join(', ')}); no checkpoint written, run it again`)
      process.exit(1)
    }
    await writeJsonAtomic(file, checkpointOf(season, scheduled, games, states, re24, noPlays))
    const min = ((Date.now() - started) / 60000).toFixed(1)
    console.log(`${season}: wrote ${file} — ${games}/${scheduled} games (${noPlays} with no play-by-play), ${min} min`)
  }
  process.exit(0)
}

if (process.argv.includes('--era-aggregate')) {
  const seasonList = decadeSeasons(args.decade ?? '')
  if (!seasonList.length) {
    console.error('--era-aggregate needs --decade=1960|1970|1980|1990|2000|2010|2020')
    process.exit(1)
  }
  const missing = seasonList.filter((s) => !existsSync(join(eraDir, `season-${s}.json`)))
  if (missing.length) {
    console.error(`no checkpoint for ${missing.join(', ')}; nothing written`)
    process.exit(1)
  }
  const checkpoints = await Promise.all(seasonList.map((s) => readJsonOr(join(eraDir, `season-${s}.json`))))
  if (checkpoints.some((c, i) => c.season !== seasonList[i])) {
    console.error('a checkpoint holds the wrong season; nothing written')
    process.exit(1)
  }
  for (const c of checkpoints) {
    if (c.gamesSwept < c.scheduled) console.warn(`${c.season}: only ${c.gamesSwept}/${c.scheduled} games had play-by-play`)
  }
  const decade = `${seasonList[0].slice(0, 3)}0s`
  const outFile = join(eraOutDir, `${decade}.json`)
  const table = mergeCheckpoints(checkpoints)
  await writeJsonAtomic(outFile, { generatedAt: new Date().toISOString(), ...table })
  // index.json is the folder's stamp (check-data-freshness reads it) and lists the decades on disk.
  const decades = readdirSync(eraOutDir).filter((f) => /^\d{4}s\.json$/.test(f)).map((f) => f.slice(0, -5)).sort()
  await writeJsonAtomic(join(eraOutDir, 'index.json'), { generatedAt: new Date().toISOString(), decades })
  console.log(`wrote ${outFile} — ${table.seasons.join(', ')}, ${table.gamesSwept} games`)
  process.exit(0)
}

const states = new Map()
const re24 = new Map()
let gamesSwept = 0
for (const season of seasons) {
  const { games, failed } = await sweepSeason(season, 6, states, re24)
  gamesSwept += games
  if (failed.length) console.warn(`${season}: ${failed.length} feed fetches failed and are left out of the sums`)
}

await writeJsonAtomic(out, {
  generatedAt: new Date().toISOString(),
  seasons,
  gamesSwept,
  states: Object.fromEntries(states),
  re24: Object.fromEntries(re24),
})
console.log(
  `wrote ${out} — ${seasons.join(', ')}, ${gamesSwept} games, ${states.size}/288 states populated`,
)
