import { parkKey } from '../ballpark/parkKeys.js'

// Engraved stadium illustrations for the Heritage Pass, one ballpark at a time.
// Files live in public/heritage-art/{parkKey}.webp; a park missing here keeps
// the pass's engraved venue name. Keyed by parkKey so a sponsor rename still
// finds its art. The pass crops each drawing to fill its slot, anchored at the
// bottom; `position` moves that anchor for a drawing whose top must survive.
const ART = {
  americanfamilyfield: 'American Family Field',
  fenwaypark: { name: 'Fenway Park', position: 'center top' },
  kauffmanstadium: 'Kauffman Stadium',
  petcopark: 'Petco Park',
  pncpark: 'PNC Park',
  tropicanafield: 'Tropicana Field',
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
