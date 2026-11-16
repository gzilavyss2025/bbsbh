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
export const MOVE_RANGE = 24 // the cap, inches each way from the centre
const MOVE_FLOOR = 12
const MOVE_MARGIN = 3

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

// The movement plot's half-width in inches, fitted to this night: his biggest
// break (tonight's pitches, or the season ring of a pitch he threw) plus a margin, at least 12 in and at
// most the 24 in cap. A fixed 24 left most of the box empty for a sinkerballer.
export function movementRange(pitches, seasonByCode) {
  let max = 0
  for (const p of pitches) {
    if (p.pfxX != null) max = Math.max(max, Math.abs(p.pfxX))
    if (p.pfxZ != null) max = Math.max(max, Math.abs(p.pfxZ))
  }
  // Only the season rings that get drawn: pitch types he threw tonight.
  for (const code of new Set(pitches.map((p) => p.type))) {
    const s = seasonByCode?.get?.(code)
    if (s?.pfxX != null) max = Math.max(max, Math.abs(s.pfxX))
    if (s?.pfxZ != null) max = Math.max(max, Math.abs(s.pfxZ))
  }
  return Math.min(MOVE_RANGE, Math.max(MOVE_FLOOR, Math.ceil(max + MOVE_MARGIN)))
}

// { x, y } for a movement in inches in a w×h box, clamped to `range` so a
// wild reading stays on the plot.
export function movementScale(w, h, range = MOVE_RANGE) {
  const clamp = (v) => Math.max(-range, Math.min(range, v))
  const r = [-range, range]
  return { x: (dx) => lerp(clamp(dx), r, w), y: (dz) => h - lerp(clamp(dz), r, h) }
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

// "+0.4" / "−1.2", or '' under 0.3 mph (noise, not a story) or when either side is missing.
export function veloDelta(tonight, season) {
  if (!Number.isFinite(tonight) || !Number.isFinite(season)) return ''
  const d = Math.round((tonight - season) * 10) / 10
  if (Math.abs(d) < 0.3) return ''
  return `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`
}
