// gen-team-seasons.mjs -- one roster per MLB team-season, from Retrosheet's
// allplayers.csv, joined to MLBAM ids through the Chadwick register, written as
// public/data/team-seasons.json (ADR-0100). It feeds "six degrees of teammates".
//
// HAND-RUN, NOT ON A CRON, and it stays that way. The file is history; a re-run is
// worth it after each season ends, when Retrosheet publishes new CSVs. The app never
// fetches either source. Nothing in this file downloads: it reads the paths you pass.
//
//   1. Download each file into its OWN new, empty folder OUTSIDE the repo:
//        node scripts/lib/open-data/download.mjs https://www.retrosheet.org/downloads/biodata.zip <dir>
//        node scripts/lib/open-data/download.mjs <register people-{0-9,a-f}.csv URL> <dir>
//      allplayers.csv is inside basiccsvs.zip (741 MB). Run `unzip -l` first, then
//      extract ONLY allplayers.csv. teams0.csv is inside biodata.zip.
//   2. node scripts/gen-team-seasons.mjs <allplayers.csv> <teams0.csv> <people-*.csv ...>
//
// Files are told apart by name: allplayers.csv, teams0.csv, people-*.csv.
// `--out <file>` writes somewhere else (the test uses it). `--min-share <0-1>` moves
// the bridge gate (default 0.98): the run fails if fewer MLB players bridge.
import { readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCsv } from './lib/csv.mjs'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from './lib/open-data/credits.mjs'
import { buildRetroBridge } from './lib/open-data/retro-bridge.mjs'
import { buildTeamSeasons, compactTeamSeasons } from './lib/open-data/team-seasons.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const take = (flag, fallback) => {
  const at = args.indexOf(flag)
  return at >= 0 ? args.splice(at, 2)[1] : fallback
}
const out = take('--out', join(root, 'public', 'data', 'team-seasons.json'))
const minShare = Number(take('--min-share', 0.98))
if (!(minShare > 0 && minShare <= 1)) throw new Error('--min-share takes a number above 0 and up to 1')

const only = (name) => {
  const hits = args.filter((p) => basename(p) === name)
  if (hits.length !== 1) throw new Error(`pass exactly one ${name} (got ${hits.length})`)
  return hits[0]
}
const registerFiles = args.filter((p) => /^people-[0-9a-f]\.csv$/.test(basename(p)))
if (!registerFiles.length) throw new Error('pass the register people-*.csv files')

const read = async (path) => parseCsv(await readFile(path, 'utf8'))
const players = await read(only('allplayers.csv'))
const teams = await read(only('teams0.csv'))
const register = (await Promise.all(registerFiles.map(read))).flat()

const bridge = buildRetroBridge(register)
const built = buildTeamSeasons({ players, teams, retroToMlbam: bridge.retroToMlbam })
const { report } = built
console.log(`register rows: ${bridge.rows}, bridged ${bridge.matched}, no match ${bridge.noMatch}, id clashes ${bridge.conflicts}`)
console.log(`allplayers rows: ${players.length}`)
console.log(`MLB players: ${report.mlbPlayers}, bridged ${report.bridged}, not bridged ${report.unbridged} (${(report.share * 100).toFixed(2)}% bridge)`)
if (report.share < minShare) throw new Error(`MLB bridge share ${(report.share * 100).toFixed(2)}% is below ${minShare}`)

const file = {
  credit: [RETROSHEET_CREDIT, CHADWICK_JOIN],
  throughSeason: built.teamSeasons.reduce((m, t) => Math.max(m, Number(t.key.split('-')[1])), 0),
  ...compactTeamSeasons(built),
}
await writeFile(out, JSON.stringify(file))
console.log(`${file.players.length} players, ${built.teamSeasons.length} team-seasons -> ${out}`)
