import { slugify } from '../route.js'

// The picker's list: search, a state's places and the A to Z list (#1526, SPEC §3, §6.6).

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// The lookup files keep a row as an array to stay small. College and high school:
// [slug, name, state | null, city?]. Hometown: [state, citySlug, name].
// -> [{ slug, name, state, city? }].
export function lookupRows(list, rows) {
  if (!Array.isArray(rows)) return []
  return rows.map((r) => (list === 'hometown' ? { slug: r[1], name: r[2], state: r[0] } : { slug: r[0], name: r[1], state: r[2], city: r[3] }))
}

// The rows whose name holds the query, ignoring case, accents and punctuation ("st louis"
// finds "St. Louis"). Names that START with it come first; each group keeps A to Z order.
export function searchRows(rows, query) {
  const q = slugify(query)
  if (!q) return []
  const starts = []
  const holds = []
  for (const row of rows) {
    const name = slugify(row.name)
    if (name.startsWith(q)) starts.push(row)
    else if (name.includes(q)) holds.push(row)
  }
  return [...starts, ...holds]
}

// A state's places, biggest first (the most big leaguers), then A to Z.
export const sortPlaces = (places) =>
  [...places].sort((a, b) => b.players.length - a.players.length || cmp(a.name, b.name))

// A zone narrows a state's places; no zone is the whole state.
export const placesIn = (places, zone) => (zone ? places.filter((p) => p.zone === zone) : places)

// The address of a list row or a shard place, in the shape fromPlacePath takes.
export const rowPlace = (list, row) =>
  list === 'hometown' ? { kind: 'hometown', state: row.state, slug: row.slug } : { kind: list, slug: row.slug }

// "Nashville, TN" under a name; either half may be missing.
export const placeLine = (p) => [p.city, p.state].filter(Boolean).join(', ')
