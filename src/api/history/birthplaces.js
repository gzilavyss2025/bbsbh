import { staticJsonBy } from '../staticJson.js'

// The BIRTHPLACE INDEX: players grouped by the map point of their birth city, from
// Retrosheet's biographical files, placed on the map with GeoNames. Reads
// public/data/birthplaces/{cell}.json, built BY HAND by scripts/gen-bio-history.mjs
// (ADR-0100, ADR-0106). The app never fetches Retrosheet or GeoNames.
//
// SPOILER FOOTING: spoiler-FREE. Where a man was born says nothing about a game
// (ADR-0034); an open surface may show it with no SealBox.
//
// "NEAR" IS MAP DISTANCE: a birth city within NEAR_MILES of a point, straight line.
// A park in a suburb finds the city next door, and a name spelled two ways
// ('St. Louis', 'Saint Louis') no longer matters, because the reader never compares
// names. A birth city GeoNames could not place is in no shard.
//
// THE SHARD is one CELL_DEGREES square of latitude and longitude, named by its
// south-west corner: '40_-74' holds 40..42 N, 74..72 W.
// { credit: [line, ...], places: [{ lat, lon, people: [{ personId, name, year }] }] }.
// `year` is the birth year, or null when the file has no birthdate.
export const NEAR_MILES = 50
export const CELL_DEGREES = 2

const corner = (deg) => Math.floor(deg / CELL_DEGREES) * CELL_DEGREES
export const birthplaceCell = (lat, lon) => `${corner(lat)}_${corner(lon)}`

const MILES_PER_DEGREE = 69.09
const rad = (deg) => (deg * Math.PI) / 180

// Great-circle miles between two { lat, lon } points.
export function milesBetween(a, b) {
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2
  return 2 * 3958.8 * Math.asin(Math.sqrt(h))
}

// Every cell a circle of `miles` around the point can touch: 1 to 4 at 50 miles.
export function cellsNear(lat, lon, miles = NEAR_MILES) {
  const dLat = miles / MILES_PER_DEGREE
  const dLon = miles / (MILES_PER_DEGREE * Math.max(Math.cos(rad(lat)), 0.01))
  const cells = []
  for (let a = corner(lat - dLat); a <= corner(lat + dLat); a += CELL_DEGREES) {
    for (let o = corner(lon - dLon); o <= corner(lon + dLon); o += CELL_DEGREES) cells.push(`${a}_${o}`)
  }
  return cells
}

export const fetchBirthplaceCell = staticJsonBy((cell) => `/data/birthplaces/${cell}.json`, { fallback: null })

// Players born within `miles` of { lat, lon } -> { people, credit }. A missing
// point, or no one near it, gives { people: [], credit: [] }.
export async function bornNear(point, miles = NEAR_MILES) {
  const none = { people: [], credit: [] }
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lon)) return none
  const shards = (await Promise.all(cellsNear(point.lat, point.lon, miles).map(fetchBirthplaceCell))).filter(Boolean)
  const people = shards.flatMap((s) => (s.places ?? []).filter((p) => milesBetween(point, p) <= miles).flatMap((p) => p.people))
  return people.length ? { people, credit: shards[0].credit ?? [] } : none
}
