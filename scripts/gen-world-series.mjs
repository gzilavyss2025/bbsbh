// Writes public/data/world-series/series.json: every World Series game from 1903, in one
// frozen file (ADR-0114, .scratch/world-series-callouts/contract.md §3).
//
// HAND RUN, after each World Series. A full run costs one schedule call per season (121)
// plus one playByPlay call per distinct gamePk (707), about 830 calls, at 8 at a time.
//   node scripts/gen-world-series.mjs                        # 1903 to the last finished season
//   node scripts/gen-world-series.mjs --from=1903 --to=2025
//   node scripts/gen-world-series.mjs --check                # count only, writes nothing
//   node scripts/gen-world-series.mjs --out=DIR              # write to DIR/series.json
// EACH RUN REPLACES THE WHOLE FILE. No generatedAt: `coverage` is the file's own clock.
// Never run it from the nightly cron: tonight's World Series game must not reach a static
// file before the reader reveals it (ADR-0114).
//
// All logic a test must reach is in lib/world-series/series.mjs.
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from './lib/args.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { writeJsonAtomic } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { buildFile, dedupeByPk, gamesOf } from './lib/world-series/series.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = parseArgs(process.argv.slice(2))
for (const k of Object.keys(args)) {
  if (!['from', 'to', 'out', 'check'].includes(k)) throw new Error(`unknown flag: --${k}`)
}
const from = Number(args.from ?? 1903)
const to = Number(args.to ?? (await fetchSeasonInPlay()) - 1)
const seasons = Array.from({ length: to - from + 1 }, (_, i) => from + i)

// strict: a failed call stops the run, so a hole never ships in a file that replaces all.
const schedules = await mapConcurrent(seasons, 8, (s) => getJson(
  `/api/v1/schedule?sportId=1&season=${s}&gameType=W&hydrate=linescore,team`), { strict: true })
const rowsBySeason = Object.fromEntries(seasons.map((s, i) => [s, gamesOf(schedules[i])]))
const pks = [...new Set(Object.values(rowsBySeason).flat().map((g) => g.gamePk))]
const plays = await mapConcurrent(pks, 8, (pk) => getJson(
  `/api/v1/game/${pk}/playByPlay?fields=allPlays,about,atBatIndex,result,awayScore,homeScore`), { strict: true })
const playsByPk = Object.fromEntries(pks.map((pk, i) => [pk, plays[i]]))

const file = buildFile(seasons, rowsBySeason, playsByPk)
const rows = Object.values(rowsBySeason).flat()
console.log(`schedule rows ${rows.length}, distinct pks ${pks.length}, ` +
  `duplicate pks dropped ${rows.length - pks.length}, ties ${file.coverage.ties}, ` +
  `games with no seriesGameNumber ${dedupeByPk(rows).filter((g) => !g.seriesGameNumber).length}`)
console.log(`series ${file.coverage.seasons}, games ${file.coverage.games}`)
if (!args.check) {
  const out = join(args.out ? resolve(args.out) : join(root, 'public', 'data', 'world-series'), 'series.json')
  await writeJsonAtomic(out, file)
  console.log(`wrote ${out}`)
}
