// Regenerates public/data/tensest.json — the tensest at-bats of the season in play,
// by MLB's own leverage index: the league's top 50, and for every club its top 25
// batting and top 25 pitching. The Tensest Moments page (src/api/tensest.js reads it).
//
// WHY A GENERATOR: the leverage of every at-bat lives in one winProbability feed
// per game, 2,400+ games a season. The page cannot make that many calls, so this
// reads each game once and keeps only the tensest plays (scripts/lib/tensest.mjs).
//
// INCREMENTAL: scripts/data/tensest-state.json lists the games already read. A run
// reads only Final games not on that list, folds their tense plays into the lists
// in the output file, and adds them to the list. The first run of a season reads
// every game so far (about ten minutes); a nightly run reads the day's games.
// A game that errors is left off the list, so the next run tries it again.
//
// Regular season and postseason are both kept; a row carries its game type.
// Season: the season in play (lib/time/season-in-play.mjs), or --season=YYYY.
// Run by hand: node scripts/gen-tensest.mjs
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getJson } from './lib/statsapi.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { readJsonOr, writeJsonAtomic } from './lib/io.js'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { addRows, assertFloorHolds, emptyStore, playRows } from './lib/tensest/tensest.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '..', 'public', 'data', 'tensest.json')
const STATE = join(here, 'data', 'tensest-state.json')
const CONCURRENCY = 8
const GAME_TYPES = 'R,F,D,L,W'

const arg = process.argv.find((a) => a.startsWith('--season='))
const season = arg ? Number(arg.slice('--season='.length)) : await fetchSeasonInPlay()

const sched = await getJson(
  `/api/v1/schedule?sportId=1&gameType=${GAME_TYPES}&startDate=${season}-02-01&endDate=${season}-12-31`,
)
const finals = sched.dates
  .flatMap((d) => d.games)
  .filter((g) => g.status?.abstractGameCode === 'F' && g.status?.codedGameState !== 'D')

const prev = await readJsonOr(OUT, null)
const state = await readJsonOr(STATE, null)
const carried = prev?.season === season && state?.season === season
const done = new Set(carried ? state.done : [])
let store = carried ? { league: prev.league ?? [], teams: prev.teams ?? {} } : emptyStore()

const todo = finals.filter((g) => !done.has(g.gamePk))
if (todo.length === 0) {
  console.log(`tensest: ${season}, nothing new (${done.size} games read)`)
  process.exit(0)
}

const read = await mapConcurrent(todo, CONCURRENCY, async (g) => {
  const plays = await getJson(`/api/v1/game/${g.gamePk}/winProbability`)
  return { g, rows: playRows(g, Array.isArray(plays) ? plays : []) }
})
const ok = read.filter(Boolean)
if (ok.length === 0) throw new Error('tensest: every winProbability read failed')

store = addRows(store, ok.flatMap((r) => r.rows))
assertFloorHolds(store)
for (const r of ok) done.add(r.g.gamePk)

const last = finals.map((g) => g.officialDate).sort().at(-1) ?? null
await writeJsonAtomic(OUT, { season, generatedAt: new Date().toISOString(), through: last, games: done.size, ...store })
await writeJsonAtomic(STATE, { season, done: [...done].sort((a, b) => a - b) })
console.log(`tensest: ${season}, read ${ok.length} of ${todo.length} new games; ${done.size} in all; league top ${store.league.length}`)
