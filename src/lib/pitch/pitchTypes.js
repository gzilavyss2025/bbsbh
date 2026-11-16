// The pitch-type language: ONE shape and ONE colour per MLB pitch code, so a
// pitch looks the same on every page and for every pitcher. Why and how to
// extend it: docs/pitch-types.md.
//
// SHAPE is the family (circle fastball, diamond breaking, square offspeed,
// triangle specialty, hexagon unlabeled). COLOUR is the pitch. A `ring` mark is
// hollow and means "a rarer variant of the solid mark beside it". Colour never
// works alone: draw the code (FF, SL, CH) next to the mark where room allows.
//
// Pure data, no React, no feed reads. Every colour sits at the same WCAG
// luminance (UN quieter), so no pitch reads louder than another, and clears 3:1
// on light AND dark paper. check-contrast.mjs enforces it (pitchLuminance.js);
// retune a hex until it passes, never the band (#2974).

export const PITCH_FAMILIES = {
  H: { name: 'Fastballs', shape: 'circle' },
  B: { name: 'Breaking balls', shape: 'diamond' },
  O: { name: 'Offspeed', shape: 'square' },
  S: { name: 'Specialty', shape: 'triangle' },
  U: { name: 'Unlabeled', shape: 'hexagon' },
}

// Order is the order the key shows them in.
export const PITCH_TYPES = [
  { code: 'FF', name: 'Four-seam', family: 'H', color: '#FA1400' },
  { code: 'SI', name: 'Sinker', family: 'H', color: '#BF6800' },
  { code: 'FC', name: 'Cutter', family: 'H', color: '#8A67E9' },
  { code: 'SL', name: 'Slider', family: 'B', color: '#2E77FF' },
  { code: 'ST', name: 'Sweeper', family: 'B', color: '#0F88B1' },
  { code: 'SV', name: 'Slurve', family: 'B', color: '#1E8D79' },
  { code: 'CU', name: 'Curveball', family: 'B', color: '#F3008B' },
  { code: 'KC', name: 'Knuckle curve', family: 'B', color: '#F3008B', ring: true },
  { code: 'CS', name: 'Slow curve', family: 'B', color: '#BB5F93', ring: true },
  { code: 'CH', name: 'Changeup', family: 'O', color: '#239141' },
  { code: 'FS', name: 'Splitter', family: 'O', color: '#6E8811' },
  { code: 'FO', name: 'Forkball', family: 'O', color: '#6E8811', ring: true },
  { code: 'SC', name: 'Screwball', family: 'S', color: '#4F8977' },
  { code: 'KN', name: 'Knuckleball', family: 'S', color: '#5A80B1' },
  { code: 'EP', name: 'Eephus', family: 'S', color: '#9F7744' },
]

const UNKNOWN = { code: 'UN', name: 'Other', family: 'U', color: '#64738E', ring: true }

const BY_CODE = new Map(PITCH_TYPES.map((t) => [t.code, t]))

// The mark for one pitch code. A code the table does not know (PO, a missing
// label, a MiLB feed with no tracking) gets the hollow gray hexagon, never a
// throw and never a borrowed colour.
export function pitchMark(code) {
  const t = BY_CODE.get(String(code || '').toUpperCase()) || UNKNOWN
  return { code: t.code, name: t.name, family: t.family, shape: PITCH_FAMILIES[t.family].shape, color: t.color, ring: !!t.ring }
}
