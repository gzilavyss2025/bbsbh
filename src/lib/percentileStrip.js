// Scale math for the player page's Statcast percentile strip — the ruled
// ledger on src/components/charts/PercentileStrip.jsx. Pure: numbers in,
// numbers out, no DOM and no React, so the scale can be pinned by unit tests
// rather than eyeballed in a browser. Same split the radar this replaced used
// (lib/radarGeometry.js), and the same one lib/beeswarm.js and
// lib/passportLayout.js use.
//
// WHY A SHARED AXIS AND NOT A POLYGON. Every Statcast percentile is already on
// one common 0–100 scale, pre-flipped by Savant so higher is always better
// (see api/savantPercentiles.js). That is the one case where the most
// accurately-decoded encoding available — position along a common scale — is
// simply free: six metrics, one axis, no normalisation to invent. The radar
// that used to sit here spent that for an area encoding, which grows as the
// SQUARE of the quantity, reads differently depending on which arbitrary order
// the spokes happen to be listed in, and had room for only five of the six or
// seven metrics a player actually has. ADR-0040 has the full argument.

// Where the league-average reference rule sits. A property of the percentile
// scale, not a tunable: on a percentile rank the average player is the 50th by
// construction, which is what makes the reference a single ruled line down the
// strip rather than a second data series to fetch and keep in step.
export const LEAGUE_AVERAGE = 50

// A percentile's position along the track, as a 0..1 fraction of the track's
// plottable width.
//
// The dot's own width is NOT accounted for here — the component insets it in
// CSS with `calc(var(--pct) * (100% - var(--pctstrip-dot)))`, so a 0th- and a
// 100th-percentile dot both sit fully inside the track instead of hanging half
// off each end. Keeping that in CSS is deliberate: the inset depends on the
// rendered dot size, which is a token, not a number this module can know.
export function dotFraction(percentile) {
  if (!Number.isFinite(percentile)) return null
  return round(clamp(percentile, 0, 100) / 100)
}

// The deviation bar runs from the league-average rule to the dot, so its
// geometry is just the interval between the two — returned as {start, width}
// fractions of the same track. Width is 0 for a player exactly at the 50th,
// which renders as nothing and is correct: no deviation to draw.
export function deviationBar(percentile) {
  const dot = dotFraction(percentile)
  if (dot == null) return null
  const mid = LEAGUE_AVERAGE / 100
  return {
    start: round(Math.min(mid, dot)),
    width: round(Math.abs(dot - mid)),
    // Which side of the rule the player landed on. The component uses this
    // only to pick a modifier class for the rounded end of the bar; the
    // DIRECTION is already carried by position, so nothing depends on colour.
    side: dot < mid ? 'below' : 'above',
  }
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n))
}

// Percentiles are integers, so every fraction here is a multiple of 0.01 and
// four places is far more than the scale can carry. Rounding is not cosmetic:
// these land in CSS custom properties, and without it the 80th percentile's
// bar comes out 0.30000000000000004 wide while the 20th's comes out 0.3 —
// the same distance from average, written two different ways into the DOM.
function round(n) {
  return Math.round(n * 10000) / 10000
}
