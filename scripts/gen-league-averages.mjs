// gen-league-averages.mjs -- the league batting average and ERA of every
// finished MLB season, 1901 on: public/data/league-averages.json.
//
// HAND-RUN, NOT ON A CRON. A finished season never changes. Run it once after
// each season ends (the file then gains that year):
//
//   node scripts/gen-league-averages.mjs
//
// The season in play is NOT in the file: the reader fetches it live
// (src/api/player/leagueAverages.js). The file has no timestamp, so a re-run writes the
// same bytes. `--out <path>` writes somewhere else. One call a season, about 125.
import { stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeJsonAtomic } from './lib/io.js'
import { mapConcurrent } from './lib/concurrency.mjs'
import { getJson } from './lib/statsapi.mjs'
import { leagueAveragesOf } from './lib/stats/league-averages.mjs'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'

const FIRST = 1901
const lastSeason = (await fetchSeasonInPlay()) - 1
const years = Array.from({ length: lastSeason - FIRST + 1 }, (_, i) => FIRST + i)

const outArg = process.argv.indexOf('--out')
const out = outArg > 0 ? process.argv[outArg + 1] : join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data', 'league-averages.json')

const splitsOf = (data, name) => data.stats?.find((s) => s.group?.displayName === name)?.splits
// strict: a failed call stops the run instead of writing a hole that reads as "not recorded".
const rows = await mapConcurrent(years, 6, async (year) => {
  const data = await getJson(`/api/v1/teams/stats?season=${year}&group=hitting,pitching&stats=season&sportIds=1`)
  return leagueAveragesOf({ hitting: splitsOf(data, 'hitting'), pitching: splitsOf(data, 'pitching') })
}, { strict: true })

const seasons = Object.fromEntries(years.map((year, i) => [year, rows[i]]))
await writeJsonAtomic(out, { lastSeason, seasons })

const missing = years.filter((_, i) => rows[i].era === null || rows[i].avg === null)
console.log(`league-averages: ${years.length} seasons, ${years.length} calls, ${(await stat(out)).size} bytes -> ${out}`)
console.log(`missing a figure: ${missing.map((y) => `${y}(${seasons[y].avg === null ? 'avg ' : ''}${seasons[y].era === null ? 'era' : ''})`).join(' ') || 'none'}`)
