// The "Where they're from" address builders, the counterpart of from/route.js (#1526, SPEC §4).
// Only a non-default query value is written, like postseasonRecordsPath, so a link that did not
// ask for something does not carry it.

// The picker: `list` (college is the default), `state` ('GA') and, with a state, `zone`.
export function fromPath({ list, state, zone } = {}) {
  const q = new URLSearchParams()
  if (state && zone) q.set('zone', zone)
  if (list && list !== 'college') q.set('list', list)
  const qs = q.toString() ? `?${q}` : ''
  return `${state ? `/from/${state.toLowerCase()}` : '/from'}${qs}`
}

// One place. The shapes are the route's: { kind: 'college' | 'high-school', slug },
// { kind: 'hometown', state, slug | city } and { kind: 'abroad', country, slug | city }.
export function fromPlacePath(place) {
  const slug = place.slug ?? place.city
  if (place.kind === 'hometown') return `/from/${place.state.toLowerCase()}/${slug}`
  if (place.kind === 'abroad') return `/from/country/${place.country}/${slug}`
  return `/from/${place.kind}/${slug}`
}

export const fromCountryPath = (slug) => `/from/country/${slug}`

// A pick rewrites the address with fromPath, which knows only `list` and `zone`. Every other query
// parameter the page was opened with (?nointro, a campaign tag) and the hash ride along unchanged.
export function withKeptParams(path, search = '', hash = '') {
  const [base, qs = ''] = path.split('?')
  const q = new URLSearchParams(qs)
  for (const [k, v] of new URLSearchParams(search)) if (k !== 'list' && k !== 'zone' && !q.has(k)) q.append(k, v)
  const out = q.toString()
  return `${base}${out ? `?${out}` : ''}${hash}`
}
