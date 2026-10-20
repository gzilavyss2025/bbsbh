// The words of the "Where they're from" pages (#1526, SPEC §3), written once. Sentence case
// here; the stylesheet sets any capitals. No emoji, no exclamation marks. "Postseason", never
// the banned word (check-word-choice).
import { CENSUS_CREDIT, GEONAMES_CREDIT, IPEDS_CREDIT } from '../../../scripts/lib/open-data/credits.mjs'
import { STATE_NAMES } from './states.js'

export const FROM_TITLE = 'Where they’re from'

export const LIST_LABEL = { college: 'College', 'high-school': 'High school', hometown: 'Hometown' }

const isTown = (list) => list === 'hometown'

export const pickerIntro = (list) =>
  isTown(list) ? 'Pick a town. See every big leaguer born there.' : 'Pick a school. See every big leaguer who played there.'

export const placeIntro = (list) =>
  isTown(list)
    ? 'Every big leaguer born in one town, by the decade of the MLB debut.'
    : 'Every big leaguer who played at one school, by the decade of the MLB debut.'

export const changeLink = (list) => (isTown(list) ? 'Change town' : 'Change school')

export const placeMissing = 'No place is listed at this address.'

export const searchField = (list) =>
  isTown(list)
    ? { label: 'Find a town', placeholder: 'Donora' }
    : { label: 'Find a school', placeholder: list === 'high-school' ? 'Smyrna' : 'Vanderbilt' }

export const legendHas = (list) => (isTown(list) ? 'Has a hometown' : 'Has a school')

export const listTabName = (list, { stateName, zoneName } = {}) => {
  const base = { college: 'Colleges', 'high-school': 'High schools', hometown: 'Hometowns' }[list]
  const where = zoneName ?? stateName
  return where ? `${base} · ${where}` : base
}

export const countTag = (list, n) => `${n} ${isTown(list) ? 'town' : 'school'}${n === 1 ? '' : 's'}`

export const stateName = (code) => STATE_NAMES[code] ?? code

export function emptyList(list, { query, state }) {
  if (query) return isTown(list) ? 'No town by that name has a big leaguer yet.' : 'No school by that name has a big leaguer yet.'
  const name = stateName(state)
  if (isTown(list)) return `No big leaguer born in ${name} yet.`
  return `No ${list === 'college' ? 'college' : 'high school'} in ${name} has a big leaguer yet.`
}

export const unplacedNote = (n) => `${n} colleges are not on the map yet. Search finds them.`

export const footnote = (list) =>
  `${isTown(list) ? 'Birthplaces' : 'Schools'} as the MLB Stats API lists them. A player who did not reach the majors is not listed.`

// The credit lines are written once, in credits.mjs, where the generators read them (ADR-0100).
// test/from-lib.test.js checks that the About page prints them too.
export const creditsFor = (list) => (isTown(list) ? [CENSUS_CREDIT, GEONAMES_CREDIT] : [IPEDS_CREDIT, CENSUS_CREDIT])
