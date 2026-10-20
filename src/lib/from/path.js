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
