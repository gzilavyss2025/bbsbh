// The pitcher game card's two plots (#2969), as pure geometry shared by the
// sheet's SVG and the saved PNG's canvas, so the picture you save is the one
// you saw.
//
// LOCATION: every pitch against the zone it was thrown into, from the
// catcher's side (ADR-0124). `loc` is zoneGeometry.js's normalizePitch: xn in
// half-plate units (±1 is the black), zn in zone heights (0 the bottom, 1 the
// top). A night of batters of different heights then shares one drawn zone.
//
// MOVEMENT: pfxX / pfxZ in inches, catcher's view, the same fields the season
// arsenal averages (scripts/lib/pitch/arsenal-physics.mjs), so a pitch's dots
// and its season ring are measured the same way.

const LOC_X = [-2.6, 2.6]
const LOC_Z = [-0.9, 1.9]
export const MOVE_RANGE = 24 // inches each way from the centre

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

// { x, y } for a movement in inches, clamped to the box so a wild reading
// stays on the plot.
export function movementScale(w, h) {
  const clamp = (v) => Math.max(-MOVE_RANGE, Math.min(MOVE_RANGE, v))
  const range = [-MOVE_RANGE, MOVE_RANGE]
  return { x: (dx) => lerp(clamp(dx), range, w), y: (dz) => h - lerp(clamp(dz), range, h) }
}

// The season figures a card compares against, by pitch code, from one
// pitcher's arsenal entry (api/pitcher/arsenal.js: `{ mlb: [...], aaa: [...] }`,
// each pitch `{ code, avgVelo, phys }` with phys in PHYS_FIELDS order). `level`
// is the GAME's ('mlb' or 'aaa'): a Triple-A night is measured against his
// Triple-A season, never his MLB one. A missing field stays null; the card then
// shows nothing.
export function seasonByCode(entry, physFields, level = 'mlb') {
  const rows = entry?.[level] ?? []
  const ix = physFields.indexOf('pfxX')
  const iz = physFields.indexOf('pfxZ')
  const out = new Map()
  for (const r of rows) {
    if (!r?.code) continue
    out.set(r.code, {
      velo: Number.isFinite(r.avgVelo) ? r.avgVelo : null,
      pfxX: Number.isFinite(r.phys?.[ix]) ? r.phys[ix] : null,
      pfxZ: Number.isFinite(r.phys?.[iz]) ? r.phys[iz] : null,
    })
  }
  return out
}

// "+0.4" / "−1.2" / "0.0", or '' when either side is missing.
export function veloDelta(tonight, season) {
  if (!Number.isFinite(tonight) || !Number.isFinite(season)) return ''
  const d = Math.round((tonight - season) * 10) / 10
  if (d === 0) return '0.0'
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`
}
