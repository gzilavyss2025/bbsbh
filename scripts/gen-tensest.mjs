// Regenerates public/data/tensest.json — the tensest at-bats of the season in play,
// by MLB's own leverage index: the league's top 50, and for every club its top 25
// batting and top 25 pitching. The Tensest Moments page (src/api/tensest.js reads it).
//
// WHY A GENERATOR: the leverage of every at-bat lives in one winProbability feed
// per game, 2,400+ games a season. The page cannot make that many calls, so this
// reads each game once and keeps only the tensest plays (scripts/lib/tensest.mjs).
//
// It also writes public/data/tensest-cutoffs.json: the season's leverage edges for
// the Pressure meter's 10 bars (scripts/lib/tensest/cutoffs.mjs), from a histogram
// of every play read.
//
// INCREMENTAL: scripts/data/tensest-state.json lists the games already read, and
// holds that histogram. A state file with no histogram is rebuilt from scratch. A run
// reads only Final games not on that list, folds their tense plays into the lists
// in the output file, and adds them to the list. The first run of a season reads
// every game so far (about ten minutes); a nightly run reads the day's games.
// A game that errors, or whose feed has no plays yet, is left off the list, so the next
// run tries it again. Two things this does NOT do, on purpose: re-read a game MLB later
// corrects (delete both files to rebuild a season), and batch its writes, so a first run
// of a season (or after the state file is lost) is one ten-minute sweep inside the
// nightly job and a timeout loses it. Neither has happened.
//
// Regular season and postseason are both kept; a row carries its game type.
// Season: the season in play (lib/time/season-in-play.mjs), or --season=YYYY.
// Run by hand: node scripts/gen-tensest.mjs
import { join } from 'node:path'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { addRows, assertFloorHolds, emptyStore, gameRowsOrThrow, isPlayedFinal } from './lib/tensest/tensest.mjs'
import { cutoffsFromHist, emptyHist, foldHist, histOrNull } from './lib/tensest/cutoffs.mjs'
import { parseArgs, strOpt } from './lib/args.mjs'

const here = import.meta.dirname
const OUT = join(here, '..', 'public', 'data', 'tensest.json')
const CUTOFFS = join(here, '..', 'public', 'data', 'tensest-cutoffs.json')
const STATE = join(here, 'data', 'tensest-state.json')
const CONCURRENCY = 8
const GAME_TYPES = 'R,F,D,L,W'

const arg = strOpt(parseArgs(process.argv.slice(2)), 'season')
const season = arg ? Number(arg) : await fetchSeasonInPlay()

const sched = await getJson(
  `/api/v1/schedule?sportId=1&gameType=${GAME_TYPES}&startDate=${season}-02-01&endDate=${season}-12-31`,
)
const finals = sched.dates.flatMap((d) => d.games).filter(isPlayedFinal)

const prev = await readJsonOr(OUT, null)
const state = await readJsonOr(STATE, null)
const carried = prev?.season === season && state?.season === season && histOrNull(state.hist) !== null
const done = new Set(carried ? state.done : [])
let hist = carried ? state.hist : emptyHist()
let store = carried ? { league: prev.league ?? [], teams: prev.teams ?? {} } : emptyStore()

// A suspended game is listed on both dates; read it once, or its plays count twice.
const todo = [...new Map(finals.filter((g) => !done.has(g.gamePk)).map((g) => [g.gamePk, g])).values()]
if (todo.length === 0) {
  // Still write the small cutoffs file if it is missing or stale (a quiet night).
  if (carried) await writeCutoffs(cutoffsFromHist(hist))
  console.log(`tensest: ${season}, nothing new (${done.size} games read)`)
  process.exit(0)
}

// The cutoffs alone, for the Pressure meter: 9 numbers, not the whole board.
// Written only when they change, so a quiet night commits nothing and
// generatedAt says when the cutoffs last moved.
async function writeCutoffs(cutoffs) {
  const had = await readJsonOr(CUTOFFS, null)
  if (had?.season === season && JSON.stringify(had.cutoffs) === JSON.stringify(cutoffs)) return
  await writeJsonAtomic(CUTOFFS, { season, generatedAt: new Date().toISOString(), cutoffs })
}

const read = await mapConcurrent(todo, CONCURRENCY, async (g) => {
  const plays = await getJson(`/api/v1/game/${g.gamePk}/winProbability`)
  const rows = gameRowsOrThrow(g, plays)
  // Folded here, not after: holding every game's whole feed runs out of memory.
  hist = foldHist(hist, plays)
  return { g, rows }
})
const ok = read.filter(Boolean)
if (ok.length === 0) throw new Error('tensest: every winProbability read failed')

store = addRows(store, ok.flatMap((r) => r.rows))
assertFloorHolds(store)
for (const r of ok) done.add(r.g.gamePk)
const cutoffs = cutoffsFromHist(hist)

const last = finals.map((g) => g.officialDate).sort().at(-1) ?? null
await writeJsonAtomic(OUT, { season, generatedAt: new Date().toISOString(), through: last, games: done.size, ...store })
await writeCutoffs(cutoffs)
await writeJsonAtomic(STATE, { season, done: [...done].sort((a, b) => a - b), hist })
console.log(`tensest: ${season}, read ${ok.length} of ${todo.length} new games; ${done.size} in all; league top ${store.league.length}; bar edges ${cutoffs?.li.join(' ')}`)
