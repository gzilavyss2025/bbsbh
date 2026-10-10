// The pitch-type language: ONE shape and ONE colour per MLB pitch code, so a
// pitch looks the same on every page and for every pitcher. Why and how to
// extend it: docs/pitch-types.md.
//
// SHAPE is the family (circle fastball, diamond breaking, square offspeed,
// triangle specialty, hexagon unlabeled). COLOUR is the pitch. A `ring` mark is
// hollow and means "a rarer variant of the solid mark beside it". Colour never
// works alone: draw the code (FF, SL, CH) next to the mark where room allows.
//
// Pure data, no React, no feed reads. Colours are tuned on a DARK ground (the
// design-lab artifact). No screen uses them yet; a paper-ground tone is an open
// item in the doc.

export const PITCH_FAMILIES = {
  H: { name: 'Fastballs', shape: 'circle' },
  B: { name: 'Breaking balls', shape: 'diamond' },
  O: { name: 'Offspeed', shape: 'square' },
  S: { name: 'Specialty', shape: 'triangle' },
  U: { name: 'Unlabeled', shape: 'hexagon' },
}

// Order is the order the key shows them in.
export const PITCH_TYPES = [
  { code: 'FF', name: 'Four-seam', family: 'H', color: '#FF6B5E' },
  { code: 'SI', name: 'Sinker', family: 'H', color: '#FFA53A' },
  { code: 'FC', name: 'Cutter', family: 'H', color: '#B79CFF' },
  { code: 'SL', name: 'Slider', family: 'B', color: '#4F8CFF' },
  { code: 'ST', name: 'Sweeper', family: 'B', color: '#49C6F0' },
  { code: 'SV', name: 'Slurve', family: 'B', color: '#2FD3B5' },
  { code: 'CU', name: 'Curveball', family: 'B', color: '#FF7AC6' },
  { code: 'KC', name: 'Knuckle curve', family: 'B', color: '#FF7AC6', ring: true },
  { code: 'CS', name: 'Slow curve', family: 'B', color: '#FFB8E0', ring: true },
  { code: 'CH', name: 'Changeup', family: 'O', color: '#6EDC8C' },
  { code: 'FS', name: 'Splitter', family: 'O', color: '#C6E84A' },
  { code: 'FO', name: 'Forkball', family: 'O', color: '#C6E84A', ring: true },
  { code: 'SC', name: 'Screwball', family: 'S', color: '#8FE3C8' },
  { code: 'KN', name: 'Knuckleball', family: 'S', color: '#EEF2F7' },
  { code: 'EP', name: 'Eephus', family: 'S', color: '#FFD9A8' },
]

const UNKNOWN = { code: 'UN', name: 'Other', family: 'U', color: '#8A97AD', ring: true }

const BY_CODE = new Map(PITCH_TYPES.map((t) => [t.code, t]))

// The mark for one pitch code. A code the table does not know (PO, a missing
// label, a MiLB feed with no tracking) gets the hollow gray hexagon, never a
// throw and never a borrowed colour.
export function pitchMark(code) {
  const t = BY_CODE.get(String(code || '').toUpperCase()) || UNKNOWN
  return { code: t.code, name: t.name, family: t.family, shape: PITCH_FAMILIES[t.family].shape, color: t.color, ring: !!t.ring }
}
