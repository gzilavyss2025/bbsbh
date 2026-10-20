// The player cache behind "Where they're from" (#1526, SPEC §6.4): every MLB player ever
// listed, with the few fields the pages need. The statsapi calls take `getJson` as an
// argument, so the rules here run in tests without a network.
//
// Two reads make one player. /sports/1/players?season=Y lists a season's ids but ignores
// hydrate=education. /people?personIds=...&hydrate=education takes up to 200 ids and returns
// the schools, the birthplace and the debut date.
export const FIRST_SEASON = 1876
export const BATCH = 200
export const RECHECK_DAYS = 30
const FIELDS =
  'people,id,fullName,mlbDebutDate,primaryPosition,abbreviation,birthCity,birthStateProvince,birthCountry,education,highschools,colleges,name,city,state'

const clean = (v) => (typeof v === 'string' ? v.trim() : '')

// An API person -> the cache row. Empty fields are left out, so the file stays small and
// the bytes move only when a player does. `prev` is the old row on a re-check: firstSeason
// is the first season the player was listed, and a re-check must not lose it.
export function slimPerson(p, firstSeason, prev = null) {
  const row = { name: clean(p.fullName), firstSeason: prev?.firstSeason ?? firstSeason }
  const debut = Number(String(p.mlbDebutDate ?? '').slice(0, 4))
  if (debut >= FIRST_SEASON) row.debut = debut
  const pos = clean(p.primaryPosition?.abbreviation)
  if (pos) row.pos = pos
  const birth = {}
  for (const [key, from] of [['city', 'birthCity'], ['state', 'birthStateProvince'], ['country', 'birthCountry']]) {
    if (clean(p[from])) birth[key] = clean(p[from])
  }
  if (Object.keys(birth).length) row.birth = birth
  const hs = (p.education?.highschools ?? [])
    .map((h) => ({ name: clean(h.name), city: clean(h.city), state: clean(h.state) }))
    .filter((h) => h.name)
    .map((h) => Object.fromEntries(Object.entries(h).filter(([, v]) => v)))
  if (hs.length) row.hs = hs
  const col = (p.education?.colleges ?? []).map((c) => clean(c.name)).filter(Boolean)
  if (col.length) row.col = col
  return Object.fromEntries(Object.entries(row).sort(([a], [b]) => (a < b ? -1 : 1)))
}

// Ids are numbers in the cache's keys (strings once they are object keys), so sort numerically.
export const sortedIds = (players) => Object.keys(players).sort((a, b) => Number(a) - Number(b))

// The next slice of the rolling re-check: ceil(N / 30) ids from `cursor`, wrapping round.
// Every player is looked at once in 30 nights. -> { ids, cursor } (the next cursor).
export function recheckSlice(ids, cursor, days = RECHECK_DAYS) {
  const n = ids.length
  if (!n) return { ids: [], cursor: 0 }
  const take = Math.min(n, Math.ceil(n / days))
  const start = ((Number(cursor) || 0) % n + n) % n
  return { ids: Array.from({ length: take }, (_, i) => ids[(start + i) % n]), cursor: (start + take) % n }
}

export async function fetchSeasonIds(getJson, season) {
  const data = await getJson(`/api/v1/sports/1/players?season=${season}&fields=people,id`)
  return (data?.people ?? []).map((p) => String(p.id))
}

// -> the API people for `ids`, 200 to a request. A batch that fails stops the run: a hole
// in the cache would quietly drop a school from the pages.
export async function fetchPeople(getJson, ids, mapConcurrent) {
  const batches = []
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH))
  const got = await mapConcurrent(
    batches,
    4,
    async (batch) => (await getJson(`/api/v1/people?personIds=${batch.join(',')}&hydrate=education&fields=${FIELDS}`)).people ?? [],
    { strict: true },
  )
  return { people: got.flat(), requests: batches.length }
}
