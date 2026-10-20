// The pure half of the "Where they're from" map (#1526, SPEC §7.2): which zone each
// county belongs to. gen-where-from-map.mjs reads the geometry and passes plain
// numbers here, so the rule below can be tested without d3-geo.
//
// A ZONE is one of two kinds:
//   - metro: the in-state part of a Census Metropolitan Statistical Area whose 2023
//     in-state population is >= 500,000, at most 6 a state, largest first. The CSV
//     (scripts/data/from/metro-zones-2023.csv) already holds only those counties.
//   - compass: every other county of the state, split by county centroid along the
//     state's longer axis. 9+ counties -> 3 zones, 4-8 -> 2, 1-3 -> "Rest of {State}".
import { parseCsv } from '../csv.mjs'
import { slugify } from '../../../src/lib/route.js'
import { STATE_NAMES } from '../../../src/lib/from/states.js'

export const STATE_FIPS = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
  '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
  '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
  '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
  '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
}

export { STATE_NAMES }

// `{st}-{slug}` with the word "metro" dropped: ga-atlanta, ga-northern-georgia.
export const zoneId = (st, name) => `${st.toLowerCase()}-${slugify(name.replace(/ metro$/, ''))}`

// The CSV -> { countyFips: zone name } plus each zone's in-state population, so the
// generator can list metros largest first.
export function parseMetroZones(text) {
  const countyMetro = {}
  const population = {}
  for (const row of parseCsv(text)) {
    countyMetro[row.county_fips] = row.zone_name
    population[`${row.state_fips}|${row.zone_name}`] = Number(row.zone_pop_in_state)
  }
  return { countyMetro, population }
}

// Split a state's non-metro counties. `counties` is [{ id, lon, lat }]; `tall` says the
// state is taller than wide (a north-south split) or wider than tall (west-east).
// -> [{ name, ids }], north-first (or west-first), ids sorted.
export function compassZones(stateName, counties, tall) {
  if (!counties.length) return []
  const axis = (c) => (tall ? -c.lat : c.lon)
  const sorted = [...counties].sort((a, b) => axis(a) - axis(b) || (a.id < b.id ? -1 : 1))
  const parts = sorted.length >= 9 ? 3 : sorted.length >= 4 ? 2 : 1
  const labels =
    parts === 3 ? (tall ? ['Northern', 'Central', 'Southern'] : ['Western', 'Central', 'Eastern'])
    : parts === 2 ? (tall ? ['Northern', 'Southern'] : ['Western', 'Eastern'])
    : [null]
  return labels.map((label, i) => ({
    name: label ? `${label} ${stateName}` : `Rest of ${stateName}`,
    ids: sorted
      .slice(Math.round((i * sorted.length) / parts), Math.round(((i + 1) * sorted.length) / parts))
      .map((c) => c.id)
      .sort(),
  }))
}

// All of one state's zones: the metros (largest population first), then the compass zones.
// `counties` is [{ id, lon, lat }]; `metroOf(id)` -> zone name or undefined;
// `popOf(name)` -> in-state population. -> [{ id, name, kind, ids }].
export function stateZones(st, counties, tall, metroOf, popOf) {
  const metros = new Map()
  const rest = []
  for (const c of counties) {
    const name = metroOf(c.id)
    if (name) metros.set(name, [...(metros.get(name) ?? []), c.id])
    else rest.push(c)
  }
  const metroZones = [...metros]
    .sort(([a], [b]) => popOf(b) - popOf(a) || (a < b ? -1 : 1))
    .map(([name, ids]) => ({ name, kind: 'metro', ids: ids.sort() }))
  const compass = compassZones(STATE_NAMES[st], rest, tall).map((z) => ({ ...z, kind: 'compass' }))
  return [...metroZones, ...compass].map((z) => ({ ...z, id: zoneId(st, z.name) }))
}

// A path's bounds ([[x0, y0], [x1, y1]]) -> whole pixels [x0, y0, x1, y1]. The client
// zooms to this box (SPEC §9.3), so a decimal would only add bytes.
export const roundBox = (bounds) => bounds.flat().map((v) => Math.round(v))
