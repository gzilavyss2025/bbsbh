import { parkKey } from '../ballpark/parkKeys.js'

// Engraved stadium illustrations for the Heritage Pass, one ballpark at a time.
// Files live in public/heritage-art/{parkKey}.webp; a park missing here keeps
// the pass's engraved venue name. Keyed by parkKey so a sponsor rename still
// finds its art.
const ART = {
  americanfamilyfield: 'American Family Field',
  fenwaypark: 'Fenway Park',
  tropicanafield: 'Tropicana Field',
  wrigleyfield: 'Wrigley Field',
  yankeestadium: 'Yankee Stadium',
}
// Former names that parkKey does not pin, so older games still find their park.
const FORMER = { millerpark: 'americanfamilyfield' }

/** @returns {{src: string, alt: string} | null} */
export function heritageArt(venueName, venueId = null) {
  const raw = parkKey(venueName, venueId)
  const key = FORMER[raw] ?? raw
  return ART[key] ? { src: `/heritage-art/${key}.webp`, alt: `Engraving of ${ART[key]}` } : null
}
