// "Where they're from" player data (#1526, SPEC §6.4-§6.6). NIGHTLY (update-nightly-data.yml).
// Every big leaguer's schools and birthplace, grouped into places (a college, a high school, a
// town) that the /from pages read.
//
// The cache is scripts/data/from/players.json (one player a line). The FIRST run, with no cache,
// sweeps every season since 1876 and then every player: about 270 requests in 14 seconds.
// Every later night asks for the season in play, fetches the ids it has not seen (usually none or
// one request), and re-checks the next 1/30 of all stored players (about 4 requests), so every
// player is looked at again once in 30 nights. A player is never removed.
//
// Then the public files are rebuilt from the cache with sorted keys and no clock, except
// index.json's generatedAt, so a night with no change writes the same bytes.
//
//   node scripts/gen-where-from.mjs             the nightly run
//   node scripts/gen-where-from.mjs --offline   rebuild the public files from the cache only
//   node scripts/gen-where-from.mjs --ipeds <HD2023.csv>
//       hand-run, once a year: rewrite scripts/data/from/ipeds.json from IPEDS' directory file
//       (ADR-0100: a path, never downloaded; the file is Latin-1 inside
//       https://nces.ed.gov/ipeds/datacenter/data/HD2023.zip, fetched with lib/open-data/download.mjs)
//
// Reads, all committed: ipeds.json (the school list, IPEDS year in its `year` field),
// college-overrides.json ({ apiName: unitid | null }, hand-kept: the report below lists the
// names that need a line), county-zone.json and point-county.json (gen-where-from-map.mjs), and
// public/data/birthplaces/ (gen-bio-history.mjs). Nothing here needs a geo library or a download.
import { readFile, readdir, rename, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { mapConcurrent } from './lib/concurrency.mjs'
import { readJsonOr, writeJsonAtomic, writeShards } from './lib/io.js'
import { getJson } from './lib/statsapi.mjs'
import { fetchSeasonInPlay } from './lib/time/season-in-play.mjs'
import { buildCollegeMatcher } from './lib/from/college-match.mjs'
import { packSchools, parseHd, unpackSchools } from './lib/from/ipeds.mjs'
import { buildFrom } from './lib/from/places.mjs'
import { fetchPeople, fetchSeasonIds, FIRST_SEASON, recheckSlice, slimPerson, sortedIds } from './lib/from/players.mjs'
import { albersUsa } from './lib/from/project.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DATA = `${ROOT}scripts/data/from`
const OUT = `${ROOT}public/data/from`
const BIRTHPLACES = `${ROOT}public/data/birthplaces`
const args = process.argv.slice(2)

async function writeText(path, text) {
  await writeFile(`${path}.tmp`, text)
  await rename(`${path}.tmp`, path)
}

// One player a line keeps a nightly change to a few lines of diff.
const serialize = (players) =>
  `{"players":{\n${sortedIds(players).map((id) => `${JSON.stringify(id)}:${JSON.stringify(players[id])}`).join(',\n')}\n}}\n`

if (args[0] === '--ipeds') {
  const file = args[1]
  if (!file) throw new Error('usage: gen-where-from.mjs --ipeds <HD csv>')
  const schools = parseHd(await readFile(file, 'latin1'))
  const year = Number(file.match(/HD(\d{4})/i)?.[1])
  if (!year || schools.length < 5000) throw new Error(`not an IPEDS HD file: ${schools.length} rows, year ${year}`)
  await writeJsonAtomic(`${DATA}/ipeds.json`, { year, schools: packSchools(schools) })
  console.log(`where-from: ipeds.json holds ${schools.length} schools (IPEDS ${year})`)
  process.exit(0)
}

// --- 1. The cache -----------------------------------------------------------------------------
const cached = await readJsonOr(`${DATA}/players.json`, { players: {} })
const players = cached.players
const { cursor: savedCursor } = await readJsonOr(`${DATA}/cursor.json`, { cursor: 0 })
let cursor = savedCursor
let requests = 0
let fetched = 0

if (!args.includes('--offline')) {
  const season = await fetchSeasonInPlay()
  if (!Object.keys(players).length) {
    // The first sweep. firstSeason = the first season list a player appears in.
    const seasons = Array.from({ length: season - FIRST_SEASON + 1 }, (_, i) => FIRST_SEASON + i)
    const lists = await mapConcurrent(seasons, 4, (y) => fetchSeasonIds(getJson, y), { strict: true })
    requests += seasons.length
    const first = new Map()
    lists.forEach((ids, i) => ids.forEach((id) => first.has(id) || first.set(id, seasons[i])))
    const got = await fetchPeople(getJson, [...first.keys()], mapConcurrent)
    requests += got.requests
    fetched += got.people.length
    for (const p of got.people) players[p.id] = slimPerson(p, first.get(String(p.id)))
  } else {
    // New players: every id the season in play lists that the cache does not hold.
    const listed = await fetchSeasonIds(getJson, season)
    requests += 1
    const fresh = listed.filter((id) => !(id in players))
    // The rolling re-check, plus the new ids, in one pass.
    const slice = recheckSlice(sortedIds(players), cursor)
    cursor = slice.cursor
    const want = [...new Set([...fresh, ...slice.ids])]
    const got = await fetchPeople(getJson, want, mapConcurrent)
    requests += got.requests
    fetched += got.people.length
    for (const p of got.people) players[p.id] = slimPerson(p, season, players[p.id])
  }
  if (!Object.keys(players).length) throw new Error('where-from: the cache is empty after the run')
  await writeText(`${DATA}/players.json`, serialize(players))
  await writeJsonAtomic(`${DATA}/cursor.json`, { cursor })
}

// --- 2. The lookups ---------------------------------------------------------------------------
const ipeds = await readJsonOr(`${DATA}/ipeds.json`, null)
if (!ipeds) throw new Error('where-from: scripts/data/from/ipeds.json is missing (run with --ipeds <HD csv>)')
const overrides = await readJsonOr(`${DATA}/college-overrides.json`, {})
const matcher = buildCollegeMatcher(unpackSchools(ipeds.schools), overrides)
const countyZone = await readJsonOr(`${DATA}/county-zone.json`, null)
const pointCounty = await readJsonOr(`${DATA}/point-county.json`, null)
if (!countyZone || !pointCounty) throw new Error('where-from: county-zone.json or point-county.json is missing (run gen-where-from-map.mjs)')

// personId -> the "lat,lon" key of their birth town (the same key point-county.json uses).
const birthKey = new Map()
for (const name of await readdir(BIRTHPLACES)) {
  if (!name.endsWith('.json')) continue
  for (const place of (await readJsonOr(`${BIRTHPLACES}/${name}`, { places: [] })).places) {
    for (const person of place.people) birthKey.set(String(person.personId), `${place.lat},${place.lon}`)
  }
}

// --- 3. The public files ----------------------------------------------------------------------
const { files, index, report } = buildFrom(players, {
  matchCollege: matcher.match,
  schoolOf: matcher.school,
  countyZone,
  pointCounty,
  birthPoint: (id) => birthKey.get(String(id)) ?? null,
  project: (lat, lon) => albersUsa(lon, lat),
})

const byDir = {}
for (const [rel, body] of Object.entries(files)) {
  const [dir, file] = rel.split('/')
  ;(byDir[dir] ??= []).push([file.replace(/\.json$/, ''), body])
}
// A full rebuild each night, so writeShards may sweep away a shard whose last place went.
for (const [dir, entries] of Object.entries(byDir)) await writeShards(`${OUT}/${dir}`, entries)
await writeJsonAtomic(`${OUT}/index.json`, { generatedAt: new Date().toISOString(), ...index })

// --- 4. The report ----------------------------------------------------------------------------
const pct = (n, of) => `${((100 * n) / of).toFixed(1)}%`
console.log(
  `where-from: ${report.players} players (${fetched} fetched in ${requests} requests); ` +
    `places: ${report.places.college} colleges, ${report.places['high-school']} high schools, ` +
    `${report.places.hometown} US towns, ${report.places.countries} countries`,
)
console.log(
  `where-from: college match ${report.collegeMatched} of ${report.collegeRecords} records (${pct(report.collegeMatched, report.collegeRecords)}); ` +
    `${report.hsSkipped} of ${report.hsRecords} high-school records had no state and no city; ${report.hometownUnplaced} US births had an unknown state`,
)
const todo = report.unmatched.filter((u) => u.rule !== 'override')
console.log(
  `where-from: ${todo.length} college names unmatched (add each to scripts/data/from/college-overrides.json: ` +
    `an IPEDS unitid when certain, else null); ${report.unmatched.length - todo.length} more are overridden to null`,
)
for (const u of todo.slice(0, 60)) {
  console.log(`  ${String(u.players).padStart(4)}  ${u.name}  [${u.rule}]${u.candidates.length ? ` ${u.candidates.join(', ')}` : ''}`)
}
