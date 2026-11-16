// The pitcher game card's two plots (#2969), as pure geometry shared by the
// sheet's SVG and the saved PNG's canvas, so the picture you save is the one
// you saw.
//
// LOCATION: every pitch against the zone it was thrown into, from the
// catcher's side (ADR-0124). `loc` is zoneGeometry.js's normalizePitch: xn in
// half-plate units (±1 is the black), zn in zone heights (0 the bottom, 1 the
// top). A night of batters of different heights then shares one drawn zone.
//
// SPRAY: where the balls put in play off him landed, on the park's own field
// (lib/ballpark/). The points are already in the ballpark drawing's space
// (hitProjection.js); `fitViewBox` is how the PNG puts that drawing in its box.

const LOC_X = [-2.6, 2.6]
const LOC_Z = [-0.9, 1.9]
const lerp = (v, [a, b], size) => ((v - a) / (b - a)) * size

const clampTo = (v, [a, b]) => Math.max(a, Math.min(b, v))

// { x, y } for a pitch's loc in a w×h box (y grows down), and the zone's rect.
// A pitch past the edge (a spiked splitter, a pitchout) pins to it, so every
// pitch stays on the plot.
export function locationScale(w, h) {
  const x = (xn) => lerp(clampTo(xn, LOC_X), LOC_X, w)
  const y = (zn) => h - lerp(clampTo(zn, LOC_Z), LOC_Z, h)
  return { x, y, zone: { x: x(-1), y: y(1), w: x(1) - x(-1), h: y(0) - y(1) } }
}

// A ball in play's dot, in the ballpark drawing's 620-wide units: big enough
// to read when the field is shrunk into a card's half-width plot.
export const BALL_R = { hit: 16, out: 13 }

// Scale and offset that fit an SVG viewBox ("x y w h") inside a w×h box at
// one scale (preserveAspectRatio "xMidYMid meet"), for a canvas that paints
// the same drawing: canvas point = (svg point × scale) + (dx, dy).
export function fitViewBox(viewBox, w, h) {
  const [vx, vy, vw, vh] = String(viewBox).split(/[\s,]+/).map(Number)
  const scale = Math.min(w / vw, h / vh)
  return { scale, dx: (w - vw * scale) / 2 - vx * scale, dy: (h - vh * scale) / 2 - vy * scale }
}

// His season speed per pitch code, from one pitcher's arsenal entry
// (api/pitcher/arsenal.js: `{ mlb: [...], aaa: [...] }`, each pitch
// `{ code, avgVelo }`). `level` is the GAME's ('mlb' or 'aaa'): a Triple-A
// night is measured against his Triple-A season, never his MLB one. A missing
// speed stays null; the card then shows no change.
export function seasonByCode(entry, level = 'mlb') {
  const out = new Map()
  for (const r of entry?.[level] ?? []) {
    if (r?.code) out.set(r.code, { velo: Number.isFinite(r.avgVelo) ? r.avgVelo : null })
  }
  return out
}

// "+0.4" / "−1.2", or '' under 0.3 mph (noise, not a story) or when either side is missing.
export function veloDelta(tonight, season) {
  if (!Number.isFinite(tonight) || !Number.isFinite(season)) return ''
  const d = Math.round((tonight - season) * 10) / 10
  if (Math.abs(d) < 0.3) return ''
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`
}
