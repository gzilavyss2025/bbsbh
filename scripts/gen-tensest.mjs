// Regenerates public/data/tensest.json — the tense at-bats of the season in play, by
// MLB's own leverage index: every play at or above LI_FLOOR, as one flat list with its
// park, which the Tensest Moments page ranks and slices itself (src/api/tensest/, #2981).
//
// WHY A GENERATOR: the leverage of every at-bat lives in one winProbability feed
// per game, 2,400+ games a season. The page cannot make that many calls, so this
// reads each game once and keeps only the tense plays (scripts/lib/tensest.mjs).
//
// It also writes public/data/tensest-cutoffs.json: the season's leverage edges for
// the Pressure meter's 10 bars (scripts/lib/tensest/cutoffs.mjs), from a histogram
// of every play read.
//
// INCREMENTAL: scripts/data/tensest-state.json lists the games already read, and
// holds that histogram. A state file with no histogram is rebuilt from scratch. A run
// reads only Final games not on that list, folds their tense plays into the flat
// list in the output file, and adds them to the list. The first run of a season reads
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
import { gameRowsOrThrow, isPlayedFinal, mergePlays } from './lib/tensest/tensest.mjs'
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
// `plays` is the flat list (#2981); a file from before it has the old ranked lists,
// so it is rebuilt from scratch.
const carried = prev?.season === season && state?.season === season && histOrNull(state.hist) !== null && Array.isArray(prev.plays)
const done = new Set(carried ? state.done : [])
let hist = carried ? state.hist : emptyHist()
let plays = carried ? prev.plays : []

// A suspended game is listed on both dates; read it once, or its plays count twice.
const todo = [...new Map(finals.filter((g) => !done.has(g.gamePk)).map((g) => [g.gamePk, g])).values()]
if (todo.length === 0) {
  // Restamp both files anyway: the freshness guard reads the stamp, and the nightly
  // commit drops a stamp-only change (nightly/drop-stamp-only.mjs), so this commits nothing.
  if (carried) {
    await writeJsonAtomic(OUT, { ...prev, generatedAt: new Date().toISOString() })
    await writeCutoffs(cutoffsFromHist(hist))
  }
  console.log(`tensest: ${season}, nothing new (${done.size} games read)`)
  process.exit(0)
}

// The cutoffs alone, for the Pressure meter: 9 numbers, not the whole board.
// Written every run; a night they do not move is a stamp-only change the nightly
// commit drops (nightly/drop-stamp-only.mjs).
async function writeCutoffs(cutoffs) {
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

plays = mergePlays(plays, ok.flatMap((r) => r.rows))
// The page cuts each club's top 25 batting and pitching from this list, which stops at
// LI_FLOOR. A club side with fewer than 25 plays here shows a short list; say so, so a
// season where that happens late (not just early) is noticed and the floor lowered.
const sides = new Map()
const bump = (k) => sides.set(k, (sides.get(k) ?? 0) + 1)
for (const r of plays) { bump(`${r.top ? r.aw : r.hm} batting`); bump(`${r.top ? r.hm : r.aw} pitching`) }
const short = [...sides].filter(([, n]) => n < 25).map(([k]) => k)
if (short.length) console.warn(`tensest: under 25 plays at LI >= 4 for ${short.join(', ')}; their lists are short (lower LI_FLOOR if this is late in a season)`)
for (const r of ok) done.add(r.g.gamePk)
const cutoffs = cutoffsFromHist(hist)

const last = finals.map((g) => g.officialDate).sort().at(-1) ?? null
await writeJsonAtomic(OUT, { season, generatedAt: new Date().toISOString(), through: last, games: done.size, plays })
await writeCutoffs(cutoffs)
await writeJsonAtomic(STATE, { season, done: [...done].sort((a, b) => a - b), hist })
console.log(`tensest: ${season}, read ${ok.length} of ${todo.length} new games; ${done.size} in all; ${plays.length} tense plays; bar edges ${cutoffs?.li.join(' ')}`)
