// Builds the history store (#3135): Retrosheet play-by-play for the 1961-2014 regular
// seasons, one row per plate appearance, keyed on gamePk and MLBAM ids, and uploads it to
// Vercel Blob under `retro/v1/`. The layout and the pure half: scripts/lib/research/retro.mjs.
// Docs: docs/research-store.md, "History store".
//
// WHAT RUNS IT. By hand only, through .github/workflows/retro-store.yml (dispatch): the
// data is history and changes when Retrosheet revises a season, a few times a year at
// most (ADR-0100). That workflow downloads the inputs and builds Chadwick's cwevent.
//
// INPUTS, as paths (ADR-0100: a generator never downloads):
//   --events=<dir>    one extracted `{year}eve.zip` per `{year}/` subfolder
//   --register=<dir>  the Chadwick register's people-*.csv
//   --cwevent=<bin>   Chadwick 0.7.2 cwevent
// Game ids come from statsapi's schedule for each season (lib/statsapi.mjs).
//
// A SAFE BUILD. Every file is written to --out first. Any Retrosheet game that does not
// join to a gamePk, or any cwevent row that does not line up with its raw play line, fails
// the run before an upload, so Blob never holds part of a store. manifest.json goes last.
//
//   node scripts/research/gen-retro-store.mjs --events=E --register=R --cwevent=B --seasons=1961,1988,2014
//   node scripts/research/gen-retro-store.mjs --events=E --register=R --cwevent=B --upload   # all of 1961-2014

import { execFileSync } from 'node:child_process'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { gzipSync } from 'node:zlib'
import { parseArgs, strOpt } from '../lib/args.mjs'
import { getJson } from '../lib/statsapi.mjs'
import { mapConcurrent } from '../lib/concurrency.mjs'
import { buildRetroBridge } from '../lib/open-data/retro-bridge.mjs'
import { CHADWICK_JOIN, RETROSHEET_CREDIT } from '../lib/open-data/credits.mjs'
import { csvObjects } from '../../src/lib/csv/parse.js'
import {
  CWEVENT_FIELDS, FIRST_SEASON, LAST_SEASON, STORE_VERSION,
  gameIndex, joinSeason, monthShards, parkFile, parkPart, parkTable, parseEventFile, peopleNames, scheduleRows, seasonEntry, seasonRows,
} from '../lib/research/retro.mjs'

const PREFIX = 'retro/v1/'
const args = parseArgs(process.argv.slice(2))
const need = (k) => strOpt(args, k) ?? (() => { throw new Error(`--${k}=<path> is required`) })()
const eventsDir = need('events')
const registerDir = need('register')
const cwevent = need('cwevent')
const out = strOpt(args, 'out') ?? join(tmpdir(), 'retro-store')
const upload = Boolean(args.upload)
const seasons = strOpt(args, 'seasons')?.split(',').map(Number) ?? Array.from({ length: LAST_SEASON - FIRST_SEASON + 1 }, (_, i) => FIRST_SEASON + i)
if (seasons.some((s) => !(s >= FIRST_SEASON && s <= LAST_SEASON))) throw new Error(`--seasons must sit in ${FIRST_SEASON}-${LAST_SEASON}`)
if (upload && !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('--upload needs BLOB_READ_WRITE_TOKEN')
// The park files and the manifest span every season, so an upload is always all of them.
if (upload && seasons.length !== LAST_SEASON - FIRST_SEASON + 1) throw new Error('--upload builds every season: drop --seasons')

const register = (await Promise.all((await readdir(registerDir)).filter((f) => /^people-.*\.csv$/.test(f)).sort()
  .map(async (f) => csvObjects((await readFile(join(registerDir, f), 'utf8')).replace(/^﻿/, ''))))).flat()
const bridge = buildRetroBridge(register)
if (!bridge.matched) throw new Error(`no register rows in ${registerDir}`)
const mlbamOf = (rid) => (bridge.retroToMlbam.has(rid) ? Number(bridge.retroToMlbam.get(rid)) : null)
console.log(`register: ${bridge.rows} rows, ${bridge.matched} bridged, ${bridge.conflicts} conflicts`)

await rm(out, { recursive: true, force: true })
const files = new Map() // Blob path -> local path
const write = async (path, obj) => {
  const local = join(out, path)
  await mkdir(join(local, '..'), { recursive: true })
  await writeFile(local, JSON.stringify(obj))
  files.set(path, local)
}

const manifest = { v: STORE_VERSION, credit: [RETROSHEET_CREDIT, CHADWICK_JOIN], seasons: {} }
const allGames = []
const people = new Set()
const parkSeasons = new Map() // park -> [season]
let bad = 0

for (const season of seasons) {
  const dir = join(eventsDir, String(season))
  const evFiles = (await readdir(dir)).filter((f) => /\.E[VD][AN]$/i.test(f)).sort()
  if (!evFiles.length) throw new Error(`${dir}: no .EVA/.EVN files`)
  const retroGames = (await Promise.all(evFiles.map(async (f) => parseEventFile(await readFile(join(dir, f), 'latin1'))))).flat()
  const sched = scheduleRows(await getJson(`/api/v1/schedule?sportId=1&season=${season}&startDate=${season}-01-01&endDate=${season}-12-31&hydrate=linescore`))
  const { byId, unjoined } = joinSeason(retroGames, sched)
  const csv = execFileSync(cwevent, ['-q', '-y', String(season), '-f', CWEVENT_FIELDS, ...evFiles], { cwd: dir, maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'inherit'] }).toString('latin1')
  const { rows, games, stats } = seasonRows(csv, retroGames, byId, mlbamOf)

  const shards = monthShards(rows, season)
  for (const s of shards) {
    await write(`pa/${season}/${s.month}.json`, s.pa)
    await write(`pitches/${season}/${s.month}.json`, s.pitches)
  }
  await write(`games/${season}.json`, gameIndex(games, season))
  const parkOf = new Map(games.map((g) => [g.gamePk, g.park]))
  for (const park of new Set(games.map((g) => g.park).filter(Boolean))) {
    await write(`.park-parts/${park}/${season}.json`, parkPart(rows.filter((r) => parkOf.get(r.gamePk) === park)))
    parkSeasons.set(park, [...(parkSeasons.get(park) ?? []), season])
  }
  for (const r of rows) for (const id of [r.batter, r.pitcher]) if (id != null) people.add(id)
  allGames.push(...games)
  manifest.seasons[season] = seasonEntry(stats, games, shards)

  const e = manifest.seasons[season]
  console.log(`${season}: ${games.length} games, ${stats.pas} PAs, ${shards.length} months, pitch string ${e.pitchString}%, known count ${e.knownCount}%, unbridged people ${stats.unbridged.length}`)
  const problems = [
    unjoined.length && `${unjoined.length} games with no gamePk (${unjoined.slice(0, 5).join(' ')})`,
    stats.skippedUnjoined && `${stats.skippedUnjoined} PAs in unjoined games`,
    stats.noRawPlay && `${stats.noRawPlay} rows with no raw play line`,
    stats.pseqDiffers && `${stats.pseqDiffers} pitch strings differ from the raw file`,
  ].filter(Boolean)
  for (const p of problems) console.error(`${season}: ${p}`)
  bad += problems.length
}

// By-park files: one park's seasons, oldest first, read back from the parts.
for (const [park, list] of [...parkSeasons].sort()) {
  const parts = await Promise.all(list.sort((a, b) => a - b).map(async (s) => JSON.parse(await readFile(join(out, `.park-parts/${park}/${s}.json`), 'utf8'))))
  await write(`by-park/${park}.json`, parkFile(park, parts))
}
for (const p of [...files.keys()].filter((k) => k.startsWith('.park-parts/'))) files.delete(p)
await rm(join(out, '.park-parts'), { recursive: true, force: true })

await write('parks.json', { v: STORE_VERSION, parks: parkTable(allGames) })
await write('people.json', { v: STORE_VERSION, people: peopleNames(register, people) })
manifest.parks = parkSeasons.size
await write('manifest.json', manifest)

let gz = 0
for (const local of files.values()) gz += gzipSync(await readFile(local)).length
console.log(`${files.size} files in ${out}, ${(gz / 1e6).toFixed(1)} MB gzip`)
if (bad) {
  console.error(`${bad} problems above: nothing uploaded`)
  process.exit(1)
}

if (upload) {
  const { put } = await import('@vercel/blob')
  const send = async (path) => {
    const res = await put(PREFIX + path, await readFile(files.get(path)), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json', cacheControlMaxAge: 86400 })
    return res.url
  }
  // Data first, manifest last: a reader that finds the manifest finds every file it lists.
  const paths = [...files.keys()].filter((p) => p !== 'manifest.json')
  let n = 0
  await mapConcurrent(paths, 4, async (p) => {
    await send(p)
    if (++n % 100 === 0) console.log(`uploaded ${n} of ${paths.length}`)
  }, { strict: true })
  console.log(`uploaded ${await send('manifest.json')}`)
}
