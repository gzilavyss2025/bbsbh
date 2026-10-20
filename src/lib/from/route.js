import { isStateCode } from './states.js'

// The "Where they're from" addresses (#1526, SPEC §4). Imports nothing from route.js on
// purpose: route.js imports THIS file (it has about 20 lines left under its cap), so it is the
// same no-cycle shape as scout/route.js.
//
//   '/from', '/from?list=hometown'         -> { name: 'from', list, state: null, zone: null }
//   '/from/{st}[?zone=ga-atlanta&list=…]'  -> { name: 'from', list, state: 'GA', zone }
//   '/from/college/{slug}'                 -> { name: 'from-place', kind: 'college', slug }
//   '/from/high-school/{slug}'             -> { name: 'from-place', kind: 'high-school', slug }
//   '/from/{st}/{city}'                    -> { name: 'from-place', kind: 'hometown', state, city }
//   '/from/country/{country}'              -> { name: 'from-country', country }
//   '/from/country/{country}/{city}'       -> { name: 'from-place', kind: 'abroad', country, city }
//
// `college`, `high-school` and `country` are words and a state is two letters, so they never
// clash. `?list=` and `?zone=` set the picker's OPENING state only, like /standings; the page
// writes its picks back with replace so a shared link opens the same view. A value the page
// does not know falls back to its default, never an error. Everything under /from is a from
// route, so no path here can fall through to the game branch.
export const FROM_LISTS = ['college', 'high-school', 'hometown']

const lower = (s) => String(s ?? '').toLowerCase()

export function parseFromRoute(parts, q) {
  if (parts[0] !== 'from') return null
  const list = FROM_LISTS.includes(q.get('list')) ? q.get('list') : 'college'
  const bare = { name: 'from', list, state: null, zone: null }
  const [, a, b, c] = parts.map(lower)
  if (parts.length === 1 || !a) return bare

  if (parts.length === 2 && isStateCode(a.toUpperCase())) {
    const state = a.toUpperCase()
    // A zone id is `{st}-{slug}`; the page checks it against the state's own zones.
    const zone = /^[a-z]{2}-[a-z0-9-]+$/.test(lower(q.get('zone'))) && lower(q.get('zone')).startsWith(`${a}-`)
      ? lower(q.get('zone'))
      : null
    return { ...bare, state, zone }
  }
  if (parts.length === 3 && (a === 'college' || a === 'high-school') && b) {
    return { name: 'from-place', kind: a, slug: b }
  }
  if (parts.length === 3 && a === 'country' && b) return { name: 'from-country', country: b }
  if (parts.length === 4 && a === 'country' && b && c) {
    return { name: 'from-place', kind: 'abroad', country: b, city: c }
  }
  if (parts.length === 3 && isStateCode(a.toUpperCase()) && b) {
    return { name: 'from-place', kind: 'hometown', state: a.toUpperCase(), city: b }
  }
  return bare
}

// The whole address of a place route, as one string: App.jsx keys the page on it so a new place
// remounts with fresh state, and the page uses it for its once-per-visit motion.
export const placeKey = (route) => [route.kind, route.slug, route.state, route.city, route.country].filter(Boolean).join('/')
