// "Where they're from" map data (#1526, SPEC §6.2 and §7.2-7.3). HAND-RUN, rarely:
// Census boundaries and metro areas change only when Census republishes, and the
// birthplace coordinates change only when gen-bio-history.mjs reruns. Rerun it after
// either, commit the output. The nightly gen-where-from.mjs reads what this writes and
// needs no geo library.
//
//   node scripts/gen-where-from-map.mjs <counties-albers-10m.json> <counties-10m.json>
//
// Inputs (ADR-0100: paths as arguments, never downloaded here). Both are us-atlas@3.0.1,
// the 2017 Census cartographic counties:
//   node scripts/lib/open-data/download.mjs https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-albers-10m.json <empty-folder>
//   node scripts/lib/open-data/download.mjs https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/counties-10m.json <empty-folder>
// plus two files already in the repo: scripts/data/from/metro-zones-2023.csv (Census
// delineation, July 2023, and the 2023 population estimates) and public/data/birthplaces/.
//
// Writes:
//   public/data/from/map/us.json      the 50 states + DC as one outline each
//   public/data/from/map/{ST}.json    that state's zones (metro areas + the rest by compass)
//   scripts/data/from/county-zone.json   { county FIPS: zone id }, read by the nightly run
//   scripts/data/from/point-county.json  { "lat,lon": county FIPS } for every US birthplace
// Every key is sorted and nothing carries a clock, so a rerun on the same inputs writes the
// same bytes (the freshness guard exempts public/data/from/map/).
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { geoBounds, geoCentroid, geoContains, geoPath } from 'd3-geo'
import * as topo from 'topojson-client'
import * as simp from 'topojson-simplify'
import { readJsonOr, writeJsonAtomic, writeShards } from './lib/io.js'
import { parseMetroZones, roundBox, STATE_FIPS, STATE_NAMES, stateZones } from './lib/from/zones.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const MAP_DIR = `${ROOT}public/data/from/map`
const DATA_DIR = `${ROOT}scripts/data/from`
const BIRTHPLACES = `${ROOT}public/data/birthplaces`
const VIEW = [975, 610]
// Weights are areas in projected pixels. 2 gives the national outline (about 26 KB);
// 0.5 keeps a zone edge true at the zoom a state is shown at.
const NATIONAL = 2
const ZONE = 0.5

const [albersPath, countiesPath] = process.argv.slice(2)
if (!albersPath || !countiesPath) {
  throw new Error('usage: gen-where-from-map.mjs <counties-albers-10m.json> <counties-10m.json>')
}
const readTopo = async (p) => JSON.parse(await readFile(p, 'utf8'))
const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))

const albers = simp.presimplify(await readTopo(albersPath))
const national = simp.simplify(albers, NATIONAL)
const detailed = simp.simplify(albers, ZONE)
const geo = await readTopo(countiesPath)
const features = topo.feature(geo, geo.objects.counties).features.filter((f) => STATE_FIPS[f.id.slice(0, 2)])

const centroid = {}
const boxOf = {}
for (const f of features) {
  centroid[f.id] = geoCentroid(f)
  boxOf[f.id] = geoBounds(f)
}

const { countyMetro, population } = parseMetroZones(await readFile(`${DATA_DIR}/metro-zones-2023.csv`, 'utf8'))
const path = geoPath().digits(1)
const group = (t) => {
  const byState = {}
  for (const g of t.objects.counties.geometries) {
    const st = STATE_FIPS[g.id.slice(0, 2)]
    if (st) (byState[st] ||= []).push(g)
  }
  return byState
}
const nationalBy = group(national)
const detailedBy = group(detailed)

const states = {}
const stateEntries = []
const countyZone = {}
for (const st of Object.keys(STATE_NAMES).sort()) {
  if (!nationalBy[st]) continue
  const outline = topo.merge(national, nationalBy[st])
  states[st] = { d: path(outline), b: roundBox(path.bounds(outline)) }

  const full = topo.merge(detailed, detailedBy[st])
  const [[x0, y0], [x1, y1]] = path.bounds(full)
  const counties = detailedBy[st].map((g) => ({ id: g.id, lon: centroid[g.id][0], lat: centroid[g.id][1] }))
  const zones = stateZones(
    st, counties, y1 - y0 > x1 - x0, (id) => countyMetro[id],
    (name) => population[`${Object.keys(STATE_FIPS).find((k) => STATE_FIPS[k] === st)}|${name}`] ?? 0,
  )
  const byId = new Map(detailedBy[st].map((g) => [g.id, g]))
  stateEntries.push([
    st,
    {
      zones: zones.map((z) => {
        for (const id of z.ids) countyZone[id] = z.id
        return { id: z.id, name: z.name, kind: z.kind, d: path(topo.merge(detailed, z.ids.map((id) => byId.get(id)))) }
      }),
    },
  ])
}

// SPEC §7.3: every birthplace coordinate -> the county that contains it. A bounding box
// filters first, so 20,000 players do not each test 3,142 polygons.
const seen = new Set()
for (const name of await readdir(BIRTHPLACES)) {
  if (!name.endsWith('.json')) continue
  for (const p of (await readJsonOr(`${BIRTHPLACES}/${name}`, { places: [] })).places) seen.add(`${p.lat},${p.lon}`)
}
const inBox = ([[w, s], [e, n]], lon, lat) => lat >= s && lat <= n && (w <= e ? lon >= w && lon <= e : lon >= w || lon <= e)
const pointCounty = {}
let abroad = 0
for (const key of [...seen].sort()) {
  const [lat, lon] = key.split(',').map(Number)
  const hit = features.find((f) => inBox(boxOf[f.id], lon, lat) && geoContains(f, [lon, lat]))
  if (hit) pointCounty[key] = hit.id
  else abroad++
}

await writeShards(MAP_DIR, [['us', { viewBox: VIEW, states }], ...stateEntries])
await writeJsonAtomic(`${DATA_DIR}/county-zone.json`, sortKeys(countyZone))
await writeJsonAtomic(`${DATA_DIR}/point-county.json`, pointCounty)

const zoneCount = stateEntries.reduce((n, [, s]) => n + s.zones.length, 0)
console.log(
  `where-from map: ${Object.keys(states).length} states, ${zoneCount} zones, ${Object.keys(countyZone).length} counties; ` +
    `${Object.keys(pointCounty).length} of ${seen.size} birthplace points in a county (${abroad} outside the 50 states + DC)`,
)
