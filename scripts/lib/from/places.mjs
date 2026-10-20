// The cache of players -> every public file of "Where they're from" (#1526, SPEC §6.3,
// §6.5, §6.6). Pure: the generator hands in the cache and a few lookups and writes what comes
// back. A place is one school or one town, and holds its big leaguers as
// [id, name, pos, debutYear] tuples, oldest debut first.
import { slugify } from '../../../src/lib/route.js'
import { countryOf, schoolBase, schoolSlug } from '../../../src/lib/from/identity.js'
import { isPending } from './players.mjs'
import { STATE_NAMES } from './zones.mjs'

const isState = (st) => Object.hasOwn(STATE_NAMES, st)
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

// The commonest spelling; a tie goes to the first in alphabetical order, so a rerun agrees.
function mode(counts) {
  let best = null
  for (const [value, n] of [...counts].sort(([a], [b]) => cmp(a, b))) if (!best || n > best[1]) best = [value, n]
  return best ? best[0] : null
}
const tally = (map, key) => map.set(key, (map.get(key) ?? 0) + 1)
const sortedObject = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]))

const debutYear = (p) => p.debut ?? p.firstSeason
const tupleOf = (id, p) => [Number(id), p.name, p.pos ?? '', debutYear(p)]
const byDebut = (a, b) => a[3] - b[3] || cmp(a[1], b[1]) || a[0] - b[0]

// A zone id starts with its state (`ga-atlanta`). A birth coordinate that lands in another state's
// county is a wrong GeoNames match (a Dublin, Ohio placed in Indianapolis), so it is ignored for
// both the zone and the map dot: a place with no good point has no zone and no dot.
const inState = (zone, state) => Boolean(zone) && zone.startsWith(`${state.toLowerCase()}-`)

// ctx: {
//   matchCollege(name) -> { unitid | null, rule, candidates? },
//   schoolOf(unitid)   -> IPEDS school | null,
//   countyZone         { county FIPS: zone id },
//   pointCounty        { "lat,lon": county FIPS },
//   birthPoint(id)     -> "lat,lon" | null  (a player's birth coordinate),
//   project(lat, lon)  -> [x, y] | null,
// }
// -> { files: { 'college/GA.json': body, ... }, index, report }. `index` has no clock: the
// generator stamps generatedAt, so a rerun on the same cache differs in that one field.
export function buildFrom(players, ctx) {
  // A recent player with no debut date has not reached the majors (SPEC §14, and see players.mjs).
  const ids = Object.keys(players).filter((id) => !isPending(players[id]))
  const place = (key) => ctx.project(...key.split(',').map(Number))

  // --- US birth towns: a county and a map point for each, found from the players' coordinates.
  // The high-school zones borrow these (SPEC §7.3): a school's town is placed where a player
  // was born in the same town.
  const townCounty = new Map()
  const townPoint = new Map()
  for (const id of ids) {
    const b = players[id].birth
    const st = b?.state?.toUpperCase()
    if (countryOf(b) !== 'USA' || !isState(st) || !slugify(b.city)) continue
    const point = ctx.birthPoint(id)
    const county = point && ctx.pointCounty[point]
    if (!county || !inState(ctx.countyZone[county], st)) continue
    const town = `${st}|${slugify(b.city)}`
    tally(townPoint.has(town) ? townPoint.get(town) : townPoint.set(town, new Map()).get(town), point)
    tally(townCounty.has(town) ? townCounty.get(town) : townCounty.set(town, new Map()).get(town), county)
  }
  const zoneOfTown = (town) => {
    const county = townCounty.has(town) ? mode(townCounty.get(town)) : null
    return county ? ctx.countyZone[county] : undefined
  }
  const pointOfTown = (town) => (townPoint.has(town) ? place(mode(townPoint.get(town))) : null)

  const files = {}
  const report = { players: ids.length, pending: Object.keys(players).length - ids.length }
  const compact = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null))
  const finish = (slug, name, extra, tuples) =>
    compact({ slug, name, ...extra, players: tuples.sort(byDebut) })

  // --- Colleges -----------------------------------------------------------------------------
  const colleges = new Map() // slug -> { names: Map, players: [] }
  for (const id of ids) {
    const seen = new Set()
    for (const name of players[id].col ?? []) {
      const slug = slugify(name)
      if (!slug || seen.has(slug)) continue
      seen.add(slug)
      if (!colleges.has(slug)) colleges.set(slug, { names: new Map(), players: [] })
      tally(colleges.get(slug).names, name)
      colleges.get(slug).players.push(tupleOf(id, players[id]))
    }
  }
  const collegePlaces = []
  const unmatched = []
  let collegeRecords = 0
  let collegeMatched = 0
  for (const [slug, c] of colleges) {
    const name = mode(c.names)
    const m = ctx.matchCollege(name)
    const school = m.unitid ? ctx.schoolOf(m.unitid) : null
    collegeRecords += c.players.length
    if (school) collegeMatched += c.players.length
    else unmatched.push({ name, players: c.players.length, rule: m.rule, candidates: m.candidates ?? [] })
    const state = school && isState(school.state) ? school.state : null
    collegePlaces.push({
      state,
      place: finish(slug, name, {
        city: school?.city || undefined,
        state: state ?? undefined,
        zone: state && school.county && inState(ctx.countyZone[school.county], state) ? ctx.countyZone[school.county] : undefined,
        pt: state && school.lat != null && school.lon != null ? ctx.project(school.lat, school.lon) : undefined,
      }, c.players),
    })
  }

  // --- High schools -------------------------------------------------------------------------
  const records = [] // { name, city, st, id }
  let hsRecords = 0
  let hsSkipped = 0
  for (const id of ids) {
    for (const h of players[id].hs ?? []) {
      hsRecords++
      const st = (h.state ?? '').toUpperCase()
      if (!st && !h.city) {
        hsSkipped++ // no state and no city: the name alone would merge unrelated schools
        continue
      }
      records.push({ name: h.name, city: h.city ?? '', st, id })
    }
  }
  const cityKeys = new Map() // base slug -> distinct city slugs
  for (const r of records) {
    r.base = schoolBase(r.name, r.st)
    if (r.city) (cityKeys.get(r.base) ?? cityKeys.set(r.base, new Set()).get(r.base)).add(slugify(r.city))
  }
  const schools = new Map() // final slug -> { names, cities, states, ids }
  for (const r of records) {
    const slug = schoolSlug({ name: r.name, city: r.city, state: r.st }, cityKeys.get(r.base)?.size > 1)
    if (!slug) continue
    if (!schools.has(slug)) schools.set(slug, { names: new Map(), cities: new Map(), st: r.st, players: new Map() })
    const s = schools.get(slug)
    tally(s.names, r.name)
    if (r.city) tally(s.cities, r.city)
    s.players.set(r.id, tupleOf(r.id, players[r.id]))
  }
  const hsPlaces = []
  for (const [slug, s] of schools) {
    const city = mode(s.cities)
    const state = isState(s.st) ? s.st : null
    const town = state && city ? `${state}|${slugify(city)}` : null
    hsPlaces.push({
      state,
      place: finish(slug, mode(s.names), {
        city: city ?? undefined,
        state: state ?? undefined,
        zone: town ? zoneOfTown(town) : undefined,
        pt: town ? pointOfTown(town) : undefined,
      }, [...s.players.values()]),
    })
  }
  report.hsRecords = hsRecords
  report.hsSkipped = hsSkipped

  // --- Hometowns (US) and countries ---------------------------------------------------------
  const towns = new Map() // 'ST|city-slug' -> { st, slug, names, players, ids }
  const countries = new Map() // country slug -> { names: Map, towns: Map(slug -> { names, players }) }
  let hometownUnplaced = 0
  for (const id of ids) {
    const p = players[id]
    const country = countryOf(p.birth)
    const city = p.birth?.city
    const citySlug = slugify(city)
    if (!country || !citySlug) continue
    if (country === 'USA') {
      const st = p.birth.state?.toUpperCase()
      if (!isState(st)) {
        hometownUnplaced++
        continue
      }
      const key = `${st}|${citySlug}`
      if (!towns.has(key)) towns.set(key, { st, slug: citySlug, names: new Map(), players: [], ids: [] })
      const t = towns.get(key)
      tally(t.names, city)
      t.players.push(tupleOf(id, p))
      t.ids.push(id)
    } else {
      const cs = slugify(country)
      if (!cs) continue
      if (!countries.has(cs)) countries.set(cs, { names: new Map(), towns: new Map() })
      const c = countries.get(cs)
      tally(c.names, country)
      if (!c.towns.has(citySlug)) c.towns.set(citySlug, { names: new Map(), players: [] })
      tally(c.towns.get(citySlug).names, city)
      c.towns.get(citySlug).players.push(tupleOf(id, p))
    }
  }
  const hometownPlaces = []
  for (const t of towns.values()) {
    const zones = new Map()
    const points = new Map()
    for (const id of t.ids) {
      const point = ctx.birthPoint(id)
      const county = point && ctx.pointCounty[point]
      if (!county || !inState(ctx.countyZone[county], t.st)) continue
      tally(points, point)
      tally(zones, ctx.countyZone[county])
    }
    hometownPlaces.push({
      state: t.st,
      place: finish(t.slug, mode(t.names), {
        state: t.st,
        zone: mode(zones) ?? undefined,
        pt: points.size ? place(mode(points)) : undefined,
      }, t.players),
    })
  }

  // --- Files --------------------------------------------------------------------------------
  const counts = { college: {}, 'high-school': {}, hometown: {} }
  const zoneCounts = { college: {}, 'high-school': {}, hometown: {} }
  const lookup = { college: [], 'high-school': [], hometown: [] }
  for (const [kind, list] of [['college', collegePlaces], ['high-school', hsPlaces], ['hometown', hometownPlaces]]) {
    const byState = new Map()
    for (const { state, place: pl } of list) {
      const bucket = state ?? '_unplaced'
      if (!byState.has(bucket)) byState.set(bucket, [])
      byState.get(bucket).push(pl)
      if (state) counts[kind][state] = (counts[kind][state] ?? 0) + 1
      if (pl.zone) zoneCounts[kind][pl.zone] = (zoneCounts[kind][pl.zone] ?? 0) + 1
      if (kind === 'hometown') lookup.hometown.push([state, pl.slug, pl.name])
      // The city (when known) is a 4th item, so a search can tell "Lincoln, Springfield, IL" from "Lincoln, Chicago, IL".
      else lookup[kind].push(pl.city ? [pl.slug, pl.name, state, pl.city] : [pl.slug, pl.name, state])
    }
    for (const [bucket, places] of byState) files[`${kind}/${bucket}.json`] = { places: places.sort((a, b) => cmp(a.slug, b.slug)) }
    counts[kind] = sortedObject(counts[kind])
    zoneCounts[kind] = sortedObject(zoneCounts[kind])
  }
  lookup.college.sort((a, b) => cmp(a[0], b[0]))
  lookup['high-school'].sort((a, b) => cmp(a[0], b[0]))
  lookup.hometown.sort((a, b) => cmp(a[0], b[0]) || cmp(a[1], b[1]))
  for (const [kind, rows] of Object.entries(lookup)) files[`lookup/${kind}.json`] = rows
  // The school names (with a state) shared by two cities. A player page links a high school with
  // this: schoolSlug() needs to know whether the short slug or the city slug is the school's.
  files['lookup/high-school-split.json'] = [
    ...new Set(records.filter((r) => r.st && r.city && cityKeys.get(r.base).size > 1).map((r) => r.base)),
  ].sort()

  const countryRows = []
  for (const [cs, c] of countries) {
    const name = mode(c.names)
    const places = [...c.towns].map(([slug, t]) => finish(slug, mode(t.names), {}, t.players)).sort((a, b) => cmp(a.slug, b.slug))
    files[`country/${cs}.json`] = { name, places }
    countryRows.push([cs, name, places.reduce((n, pl) => n + pl.players.length, 0)])
  }
  countryRows.sort((a, b) => b[2] - a[2] || cmp(a[1], b[1]))

  const index = {
    counts,
    zoneCounts,
    countries: countryRows,
    unplaced: { college: collegePlaces.filter((c) => !c.state).length },
  }
  Object.assign(report, {
    collegeRecords,
    collegeMatched,
    unmatched: unmatched.sort((a, b) => b.players - a.players || cmp(a.name, b.name)),
    hometownUnplaced,
    places: { college: collegePlaces.length, 'high-school': hsPlaces.length, hometown: hometownPlaces.length, countries: countryRows.length },
  })
  return { files, index, report }
}
