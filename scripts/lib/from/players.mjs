// The player cache behind "Where they're from" (#1526, SPEC §6.4): every MLB player ever
// listed, with the few fields the pages need. The statsapi calls take `getJson` as an
// argument, so the rules here run in tests without a network.
//
// Two reads make one player. /sports/1/players?season=Y lists a season's ids but ignores
// hydrate=education. /people?personIds=...&hydrate=education takes up to 200 ids and returns
// the schools, the birthplace and the debut date.
export const FIRST_SEASON = 1876
// The National Association ran 1871-75 and MLB counts it, so a debut date can be older than the first
// season list (1876). Nothing before 1800 is a real date.
const MIN_DEBUT = 1800
// A player with no mlbDebutDate is a big leaguer only if he is old: every undated player in the data
// has a first season of 1947 or earlier (Negro Leagues, the 19th century). A recent one with no date
// is on a 40-man roster and has not debuted, so he is held back until the date appears.
export const UNDATED_UNTIL = 1960
export const isPending = (row) => !row.debut && row.firstSeason > UNDATED_UNTIL
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
  if (debut >= MIN_DEBUT) row.debut = debut
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
  // A response that comes back thinner than the row it replaces (an unhydrated record) must not erase
  // what is known: a debut date never goes away, and a record with no education key at all is
  // unhydrated, not a man who never went to school.
  if (prev) {
    if (prev.debut && !row.debut) row.debut = prev.debut
    if (prev.birth && !row.birth) row.birth = prev.birth
    if (p.education === undefined) {
      if (prev.hs) row.hs = prev.hs
      if (prev.col) row.col = prev.col
    }
  }
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
