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

// One state's zones, by its upper-case code: { zones: [{ id, name, kind, d }] }.
export const fetchFromStateMap = staticJsonBy((st) => `${BASE}/map/${st}.json`, { fallback: null })

// Every place of one list, for search and the A to Z list: kind is 'college', 'high-school'
// or 'hometown'. Rows are arrays (see src/lib/from/list.js lookupRows).
export const fetchFromLookup = staticJsonBy((kind) => `${BASE}/lookup/${kind}.json`, { fallback: [] })

// One state's places: { places: [{ slug, name, city?, state?, zone?, pt?, players }] }. A state of
// '_unplaced' is the colleges and schools with no state on the map.
const placeShards = staticJsonBy((key) => `${BASE}/${key}.json`, { fallback: null })
export const fetchFromPlaces = (kind, st) => placeShards(`${kind}/${st}`)

// A missing file answers with the reader's fallback, and so does a dropped connection, so a
// caller cannot tell "no such place" from "could not load". A place the data lists must exist, and
// an offline device is not a missing place: those two throw, so a page can say it could not load.
// staticJson will not ask for an unanswered URL again for 30 seconds (NO_ANSWER_MS), so for that
// long after one failure a reader's fallback may still be a failure, even back online. A full reload
// clears it, and that is what the page tells the reader to do.
const NO_ANSWER_MS = 30_000
let failedAt = -Infinity
const unreachableNow = () => globalThis.navigator?.onLine === false || Date.now() - failedAt < NO_ANSWER_MS
const unreachable = () => {
  failedAt = Date.now()
  return new Error('Could not load Where they’re from data')
}

// One country: { name, places: [{ slug, name, players }] }, or null when there is none.
const countryFiles = staticJsonBy((slug) => `${BASE}/country/${slug}.json`, { fallback: null })
export async function fetchFromCountry(slug) {
  const country = await countryFiles(slug)
  if (!country && unreachableNow()) throw unreachable()
  return country
}

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
    const shard = await fetchFromPlaces('hometown', route.state)
    if (!shard && unreachableNow()) throw unreachable()
    const place = find(shard?.places, route.city)
    return place ? { place, state: route.state, countryName: null } : null
  }
  const lookup = await fetchFromLookup(route.kind)
  if (!lookup.length) throw unreachable() // a lookup is never empty, so [] is the fallback
  const row = lookup.find((r) => r[0] === route.slug)
  if (!row) return null
  const shard = await fetchFromPlaces(route.kind, row[2] ?? '_unplaced')
  if (!shard) throw unreachable() // the lookup lists this school, so its shard must exist
  const place = find(shard.places, route.slug)
  return place ? { place, state: row[2] ?? null, countryName: null } : null
}
