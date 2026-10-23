// gen-played-for-both.mjs -- for each pair of MLB clubs, every player with an MLB game for each,
// written as public/data/played-for-both/{a}-{b}.json (club ids ascending; ADR-0100, #2579).
// It feeds the lineup page's "Played for both" card.
//
// HAND-RUN, NOT ON A CRON, and it stays that way. It reads public/data/team-seasons.json
// (Retrosheet, joined to MLBAM ids) and public/data/war-history/, so a re-run is worth it only
// after gen-team-seasons.mjs has run for a new season. Nothing in this file downloads: it reads
// the paths you pass.
//
//   1. Download the register's people-{0-9,a-f}.csv, each into its OWN new, empty folder OUTSIDE
//      the repo (the register URL is in scripts/gen-family-ties.mjs):
//        node scripts/lib/open-data/download.mjs <people-N.csv URL> <dir>
//   2. node scripts/gen-played-for-both.mjs <people-*.csv ...>
//
// The register gives each player's "First Last" name (key_mlbam, name_first, name_last).
// `--out <dir>` writes somewhere else (the test uses it). The rules, the code map and the score
// are in scripts/lib/open-data/played-for-both.mjs. No clock: a re-run writes the same bytes.
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from './lib/csv.mjs'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from './lib/open-data/credits.mjs'
import { buildPlayedForBoth, careerWarFrom } from './lib/open-data/played-for-both.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const take = (flag, fallback) => {
  const at = args.indexOf(flag)
  return at >= 0 ? args.splice(at, 2)[1] : fallback
}
const out = take('--out', join(root, 'public', 'data', 'played-for-both'))
const registerFiles = args.filter((p) => /^people-[0-9a-f]\.csv$/.test(basename(p)))
if (!registerFiles.length) throw new Error('pass the register people-*.csv files')

const dataDir = join(root, 'public', 'data')
const file = JSON.parse(await readFile(join(dataDir, 'team-seasons.json'), 'utf8'))
const warDir = join(dataDir, 'war-history')
const warShards = await Promise.all(
  (await readdir(warDir)).filter((f) => f.endsWith('.json')).sort().map(async (f) => JSON.parse(await readFile(join(warDir, f), 'utf8'))),
)
const war = careerWarFrom(warShards)

const wanted = new Set(file.players)
const names = new Map()
for (const path of registerFiles) {
  for (const row of parseCsv(await readFile(path, 'utf8'))) {
    const id = Number(row.key_mlbam)
    if (!wanted.has(id) || names.has(id)) continue
    const name = [row.name_first, row.name_last].filter(Boolean).join(' ')
    if (name) names.set(id, name)
  }
}
const nameless = file.players.filter((id) => !names.has(id)).length
console.log(`${file.players.length} players, ${names.size} named (${nameless} without a name), ${war.size} with WAR`)

const shards = buildPlayedForBoth({ file, names, war })
await mkdir(out, { recursive: true })
for (const [key, shard] of shards) {
  await writeFile(join(out, `${key}.json`), JSON.stringify({ credit: [RETROSHEET_CREDIT, CHADWICK_JOIN], ...shard }))
}
const smallest = Math.min(...[...shards.values()].map((s) => s.rows.length))
console.log(`${shards.size} shards -> ${out} (smallest list: ${smallest})`)
