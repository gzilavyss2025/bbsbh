import { parkKey } from '../ballpark/parkKeys.js'

// Engraved stadium illustrations for the Heritage Pass, one ballpark at a time.
// Files live in public/heritage-art/{parkKey}.webp; a park missing here keeps
// the pass's engraved venue name. Keyed by parkKey so a sponsor rename still
// finds its art. The pass fits each complete drawing above the ticket stub.
const ART = {
  americanfamilyfield: 'American Family Field',
  chasefield: 'Chase Field',
  citifield: 'Citi Field',
  comericapark: 'Comerica Park',
  coorsfield: 'Coors Field',
  daikinpark: 'Daikin Park',
  dodgerstadium: 'Dodger Stadium',
  fenwaypark: 'Fenway Park',
  globelifefield: 'Globe Life Field',
  nationalspark: 'Nationals Park',
  oraclepark: 'Oracle Park',
  sutterhealthpark: 'Sutter Health Park',
  targetfield: 'Target Field',
  tmobilepark: 'T-Mobile Park',
  tropicanafield: 'Tropicana Field',
  truistpark: 'Truist Park',
  wrigleyfield: 'Wrigley Field',
  yankeestadium: 'Yankee Stadium',
}
// Former names that parkKey does not pin, so older games still find their park.
const FORMER = { millerpark: 'americanfamilyfield' }

/** @returns {{src: string, alt: string, position?: string} | null} */
export function heritageArt(venueName, venueId = null) {
  const raw = parkKey(venueName, venueId)
  const key = FORMER[raw] ?? raw
  const entry = typeof ART[key] === 'string' ? { name: ART[key] } : ART[key]
  if (!entry) return null
  return { src: `/heritage-art/${key}.webp`, alt: `Engraving of ${entry.name}`, ...(entry.position && { position: entry.position }) }
}
