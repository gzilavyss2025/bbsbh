#!/usr/bin/env node
// Regenerates the Wild Rides explorer's two files (src/api/wildrides.js reads them):
//   public/data/wild-rides/{season}.json        the four lists, each game's top LIST_SIZE (a few KB)
//   public/data/wild-rides/{season}-shapes.json every game as a row plus a 24-character shape
//                                               word, for Draw (lib/wildrides/shape.js; ~35 KB gz)
// No game's line or plays are stored: the page reads the one game picked from statsapi,
// client-direct like all game data, and builds its ride with the same lib/wildrides code.
//
// INCREMENTAL. A Final game's win-probability feed does not change, so each run reads only
// gamePks it has not summarised (scripts/data/wild-rides-scan.json) and re-exports both files
// from the scan. A night in season is ~15 games; a first run on a season is ~2,430.
//
// Run by hand:
//   node scripts/gen-wild-rides.mjs                  # games not yet seen
//   node scripts/gen-wild-rides.mjs --season=2026    # a specific season
//   node scripts/gen-wild-rides.mjs --rescan         # re-read every game
// Nightly: .github/workflows/update-nightly-data.yml
import { join } from 'node:path'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { getJson } from './lib/statsapi.mjs'
import { parseArgs, strOpt } from './lib/args.mjs'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { buildRide, RIDE_FIELDS } from '../src/lib/wildrides/ride.js'
import { summarize, LISTS } from '../src/lib/wildrides/story.js'
import { encodeShape } from '../src/lib/wildrides/shape.js'

const here = import.meta.dirname
const outDir = join(here, '..', 'public', 'data', 'wild-rides')
const scanPath = join(here, 'data', 'wild-rides-scan.json')
const LIST_SIZE = 15
const CONCURRENCY = 6
const CHECKPOINT_EVERY = 200

const args = process.argv.slice(2)
const opts = parseArgs(args)
const rescan = args.includes('--rescan')
const onlySeason = Number(strOpt(opts, 'season')) || null
const today = new Date().toISOString().slice(0, 10)

// Every Final regular-season game (codedGameState 'F': a postponed game also says "Final").
async function finals(season) {
  const data = await getJson(
    `/api/v1/schedule?sportId=1&season=${season}&gameType=R` +
      `&fields=dates,games,gamePk,officialDate,status,codedGameState,teams,away,home,team,id,score,isWinner,venue`,
  )
  const seen = new Set()
  return (data.dates ?? [])
    .flatMap((d) => d.games ?? [])
    .filter((g) => g.status?.codedGameState === 'F' && !seen.has(g.gamePk) && seen.add(g.gamePk))
}

// One game's summary and shape word, or null when its feed can't be read (it comes back
// the next night rather than entering the lists half-read).
async function scanGame(g) {
  let feed
  try {
    feed = await getJson(`/api/v1/game/${g.gamePk}/winProbability?fields=${RIDE_FIELDS.join(',')}`)
  } catch {
    return null
  }
  const ride = buildRide(feed, {
    gamePk: g.gamePk,
    date: g.officialDate,
    venue: g.venue?.id ?? null,
    away: g.teams.away.team.id,
    home: g.teams.home.team.id,
    score: [g.teams.away.score, g.teams.home.score],
    homeWon: g.teams.home.isWinner === true,
  })
  return ride ? { ...summarize(ride), shape: encodeShape(ride.line) } : null
}

async function main() {
  // The season in play (scripts/CLAUDE.md): the finished one until the next Opening Day.
  const season = onlySeason ?? (await fetchSeasonInPlay())
  const scanFile = (await readJsonOr(scanPath, null)) ?? {}
  const scan = (scanFile[season] ??= { games: {} })
  const games = await finals(season)
  const todo = games.filter((g) => rescan || !scan.games[g.gamePk])
  console.log(`Wild rides: ${season}, ${games.length} finals, ${todo.length} to read`)

  let done = 0
  await mapConcurrent(todo, CONCURRENCY, async (g) => {
    const row = await scanGame(g)
    if (row) scan.games[g.gamePk] = row
    if (++done % CHECKPOINT_EVERY === 0) {
      await writeJsonAtomic(scanPath, scanFile)
      console.log(`  ${done}/${todo.length}`)
    }
  })
  await writeJsonAtomic(scanPath, scanFile)

  const rows = Object.values(scan.games)
  if (!rows.length) return console.log('  no games: nothing written')
  const generatedAt = today
  const lists = Object.fromEntries(
    LISTS.map((l) => [l.key, [...rows].sort(l.sort).slice(0, LIST_SIZE).map(({ shape, ...r }) => r)]),
  )
  await writeJsonAtomic(join(outDir, `${season}.json`), { season, generatedAt, games: rows.length, lists })
  // One array per game, in a fixed order, to keep the Draw file small:
  // [gamePk, date, away, home, awayScore, homeScore, innings, shape, venue]
  const shapes = rows
    .sort((a, b) => a.date.localeCompare(b.date) || a.gamePk - b.gamePk)
    .map((r) => [r.gamePk, r.date, r.away, r.home, r.score[0], r.score[1], r.innings, r.shape, r.venue])
  await writeJsonAtomic(join(outDir, `${season}-shapes.json`), { season, generatedAt, games: shapes })
  // The folder's stamp for check-data-freshness.mjs, and the seasons on file.
  const index = (await readJsonOr(join(outDir, 'index.json'), null)) ?? { seasons: [] }
  const seasons = [...new Set([...(index.seasons ?? []), season])].sort()
  await writeJsonAtomic(join(outDir, 'index.json'), { generatedAt, seasons })
  console.log(`  wrote ${rows.length} games`)
}

await main()
