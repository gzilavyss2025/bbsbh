import { slugify } from '../route.js'

// Which place a person belongs to, as an address (#1526). ONE copy for the nightly generator
// (scripts/lib/from/places.mjs writes the places) and the player page (src/lib/from/playerLinks.js
// links to them), so the two cannot disagree about a slug.

// A country the API writes as a code, when the code is certain. Puerto Rico also comes back as
// birthCountry "USA" with state "PR"; countryOf() folds that in.
const COUNTRY_CODE = { MEX: 'Mexico', CUB: 'Cuba', PUR: 'Puerto Rico', VEN: 'Venezuela', DOM: 'Dominican Republic' }

// -> 'USA' | another country's name | null. A US birth in Puerto Rico is Puerto Rico (SPEC D6).
export function countryOf(birth) {
  if (!birth?.country) return null
  const country = COUNTRY_CODE[birth.country] ?? birth.country
  if (country === 'USA' && birth.state?.toUpperCase() === 'PR') return 'Puerto Rico'
  return country
}

// A school's name and state as one slug: "smyrna-tn". Two schools can share it.
export const schoolBase = (name, state) => slugify(`${name} ${String(state ?? '').toUpperCase()}`)

// The slug of one high school (SPEC §6.3). `split` says another school with the same name and state
// has a different city, so every record WITH a city takes the city into its slug
// ("central-toledo-oh"); a record with no city keeps the short one. A record with no state is
// identified by name and city; one with neither is no place at all (the caller skips it).
export function schoolSlug({ name, city, state }, split) {
  const st = String(state ?? '').toUpperCase()
  if (!st) return slugify(`${name} ${city ?? ''}`)
  return split && city ? slugify(`${name} ${city} ${st}`) : schoolBase(name, st)
}
