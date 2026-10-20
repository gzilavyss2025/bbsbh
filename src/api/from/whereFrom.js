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
