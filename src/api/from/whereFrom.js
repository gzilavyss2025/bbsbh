// SPOILER FOOTING: spoiler-FREE.
// Readers for "Where they're from" (#1526): schools, birthplaces and map shapes, from the static
// public/data/from/ files that gen-where-from.mjs (nightly) and gen-where-from-map.mjs (hand-run)
// write. Where a man went to school, or was born, says nothing about a game. Open surface
// (ADR-0034); no SealBox. Shapes: docs/api/static-data.md.
import { staticJson, staticJsonBy } from '../staticJson.js'

const BASE = '/data/from'

// counts, zoneCounts, countries, unplaced, generatedAt — small, loaded at once.
export const fetchFromIndex = staticJson(`${BASE}/index.json`, { fallback: null })

// The national outline: { viewBox, states: { GA: { d, b } } }.
export const fetchFromMap = staticJson(`${BASE}/map/us.json`, { fallback: null })

// One state's zones: { zones: [{ id, name, kind, d }] }.
const stateMaps = staticJsonBy((st) => `${BASE}/map/${st}.json`, { fallback: null })
export const fetchFromStateMap = (st) => stateMaps(String(st).toUpperCase())

// Every place of one list, for search and the A to Z list: kind is 'college', 'high-school'
// or 'hometown'. Rows are arrays (see src/lib/from/list.js lookupRows).
export const fetchFromLookup = staticJsonBy((kind) => `${BASE}/lookup/${kind}.json`, { fallback: [] })

// One state's places: { places: [{ slug, name, city?, state?, zone?, pt?, players }] }. A state of
// '_unplaced' is the colleges and schools with no state on the map.
const placeShards = staticJsonBy((key) => `${BASE}/${key}.json`, { fallback: null })
export const fetchFromPlaces = (kind, st) => placeShards(`${kind}/${st}`)

// One country: { name, places: [{ slug, name, players }] }.
export const fetchFromCountry = staticJsonBy((slug) => `${BASE}/country/${slug}.json`, { fallback: null })

// One place for a place page, found from the address's own parts (src/lib/from/route.js):
// { kind: 'college' | 'high-school', slug }, { kind: 'hometown', state, city } or
// { kind: 'abroad', country, city }. -> { place, state, countryName } or null when no place is
// listed there. A school looks its state up in the lookup file first: its slug does not hold one.
export async function fetchFromPlace(route) {
  const find = (places, slug) => places?.find((p) => p.slug === slug) ?? null
  if (route.kind === 'abroad') {
    const country = await fetchFromCountry(route.country)
    const place = find(country?.places, route.city)
    return place ? { place, state: null, countryName: country.name } : null
  }
  if (route.kind === 'hometown') {
    const place = find((await fetchFromPlaces('hometown', route.state))?.places, route.city)
    return place ? { place, state: route.state, countryName: null } : null
  }
  const row = (await fetchFromLookup(route.kind)).find((r) => r[0] === route.slug)
  if (!row) return null
  const place = find((await fetchFromPlaces(route.kind, row[2] ?? '_unplaced'))?.places, route.slug)
  return place ? { place, state: row[2] ?? null, countryName: null } : null
}
