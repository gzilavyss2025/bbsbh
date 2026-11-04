// Park names and the pinned park key, WITHOUT the fence and field geometry.
// The copy registry (on every route) needs only these; importing BALLPARKS for
// them pulled ~20 KB gzip of geometry into every non-slate first load (#2898).
// test/park-names.test.js holds PARK_NAMES equal to ballparkData.js's BALLPARKS.
// parkKeys.js explains why the key is pinned.

import PINNED from './park-keys.json' with { type: 'json' }
import { venueKey } from '../ballpark/ballparkArt.js'

// BALLPARKS key (aliases included) -> the park's canonical name.
export const PARK_NAMES = {
  americanfamilyfield: 'American Family Field',
  angelstadium: 'Angel Stadium',
  buschstadium: 'Busch Stadium',
  chasefield: 'Chase Field',
  citifield: 'Citi Field',
  citizensbankpark: 'Citizens Bank Park',
  comericapark: 'Comerica Park',
  coorsfield: 'Coors Field',
  daikinpark: 'Daikin Park',
  fenwaypark: 'Fenway Park',
  globelifefield: 'Globe Life Field',
  greatamericanballpark: 'Great American Ball Park',
  kauffmanstadium: 'Kauffman Stadium',
  loandepotpark: 'loanDepot park',
  nationalspark: 'Nationals Park',
  oraclepark: 'Oracle Park',
  orioleparkatcamdenyards: 'Oriole Park at Camden Yards',
  petcopark: 'Petco Park',
  pncpark: 'PNC Park',
  progressivefield: 'Progressive Field',
  ratefield: 'Rate Field',
  rogerscentre: 'Rogers Centre',
  targetfield: 'Target Field',
  tmobilepark: 'T-Mobile Park',
  tropicanafield: 'Tropicana Field',
  truistpark: 'Truist Park',
  uniqlofieldatdodgerstadium: 'Dodger Stadium',
  wrigleyfield: 'Wrigley Field',
  yankeestadium: 'Yankee Stadium',
  sutterhealthpark: 'Sutter Health Park',
  dodgerstadium: 'Dodger Stadium',
  minutemaidpark: 'Daikin Park',
  guaranteedratefield: 'Rate Field',
}

// venueKey(any name a pinned venue has worn) -> that venue's pinned key.
const KEY_BY_NAME = new Map()
for (const { key, names } of Object.values(PINNED)) {
  for (const name of names) KEY_BY_NAME.set(venueKey(name), key)
}

// The key a park's stores are filed under. The venue id wins when the caller
// has one: it finds a renamed park even before the generator has recorded the
// new name. Then any name the venue has worn. Then, for a venue on no list (a
// neutral site, a park newer than the last generator run), the same
// canonical-name key the stores have always used. Every current MLB venue id is
// pinned (test/park-names.test.js), so no geometry lookup by id is needed.
export function parkKey(venueName, venueId = null) {
  const pinned = venueId != null ? PINNED[venueId]?.key : null
  if (pinned) return pinned
  const raw = venueKey(venueName)
  if (!raw) return ''
  return KEY_BY_NAME.get(raw) ?? venueKey(PARK_NAMES[raw] || venueName)
}
