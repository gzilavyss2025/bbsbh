import { parkKey } from '../ballpark/parkKeys.js'

// Engraved stadium illustrations for the Heritage Pass, one ballpark at a time.
// Files live in public/heritage-art/{parkKey}.webp; a park missing here keeps
// the pass's engraved venue name. Keyed by parkKey so a sponsor rename still
// finds its art. The pass crops each drawing to fill its slot, anchored at the
// bottom; `position` moves that anchor for a drawing whose top must survive.
// Anchors were picked by eye on /heritage-pass-preview (2026-10-30).
const ART = {
  americanfamilyfield: 'American Family Field',
  chasefield: 'Chase Field',
  citifield: 'Citi Field',
  comericapark: { name: 'Comerica Park', position: 'center top' },
  coorsfield: 'Coors Field',
  daikinpark: { name: 'Daikin Park', position: 'center 70%' },
  dodgerstadium: { name: 'Dodger Stadium', position: 'center 70%' },
  fenwaypark: { name: 'Fenway Park', position: 'center 70%' },
  globelifefield: 'Globe Life Field',
  nationalspark: 'Nationals Park',
  oraclepark: 'Oracle Park',
  sutterhealthpark: { name: 'Sutter Health Park', position: 'center 70%' },
  targetfield: { name: 'Target Field', position: 'center 40%' },
  tmobilepark: { name: 'T-Mobile Park', position: 'center 40%' },
  tropicanafield: { name: 'Tropicana Field', position: 'center 40%' },
  truistpark: { name: 'Truist Park', position: 'center 40%' },
  wrigleyfield: { name: 'Wrigley Field', position: 'center 70%' },
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
