// gen-bio-history.mjs -- Retrosheet's biofile0.csv, joined to MLBAM ids through the
// Chadwick register, written as TWO datasets (ADR-0100):
//   public/data/on-this-day/{MM-DD}.json     players born and debuted on each calendar day
//   public/data/birthplaces/{ab}.json       players grouped by birth city (ab = first two letters)
//
// HAND-RUN, NOT ON A CRON, and it stays that way. The file is history; a re-run is
// worth it only after Retrosheet publishes a new biodata.zip. The app never fetches
// either source. Nothing in this file downloads: it reads the paths you pass.
//
//   1. Download each file into its OWN new, empty folder OUTSIDE the repo:
//        node scripts/lib/open-data/download.mjs https://www.retrosheet.org/downloads/biodata.zip <dir>
//        node scripts/lib/open-data/download.mjs <register people-{0-9,a-f}.csv URL> <dir>
//      Unzip biodata.zip there too. The register's files live at
//      https://raw.githubusercontent.com/chadwickbureau/register/master/data/
//   2. node scripts/gen-bio-history.mjs <biofile0.csv> <people-*.csv ...>
//
// Files are told apart by name: biofile0.csv, people-*.csv. `--out <dir>` and
// `--out-places <dir>` write somewhere else (the test uses them). There is no clock,
// so a re-run with the same input rewrites the same bytes. The report it prints is
// the one the PR quotes.
import { readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from './lib/csv.mjs'
import { writeShards } from './lib/io.js'
import { buildBioShards } from './lib/open-data/bio-shards.mjs'
import { buildRetroBridge } from './lib/open-data/retro-bridge.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const at = args.indexOf(name)
  return at >= 0 ? args.splice(at, 2)[1] : fallback
}
const out = flag('--out', join(root, 'public', 'data', 'on-this-day'))
const outPlaces = flag('--out-places', join(root, 'public', 'data', 'birthplaces'))

const bioFiles = args.filter((p) => basename(p) === 'biofile0.csv')
if (bioFiles.length !== 1) throw new Error(`pass exactly one biofile0.csv (got ${bioFiles.length})`)
const registerFiles = args.filter((p) => /^people-[0-9a-f]\.csv$/.test(basename(p)))
if (!registerFiles.length) throw new Error('pass the register people-*.csv files')

const read = async (path) => parseCsv(await readFile(path, 'utf8'))
const bio = await read(bioFiles[0])
const register = (await Promise.all(registerFiles.map(read))).flat()

const bridge = buildRetroBridge(register)
const { onThisDay, birthplaces, report } = buildBioShards({ bio, retroToMlbam: bridge.retroToMlbam })
// writeShards sweeps every old shard, so a bad input must stop BEFORE it writes.
if (!report.players || report.players === report.noMlbam) {
  throw new Error(`no placed players (read ${report.players}, ${report.noMlbam} with no MLBAM id); refusing to overwrite the shards`)
}
const days = await writeShards(out, onThisDay)
const places = await writeShards(outPlaces, birthplaces)

const size = (shards) => Math.max(...shards.map(([, body]) => JSON.stringify(body).length))
console.log(`register rows: ${bridge.rows}, bridged ${bridge.matched}, no match ${bridge.noMatch}, id clashes ${bridge.conflicts}`)
console.log(`people read: ${report.people}`)
console.log(`players (debut date in the file): ${report.players}`)
console.log(`no MLBAM id: ${report.noMlbam}`)
console.log(`kept: ${report.players - report.noMlbam}; left out of debuts, no debut day: ${report.noDebutDate}; left out of birthdays, no birthdate: ${report.noBirthdate}; left out of birthplaces, no city or state: ${report.noPlace}`)
console.log(`on-this-day: ${report.born} births, ${report.debuted} debuts, ${days.written} shards (${days.swept} swept), largest ${size(onThisDay)} bytes -> ${out}`)
console.log(`birthplaces: ${report.places} players, ${places.written} shards (${places.swept} swept), largest ${size(birthplaces)} bytes -> ${outPlaces}`)
