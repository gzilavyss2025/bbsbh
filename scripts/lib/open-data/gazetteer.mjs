// The pure half of the birthplace locator (ADR-0106): GeoNames' cities500.txt,
// admin1CodesASCII.txt and countryInfo.txt, as one lookup from a Retrosheet birth
// city, state and country to a map point. gen-bio-history.mjs reads the files and
// passes their text here. Nothing downloads.
//
// THE MATCH: city name + region. The region is the full state name for a US birth
// (GeoNames' admin1 name) and the country for any other (GeoNames' country code).
// Names compare after placeName(): no accents, no case, no punctuation, and 'St.',
// 'Ste.', 'Ft.' and 'Mt.' spelled out. So 'St. Louis' finds 'Saint Louis' and
// 'Montréal' finds 'Montreal'.
//
// TWO PASSES. A city's own name (GeoNames `name` or `asciiname`) wins over an
// alternate name: the alternate-name list carries old and foreign names, and one of
// them can be the name of a different, smaller town. In each pass the place with the
// most people wins, so 'Springfield, Illinois' is the state capital. An alternate name
// counts only when exactly one town in the region holds it: a missing dot beats a wrong one.

export const placeName = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\bst\s/g, 'saint ')
    .replace(/\bste\s/g, 'sainte ')
    .replace(/\bft\s/g, 'fort ')
    .replace(/\bmt\s/g, 'mount ')

// Retrosheet names GeoNames does not use. A country that no longer exists maps to
// the country that holds the city now; one that maps to no single country stays out.
const COUNTRY_ALIAS = {
  england: 'GB',
  scotland: 'GB',
  wales: 'GB',
  'northern ireland': 'GB',
  'west germany': 'DE',
  'virgin islands': 'VI',
  'canal zone': 'PA',
}
// Retrosheet writes 'D.C.'; GeoNames writes 'District of Columbia'.
const STATE_ALIAS = { 'd c': 'district of columbia' }

const rowsOf = (text) =>
  String(text)
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('\t'))

// -> lookup(city, state, country) -> { lat, lon } | null
export function buildGazetteer({ cities, admin1, countries }) {
  const stateName = new Map(rowsOf(admin1).map(([code, name]) => [code, placeName(name)]))
  const countryCode = new Map(rowsOf(countries).map((f) => [placeName(f[4]), f[0]]))
  for (const [name, code] of Object.entries(COUNTRY_ALIAS)) countryCode.set(name, code)

  const own = new Map()
  const alt = new Map()
  const AMBIGUOUS = null
  const keep = (index, key, place) => {
    const prev = index.get(key)
    if (!prev || place.pop > prev.pop) index.set(key, place)
  }
  const keepAlt = (key, place) => alt.set(key, alt.has(key) ? AMBIGUOUS : place)
  for (const f of rowsOf(cities)) {
    const country = f[8]
    const region = country === 'US' ? stateName.get(`US.${f[10]}`) : country
    if (!region) continue
    // Two decimals is about a kilometre; nothing here needs finer.
    const place = { lat: Math.round(+f[4] * 100) / 100, lon: Math.round(+f[5] * 100) / 100, pop: +f[14] || 0 }
    const names = new Set([f[1], f[2]].map(placeName))
    for (const n of names) keep(own, `${n}|${region}`, place)
    const altNames = new Set((f[3] ?? '').split(',').filter(Boolean).map(placeName))
    for (const n of altNames) if (!names.has(n)) keepAlt(`${n}|${region}`, place)
  }

  return (city, state, country) => {
    const usa = country === 'USA'
    const region = usa ? (STATE_ALIAS[placeName(state)] ?? placeName(state)) : countryCode.get(placeName(country))
    if (!city || !region) return null
    const key = `${placeName(city)}|${region}`
    const hit = own.get(key) ?? alt.get(key) // null (ambiguous) falls through to no place
    return hit ? { lat: hit.lat, lon: hit.lon } : null
  }
}
