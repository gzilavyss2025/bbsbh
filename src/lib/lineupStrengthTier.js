// Lineup-strength tier words — a display-only ladder for the 0–10 grade
// (api/lineupStrength.js). DELIBERATELY separate from the shared statTiers
// (lib/statTiers.js): that four-tier Elite/Good/Average/Below set is also
// worn by umpire accuracy and Game Score rankings, and a slate of similarly
// built lineups would otherwise show a column of identical "Good" pills. Here
// the word tracks the score across six narrow bands, with 2–3 interchangeable
// words per band so two clubs in the same band rarely read the same.
//
// Colour collapses back to three families (strong / mid / weak → the field /
// award / clay ink already used by .tierpill) so the palette stays consistent
// with the rest of the app; only the WORD is lineup-specific.
//
// PLACEHOLDER CUTOFFS: the band edges below are informed guesses, not
// calibrated numbers. lineupStrength.js's SCORE_GAP_FULL note flags the whole
// 0–10 scale as the one empirical knob to calibrate against a season of the
// nightly distribution; these bands ride on that scale and should be revisited
// at the same time.
const BANDS = [
  { min: 9.0, colorTier: 'strong', words: ['Best nine', 'Full strength', 'Loaded'] },
  { min: 7.5, colorTier: 'strong', words: ['Near best', 'Near full', 'Well set'] },
  { min: 6.0, colorTier: 'mid', words: ['Mostly intact', 'Steady', 'Solid nine'] },
  { min: 4.5, colorTier: 'mid', words: ['Reshuffled', 'Patched', 'Mixed bag'] },
  { min: 3.0, colorTier: 'weak', words: ['Short-handed', 'Depleted', 'Thinned out'] },
  { min: 0, colorTier: 'weak', words: ['Bare bones', 'Skeleton', 'Stripped down'] },
]

// djb2 string hash → a stable non-negative integer. Used only to pick a word
// within a band, so the choice is deterministic for a given seed (the teamId)
// and never flickers on refresh, yet spreads different clubs across the band's
// alternatives.
function hash(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h
}

// Map a 0–10 score to a { colorTier, label, band } for the lineup-strength
// pill. `seed` (the teamId) makes the within-band word deterministic; omit it
// and the first word of the band is used.
export function lineupStrengthTierFor(score, seed) {
  const s = Number.isFinite(score) ? score : 0
  const bandIndex = BANDS.findIndex((b) => s >= b.min)
  const band = BANDS[bandIndex === -1 ? BANDS.length - 1 : bandIndex]
  const pick = seed == null ? 0 : hash(String(seed)) % band.words.length
  return { colorTier: band.colorTier, label: band.words[pick], band: bandIndex }
}
