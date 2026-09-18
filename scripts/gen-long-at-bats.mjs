// Regenerates public/data/long-at-bats/{season}.json — every twelve-pitch plate
// appearance of an MLB season, for the notebook note on the offseason home page
// (issue #1078, step 4 of #1038).
//
// WHY A SWEEP. A long at-bat is not totalled anywhere in the API. The season
// stat line carries `numberOfPitches` and `plateAppearances`, which give a
// player's pitches PER at-bat and say nothing about his longest — and the note
// is a census ("N of 186,000 plate appearances"), so it needs every at-bat of
// the season counted, not a leaderboard of the players who took the most.
//
// ONE SMALL CALL PER GAME. `/game/{pk}/playByPlay?fields=…` is 28 KB against
// 555 KB untrimmed, because `pitchIndex` is the feed's own list of which
// playEvents were pitches — its LENGTH is the at-bat's pitch count, so the
// pitch events themselves never have to come down the wire. That makes this the
// cheapest of the nightly feed sweeps by a factor of twenty (compare
// gen-fouls.mjs, which needs the pitches themselves and takes the full feed).
//
// INCREMENTAL, AND FROZEN BY SEASON. A Final game's at-bats are immutable, so
// each run ingests only gamePks it has not seen (scripts/data/long-at-bats-scan.json
// holds the per-game tallies) and re-exports the season file from the scan. The
// file is keyed on the SEASON, not written to one rolling path: on January 2 the
// generator must still be filling 2026 rather than opening an empty 2027 and
// holding it there until April — the trap #1122 found in gen-minors-leaders.mjs.
// scripts/lib/long-at-bats.mjs's noteSeasonFor reads the season off statsapi's
// own row, the same reading the offseason gate itself makes (ADR-0074).
//
// WHAT IS NOT IN THE OUTPUT, DELIBERATELY: no score, no run total, no winner,
// no inning number and NO RESULT OF THE AT-BAT. A twelve-pitch at-bat is a
// LENGTH, and a length is true of the at-bat whoever won — whether it ended in
// a strikeout or a triple is the game's to tell, sealed, when the reader opens
// it. Storing the event would make this file the one place a static dataset
// hands the slate a play's outcome, so it is not stored and
// test/long-at-bats.test.js asserts that of the committed file by vocabulary.
// Same stance, same reasons, as gen-milb-pool.mjs (ADR-0080).
//
// Run by hand:
//   node scripts/gen-long-at-bats.mjs                  # games not yet seen
//   node scripts/gen-long-at-bats.mjs --season=2026    # a specific season
//   node scripts/gen-long-at-bats.mjs --rescan         # re-ingest every game
// Nightly: .github/workflows/update-nightly-data.yml
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { getJson } from './lib/statsapi.mjs'
import { offseasonPhase } from '../src/lib/time/seasonPhase.js'
import { noteSeasonFor, scanGamePlays, sortRows } from './lib/long-at-bats.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'public', 'data', 'long-at-bats')
const scanPath = join(here, 'data', 'long-at-bats-scan.json')

// Twelve, from research.md §7 — the floor that makes an at-bat a story a
// scorer would stop and read rather than a long-ish one. Measured against a
// fortnight of 2026: 19 of 14,081 plate appearances, which is about 250 across
// a season. Few enough to list, many enough to be a note.
const THRESHOLD = 12
const CONCURRENCY = 6
// A whole season's worth of trimmed play-by-play is ~68 MB, so a first run is a
// long one. Checkpoint often enough that an interrupted backfill resumes where
// it stopped rather than from the start.
const CHECKPOINT_EVERY = 200

const PLAY_FIELDS =
  'allPlays,about,halfInning,atBatIndex,matchup,batter,pitcher,id,fullName,pitchIndex,result,type,eventType'

const args = process.argv.slice(2)
const rescan = args.includes('--rescan')
const onlySeason = Number(args.find((a) => a.startsWith('--season='))?.split('=')[1]) || null

const today = new Date().toISOString().slice(0, 10)

// The MLB season row for the calendar year today falls in — the same row the
// slate's own offseason gate reads, so this generator and the page it feeds
// can never disagree about which season the winter belongs to.
async function seasonRow(year) {
  try {
    const data = await getJson(
      `/api/v1/seasons?sportId=1&season=${year}` +
        `&fields=seasons,seasonId,springStartDate,offseasonStartDate`,
    )
    return data.seasons?.[0] ?? null
  } catch {
    return null
  }
}

// Every PLAYED regular-season game of the season, in one call.
//
// Not "every Final row" — the #1031 trap is not only a minor-league one. MLB's
// 2026 schedule returns a postponed September game with `abstractGameState:
// "Final"` and `detailedState: "Postponed"`, and a census that treats it as a
// game it failed to read can never call its own coverage complete. So the
// linescore is hydrated and the game's own innings decide, the same reading
// gen-milb-pool.mjs makes; only the LENGTH of that array is ever looked at, and
// nothing from it is stored.
//
// A game that is not Final yet is simply picked up on a later run.
async function playedGames(season) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&season=${season}&gameType=R&hydrate=team,linescore` +
      `&fields=dates,games,gamePk,gameNumber,officialDate,status,abstractGameState,` +
      `teams,away,home,team,id,abbreviation,linescore,innings,num`,
  )
  const seen = new Map()
  for (const day of data.dates ?? []) {
    for (const game of day.games ?? []) {
      if (game?.status?.abstractGameState !== 'Final') continue
      if ((game?.linescore?.innings ?? []).length === 0) continue
      // The schedule repeats a game across `dates` entries; the first one wins.
      if (!seen.has(game.gamePk)) seen.set(game.gamePk, game)
    }
  }
  return [...seen.values()]
}

// One game's tally, or null when it cannot be read or cannot be trusted. A
// thrown request is a skip, never a retry that quietly admits a half-read game
// into a census — the game comes back on the next nightly run.
async function scanGame(gamePk) {
  let data
  try {
    data = await getJson(`/api/v1/game/${gamePk}/playByPlay?fields=${PLAY_FIELDS}`)
  } catch {
    return null
  }
  const plays = data?.allPlays ?? []
  if (plays.length === 0) return null
  return scanGamePlays(plays, THRESHOLD)
}

function clubOf(side) {
  return { id: side?.team?.id ?? null, abbr: side?.team?.abbreviation ?? '' }
}

// The stored shape of one long at-bat. The batter's club comes off which half
// he batted in, so the row can name both men's clubs without the file carrying
// an inning — and `top` itself is dropped here, having done its one job.
function rowFor(game, entry) {
  const away = clubOf(game.teams?.away)
  const home = clubOf(game.teams?.home)
  return {
    pk: game.gamePk,
    date: game.officialDate,
    ...(game.gameNumber > 1 ? { g: game.gameNumber } : {}),
    away,
    home,
    batter: {
      id: entry.batter?.id ?? null,
      name: entry.batter?.fullName ?? '',
      teamId: (entry.top ? away : home).id,
    },
    pitcher: {
      id: entry.pitcher?.id ?? null,
      name: entry.pitcher?.fullName ?? '',
      teamId: (entry.top ? home : away).id,
    },
    pitches: entry.pitches,
  }
}

async function main() {
  const year = Number(today.slice(0, 4))
  const season = onlySeason ?? noteSeasonFor(offseasonPhase(today, await seasonRow(year)), year)
  console.log(`Long at-bats: ${season} season, ${THRESHOLD}+ pitches (${today})`)

  const scanFile = (await readJsonOr(scanPath, null)) ?? {}
  const key = String(season)
  const scan = scanFile[key] ?? { games: {} }
  scanFile[key] = scan

  const games = await playedGames(season)
  const byPk = new Map(games.map((g) => [g.gamePk, g]))
  const todo = games.filter((g) => rescan || !scan.games[g.gamePk])
  console.log(`  ${games.length} played games, ${todo.length} to read`)

  let done = 0
  await mapConcurrent(todo, CONCURRENCY, async (game) => {
    const tally = await scanGame(game.gamePk)
    if (tally) {
      scan.games[game.gamePk] = {
        pa: tally.plateAppearances,
        // Kept per game rather than summed at export, so a season that was
        // swept across many nights can still say how complete its coverage is.
        noPitch: tally.withoutPitches,
        long: tally.long,
      }
    }
    done += 1
    if (done % CHECKPOINT_EVERY === 0) {
      await writeJsonAtomic(scanPath, scanFile)
      console.log(`  …${done}/${todo.length}`)
    }
  })
  await writeJsonAtomic(scanPath, scanFile)

  // Export from the scan, never from this run alone: a nightly run reads a
  // handful of games and the file it writes is the whole season's.
  let plateAppearances = 0
  let withoutPitches = 0
  let ingested = 0
  const rows = []
  for (const [pk, entry] of Object.entries(scan.games)) {
    const game = byPk.get(Number(pk))
    // A gamePk the schedule no longer returns as a Final regular-season game
    // (a suspended game re-filed, a rescheduled row) drops out of the census
    // rather than being counted from a stale tally.
    if (!game) continue
    ingested += 1
    plateAppearances += entry.pa ?? 0
    withoutPitches += entry.noPitch ?? 0
    for (const long of entry.long ?? []) rows.push(rowFor(game, long))
  }

  const doc = {
    season,
    generatedAt: new Date().toISOString(),
    threshold: THRESHOLD,
    coverage: {
      games: ingested,
      playedGames: games.length,
      plateAppearances,
      // The one thing that would make the count "at least N" instead of "N":
      // an at-bat the feed carried no pitches for. The page reads this and
      // says so rather than claiming an exactness it cannot have.
      plateAppearancesWithoutPitches: withoutPitches,
      complete: ingested === games.length && withoutPitches === 0,
    },
    rows: sortRows(rows),
  }

  // Rewrite only when something other than the timestamp moved: in the winter
  // this generator reads a finished season every night and has nothing new to
  // say, and a file redirtied on `generatedAt` alone buries the runs that
  // changed something real (the churn lesson gen-contracts-shards.mjs learned).
  const path = join(outDir, `${season}.json`)
  const prev = await readJsonOr(path, null)
  const strip = (d) => JSON.stringify({ ...d, generatedAt: null })
  if (!prev || strip(prev) !== strip(doc)) await writeJsonAtomic(path, doc)
  console.log(
    `  ${doc.rows.length} at-bats of ${THRESHOLD}+ pitches in ${plateAppearances} ` +
      `plate appearances over ${ingested}/${games.length} games` +
      `${withoutPitches > 0 ? ` (${withoutPitches} PA with no pitch events)` : ''}`,
  )
  console.log('Done.')
}

await main()
