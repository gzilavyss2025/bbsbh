// Regenerates public/data/world-series/events.json: the tagged events of every World
// Series game (a grand slam, a walk-off, a pitcher's hit in a winner-take-all game, ...).
// What a tag means is decided once, in src/lib/worldSeries/classify.js.
//
// WHAT RUNS IT. Nothing on a cron: this is a HAND RUN, once after each World Series
// (the data of a finished Series never changes). Not on the nightly; the current Series
// reaches the app through the nightly callouts shard instead (scripts/gen-callouts.mjs).
//   node scripts/gen-world-series-events.mjs --from=1903 --to=2025
//   node scripts/gen-world-series-events.mjs --from=1903 --to=2025 --out=DIR   # measuring run
//   node scripts/gen-world-series-events.mjs --from=1903 --to=2025 --check     # diff only, writes nothing
// With no flags --from is 1903 and --to is last year: pass --to=Y after a Series ends in Y.
// The run REPLACES the whole file. The game list comes from public/data/world-series/
// series.json when it covers the range, else from one schedule call per season; then one
// playByPlay call for each distinct gamePk. About 830 calls.
//
// NO generatedAt: the `coverage` block is the file's own clock (check-data-freshness.mjs).
// All logic a test must reach is in scripts/lib/world-series/events.mjs; this file RUNS on import.
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from './lib/args.mjs'
import { mapConcurrent } from './lib/concurrency.mjs'
import { readJsonOr } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import {
  PLAY_FIELDS, buildEventsDoc, gamesFromSchedule, gamesFromSeriesJson, seasonRange, serializeDoc,
} from './lib/world-series/events.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const parsed = parseArgs(process.argv.slice(2))
const { from, to } = seasonRange(parsed, new Date().getUTCFullYear() - 1, new Date().getUTCFullYear())
const outDir = parsed.out ? resolve(parsed.out) : join(root, 'public', 'data', 'world-series')
const outFile = join(outDir, 'events.json')

const seriesDoc = await readJsonOr(join(root, 'public', 'data', 'world-series', 'series.json'), null)
const covered = seriesDoc && seriesDoc.coverage.from <= from && seriesDoc.coverage.through >= to
const years = Array.from({ length: to - from + 1 }, (_, i) => from + i)
const listed = await mapConcurrent(years, 8, async (season) => {
  const games = covered
    ? gamesFromSeriesJson(seriesDoc, season)
    : gamesFromSchedule(await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=W`))
  return { season, games }
}, { strict: true })
const seasons = listed.filter((s) => s.games.length) // no Series in 1904 or 1994

const flat = seasons.flatMap((s) => s.games)
const plays = await mapConcurrent(
  flat, 8, (g) => getJson(`/api/v1/game/${g.pk}/playByPlay?fields=${PLAY_FIELDS}`), { strict: true },
)
flat.forEach((g, i) => { g.pbp = plays[i] })

const text = serializeDoc(buildEventsDoc(seasons, { from, to }))
if (parsed.check) {
  const committed = await readFile(outFile, 'utf8').catch(() => '')
  console.log(committed === text ? 'events.json is up to date' : 'events.json differs from a fresh run')
  process.exit(committed === text ? 0 : 1)
}
await mkdir(outDir, { recursive: true })
await writeFile(outFile, text)
console.log(`wrote ${outFile}: ${seasons.length} Series, ${flat.length} games`)
