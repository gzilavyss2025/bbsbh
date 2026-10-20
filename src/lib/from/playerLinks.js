import { slugify } from '../route.js'
import { countryOf, schoolBase, schoolSlug } from './identity.js'
import { fromPlacePath } from './path.js'
import { isStateCode } from './states.js'

// A player's birthplace and schools as addresses on the Where they're from pages (#1526), so the
// player page can lead to "who else is from there". Pure: the slugs come from identity.js, the same
// code the generator names the places with.
//
//   birth    { city, state, country } as the API sends them.
//   schools  [{ kind: 'high-school' | 'college', name, city, state }].
//   split    the high-school names shared by two cities (public/data/from/lookup/high-school-split.json)
//            as a Set, or null when it has not loaded. A high school with a state needs it.
// -> { born: path | null, schools: [{ ...school, path | null }] }. A place with nothing to point at
// (no city, an unknown state) has no path and the caller draws plain text.
export function playerFromLinks({ birth, schools }, split = null) {
  return { born: bornPath(birth), schools: schools.map((s) => ({ ...s, path: schoolPath(s, split) })) }
}

function bornPath(birth) {
  const country = countryOf(birth)
  const city = slugify(birth?.city)
  if (!country || !city) return null
  if (country === 'USA') {
    const state = String(birth.state ?? '').toUpperCase()
    return isStateCode(state) ? fromPlacePath({ kind: 'hometown', state, slug: city }) : null
  }
  const slug = slugify(country)
  return slug ? fromPlacePath({ kind: 'abroad', country: slug, slug: city }) : null
}

function schoolPath({ kind, name, city, state }, split) {
  if (!slugify(name)) return null
  if (kind === 'college') return fromPlacePath({ kind: 'college', slug: slugify(name) })
  if (!state && !city) return null // a school with neither is no place
  if (state && !split) return null // not known yet whether the short slug is his school's
  const shared = Boolean(state) && split.has(schoolBase(name, state))
  return fromPlacePath({ kind: 'high-school', slug: schoolSlug({ name, city, state }, shared) })
}
