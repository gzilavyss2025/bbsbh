// Regenerates public/data/long-at-bats/{season}.json — every twelve-pitch plate
// appearance of an MLB season, for the notebook note on the offseason home page
// (issue #1078, step 4 of #1038). The regular season is the census; the
// postseason is counted beside it under `post`, never inside it (ADR-0104, #1542).
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
import {
  ALL_GAME_TYPES,
  buildSeasonDoc,
  gamesToRead,
  noteSeasonFor,
  playedGamesOf,
  scanGamePlays,
} from './lib/long-at-bats.mjs'

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

// Every PLAYED game of the season, regular and postseason, in one call. Which
// games count, and the postponed-game trap, are playedGamesOf's (lib).
async function playedGames(season) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&season=${season}&gameType=${ALL_GAME_TYPES}&hydrate=team,linescore` +
      `&fields=dates,games,gamePk,gameNumber,gameType,officialDate,status,abstractGameState,` +
      `teams,away,home,team,id,abbreviation,linescore,innings,num`,
  )
  return playedGamesOf(data.dates)
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

async function main() {
  const year = Number(today.slice(0, 4))
  const season = onlySeason ?? noteSeasonFor(offseasonPhase(today, await seasonRow(year)), year)
  console.log(`Long at-bats: ${season} season, ${THRESHOLD}+ pitches (${today})`)

  const scanFile = (await readJsonOr(scanPath, null)) ?? {}
  const key = String(season)
  const scan = scanFile[key] ?? { games: {} }
  scanFile[key] = scan

  const games = await playedGames(season)
  const todo = gamesToRead(games, scan.games, rescan)
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
  const doc = buildSeasonDoc({
    season,
    threshold: THRESHOLD,
    generatedAt: new Date().toISOString(),
    scanGames: scan.games,
    games,
  })

  // Rewrite only when something other than the timestamp moved: in the winter
  // this generator reads a finished season every night and has nothing new to
  // say, and a file redirtied on `generatedAt` alone buries the runs that
  // changed something real (the churn lesson gen-contracts-shards.mjs learned).
  const path = join(outDir, `${season}.json`)
  const prev = await readJsonOr(path, null)
  const strip = (d) => JSON.stringify({ ...d, generatedAt: null })
  if (!prev || strip(prev) !== strip(doc)) await writeJsonAtomic(path, doc)
  const line = (label, { rows, coverage: c }) =>
    console.log(
      `  ${label}: ${rows.length} at-bats of ${THRESHOLD}+ pitches in ${c.plateAppearances} ` +
        `plate appearances over ${c.games}/${c.playedGames} games` +
        `${c.plateAppearancesWithoutPitches > 0 ? ` (${c.plateAppearancesWithoutPitches} PA with no pitch events)` : ''}`,
    )
  line('regular season', doc)
  if (doc.post) line('postseason', doc.post)
  console.log('Done.')
}

await main()
