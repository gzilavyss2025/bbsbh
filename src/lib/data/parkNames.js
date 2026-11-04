// The ONE list of MLB parks: key, name, Stats API venue id and alias keys.
// WITHOUT the fence and field geometry: the copy registry (on every route)
// needs only these, and importing BALLPARKS for them pulled ~20 KB gzip of
// geometry into every non-slate first load (#2898). ../ballpark/ballparkData.js
// builds each record's name and its alias keys from this list, and
// ../ballpark/layout/configurations.js holds the same venue ids (a test keeps
// the two equal). A park renamed, added or aliased is edited HERE.
// JSON-FREE ON PURPOSE: ballparkData.js reaches the Vercel edge function
// api/preview.js (via api/_lib/cards.js), whose bundler cannot parse
// `import ... with { type: 'json' }`. parkKey, which reads park-keys.json, is in
// ./parkKey.js.

import { venueKey } from '../ballpark/ballparkArt.js'

// key is ballparkData's normalized venue name; aliases are former/sponsor keys.
export const PARKS = [
  { key: 'americanfamilyfield', name: 'American Family Field', venueId: 32 },
  { key: 'angelstadium', name: 'Angel Stadium', venueId: 1 },
  { key: 'buschstadium', name: 'Busch Stadium', venueId: 2889 },
  { key: 'chasefield', name: 'Chase Field', venueId: 15 },
  { key: 'citifield', name: 'Citi Field', venueId: 3289 },
  { key: 'citizensbankpark', name: 'Citizens Bank Park', venueId: 2681 },
  { key: 'comericapark', name: 'Comerica Park', venueId: 2394 },
  { key: 'coorsfield', name: 'Coors Field', venueId: 19 },
  { key: 'daikinpark', name: 'Daikin Park', venueId: 2392, aliases: ['minutemaidpark'] },
  { key: 'fenwaypark', name: 'Fenway Park', venueId: 3 },
  { key: 'globelifefield', name: 'Globe Life Field', venueId: 5325 },
  { key: 'greatamericanballpark', name: 'Great American Ball Park', venueId: 2602 },
  { key: 'kauffmanstadium', name: 'Kauffman Stadium', venueId: 7 },
  { key: 'loandepotpark', name: 'loanDepot park', venueId: 4169 },
  { key: 'nationalspark', name: 'Nationals Park', venueId: 3309 },
  { key: 'oraclepark', name: 'Oracle Park', venueId: 2395 },
  { key: 'orioleparkatcamdenyards', name: 'Oriole Park at Camden Yards', venueId: 2 },
  { key: 'petcopark', name: 'Petco Park', venueId: 2680 },
  { key: 'pncpark', name: 'PNC Park', venueId: 31 },
  { key: 'progressivefield', name: 'Progressive Field', venueId: 5 },
  { key: 'ratefield', name: 'Rate Field', venueId: 4, aliases: ['guaranteedratefield'] },
  { key: 'rogerscentre', name: 'Rogers Centre', venueId: 14 },
  { key: 'targetfield', name: 'Target Field', venueId: 3312 },
  { key: 'tmobilepark', name: 'T-Mobile Park', venueId: 680 },
  { key: 'tropicanafield', name: 'Tropicana Field', venueId: 12 },
  { key: 'truistpark', name: 'Truist Park', venueId: 4705 },
  { key: 'uniqlofieldatdodgerstadium', name: 'Dodger Stadium', venueId: 22, aliases: ['dodgerstadium'] },
  { key: 'wrigleyfield', name: 'Wrigley Field', venueId: 17 },
  { key: 'yankeestadium', name: 'Yankee Stadium', venueId: 3313 },
  { key: 'sutterhealthpark', name: 'Sutter Health Park', venueId: 2529 },
]

// Every key a park answers to (aliases included) -> its name, and venue id -> name.
const NAME_BY_KEY = new Map()
const NAME_BY_VENUE_ID = new Map()
for (const { key, name, venueId, aliases = [] } of PARKS) {
  for (const k of [key, ...aliases]) NAME_BY_KEY.set(k, name)
  NAME_BY_VENUE_ID.set(venueId, name)
}
export const PARK_KEYS = [...NAME_BY_KEY.keys()]

// The park's canonical name for a venue, by id (wins when given) or by any name
// whose normalized form is a park key; null for a venue on no list.
export function canonicalParkName(venueName, venueId = null) {
  return (venueId != null && NAME_BY_VENUE_ID.get(Number(venueId))) || NAME_BY_KEY.get(venueKey(venueName)) || null
}
