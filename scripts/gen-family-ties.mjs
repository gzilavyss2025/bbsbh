// gen-family-ties.mjs -- Retrosheet's relatives.csv, joined to MLBAM ids through
// the Chadwick register, written as public/data/family-ties/{NN}.json (ADR-0100).
//
// HAND-RUN, NOT ON A CRON, and it stays that way. The file is history; a re-run
// is worth it only after Retrosheet publishes a new biodata.zip. The app never
// fetches either source. Nothing in this file downloads: it reads the paths you pass.
//
//   1. Download each file into its OWN new, empty folder OUTSIDE the repo:
//        node scripts/lib/open-data/download.mjs https://www.retrosheet.org/downloads/biodata.zip <dir>
//        node scripts/lib/open-data/download.mjs <register people-{0-9,a-f}.csv URL> <dir>
//      Unzip biodata.zip there too. The register's files live at
//      https://raw.githubusercontent.com/chadwickbureau/register/master/data/
//   2. node scripts/gen-family-ties.mjs <biofile0.csv> <relatives.csv> <people-*.csv ...>
//
// Files are told apart by name: biofile0.csv, relatives.csv, people-*.csv.
// `--out <dir>` writes somewhere else (the test uses it). There is no clock, so a
// re-run with the same input rewrites the same bytes. The report it prints is
// the one the PR quotes.
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from './lib/csv.mjs'
import { writeShards } from './lib/io.js'
import { buildFamilyTies } from './lib/open-data/family-ties.mjs'
import { buildRetroBridge } from './lib/open-data/retro-bridge.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const outAt = args.indexOf('--out')
const out = outAt >= 0 ? args.splice(outAt, 2)[1] : join(root, 'public', 'data', 'family-ties')

const only = (name) => {
  const hits = args.filter((p) => basename(p) === name)
  if (hits.length !== 1) throw new Error(`pass exactly one ${name} (got ${hits.length})`)
  return hits[0]
}
const registerFiles = args.filter((p) => /^people-[0-9a-f]\.csv$/.test(basename(p)))
if (!registerFiles.length) throw new Error('pass the register people-*.csv files')

const read = async (path) => parseCsv(await readFile(path, 'utf8'))
const bio = await read(only('biofile0.csv'))
const relatives = await read(only('relatives.csv'))
const register = (await Promise.all(registerFiles.map(read))).flat()

const bridge = buildRetroBridge(register)
const { shards, report } = buildFamilyTies({ bio, relatives, retroToMlbam: bridge.retroToMlbam })
const { written, swept } = await writeShards(out, shards)

console.log(`register rows: ${bridge.rows}, bridged ${bridge.matched}, no match ${bridge.noMatch}, id clashes ${bridge.conflicts}`)
console.log(`relatives read: ${report.relativesRead}`)
console.log(`both ends bridged: ${report.bothBridged}`)
console.log(`one end bridged: ${report.oneBridged}`)
console.log(`neither end bridged: ${report.neitherBridged}`)
console.log(`entries: ${report.entries}, players: ${report.players}`)
console.log(`${written} shards written, ${swept} swept -> ${out}`)
