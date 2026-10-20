// Writes public/data/umpire-history/{NN}.json — each umpire's games at each position
// per season, and each club's record with him at home plate, for the seasons BEFORE
// Tally's own umpire files (public/data/umpires/, gen-umpires.mjs). Sharded on
// shardKey100 of the umpire's MLBAM id. Reader: src/api/history/umpireHistory.js.
// The rule and the measured coverage: scripts/lib/umpire/history.mjs.
//
// HAND-RUN, on no cron: the seasons are closed, so the data does not change. Run it
// again only when the range changes.
//
//   node scripts/gen-umpire-history.mjs [--from=2000] [--through=2022]
//
// `--through` defaults to the season before the first one in umpires/seasons.json, so
// the two stores never hold the same season. One schedule call a season.
//
// A FULL REBUILD of its own folder: it writes every shard and deletes the ones it did
// not write. It merges into no carried-forward store, so the reassignable-merge rule
// (scripts/CLAUDE.md) does not apply: an official the source corrects drops out on the
// next run. No `generatedAt`: the same input writes the same bytes.
import { dirname, join } from 'node:path'
import { readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getJson } from './lib/statsapi.mjs'
import { readSeasons, writeShards } from './lib/io.js'
import { parseArgs } from './lib/args.mjs'
import { buildUmpireHistory, shardUmpireHistory } from './lib/umpire/history.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public', 'data', 'umpire-history')
const args = parseArgs(process.argv.slice(2))
const ownSeasons = (await readSeasons(join(root, 'public', 'data', 'umpires')))?.seasons ?? []
const firstSeason = Number(args.from) || 2000
const throughSeason = Number(args.through) || (ownSeasons.length ? Math.min(...ownSeasons) - 1 : NaN)
if (!(throughSeason >= firstSeason)) throw new Error(`no seasons to build (from ${firstSeason} through ${throughSeason})`)
if (ownSeasons.some((s) => s <= throughSeason)) throw new Error(`umpires/ already holds a season through ${throughSeason}`)

const schedules = []
for (let season = firstSeason; season <= throughSeason; season++) {
  const data = await getJson(`/api/v1/schedule?sportId=1&season=${season}&gameType=R,F,D,L,W&hydrate=officials`)
  schedules.push({ season, dates: data.dates ?? [] })
}

const { umpires, report } = buildUmpireHistory(schedules)
const shards = shardUmpireHistory(umpires, { firstSeason, throughSeason })
const { swept } = await writeShards(outDir, shards)
const sizes = await Promise.all((await readdir(outDir)).map(async (name) => (await stat(join(outDir, name))).size))
const bytes = sizes.reduce((a, b) => a + b, 0)
const largest = Math.max(...sizes)

console.log(
  `wrote ${shards.size} shards (${report.umpires} umpires, ${report.games} games, ${report.noOfficials} with no officials) ` +
    `for ${firstSeason}-${throughSeason}; ${bytes} bytes, largest ${largest}` +
    (swept ? `; swept ${swept}` : ''),
)
