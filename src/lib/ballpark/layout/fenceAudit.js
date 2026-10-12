// The fence audit: does a digitized outfield wall agree with the distances the
// park posts? Pure math on the feet frame ballparkFields.js uses (home plate at
// (0,0), +x toward right field, +y toward center field). No data import, so the
// registry, the renderer, and the tests all run the same check (#1859).
//
// WHAT IT CHECKS, AND WHAT IT DOES NOT. Only the center-field marker. The two
// pole ends are not checked, because the renderer pins each end of the fence to
// the posted pole distance anyway (ballparkGeometry.js). The two gap markers are
// not checked either: a gap sign stands wherever the club put it, not at a fixed
// ±22.5°, so a ray at ±22.5° proves nothing about it. The CF sign is read two
// ways, because clubs post it two ways: at straightaway center (0°), or at the
// deepest point near center (Fenway's 420 is the triangle, about 10° right of
// straightaway). Whichever reading is closer to the posted number is the one
// the audit keeps, and the angle it used is where the CF label belongs.

// The largest gap, in feet, between the fence and the posted CF distance that
// still passes. A trace that misses by more is either a different configuration
// (Houston's seed reaches Tal's Hill, 436 ft, against a posted 409) or a scale
// error, and the audit cannot tell those apart, so it passes neither.
export const CF_TOLERANCE_FT = 10

// How far either side of straightaway the audit looks for a deepest-point sign.
const DEEP_SEARCH_DEG = 20
const DEEP_STEP_DEG = 0.5

// Distance in feet from home plate to where a ray at `deg` (0 = straightaway
// center, negative toward left field) first leaves through the fence polyline,
// or null when the ray misses it. Where a ray crosses the line twice (a notch),
// the outermost crossing is the wall a ball would hit.
export function fenceDistanceAt(points, deg) {
  const rad = (deg * Math.PI) / 180
  const dx = Math.sin(rad)
  const dy = Math.cos(rad)
  let best = null
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]
    const ex = x2 - x1
    const ey = y2 - y1
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-9) continue
    const t = (x1 * ey - y1 * ex) / den
    const u = (x1 * dy - y1 * dx) / den
    if (t > 0 && u >= 0 && u <= 1) best = best == null ? t : Math.max(best, t)
  }
  return best
}

const round1 = (n) => Math.round(n * 10) / 10

// The audit of one fence against one posted CF distance. Returns the reading it
// kept, the angle of that reading (where the CF label goes), the error in feet,
// and whether it passes. Returns null when there is nothing to audit.
export function auditFence(points, postedCf) {
  if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(postedCf)) return null
  const straight = fenceDistanceAt(points, 0)
  let deep = { ft: -Infinity, deg: 0 }
  for (let deg = -DEEP_SEARCH_DEG; deg <= DEEP_SEARCH_DEG; deg += DEEP_STEP_DEG) {
    const ft = fenceDistanceAt(points, deg)
    if (ft != null && ft > deep.ft) deep = { ft, deg }
  }
  const straightErr = straight == null ? Infinity : Math.abs(straight - postedCf)
  const deepErr = Math.abs(deep.ft - postedCf)
  const useDeep = deepErr < straightErr
  const ft = useDeep ? deep.ft : straight
  const errFt = ft - postedCf
  return {
    cfReadingFt: round1(ft),
    cfMarkerAngle: useDeep ? deep.deg : 0,
    cfErrorFt: round1(errFt),
    pass: Math.abs(errFt) <= CF_TOLERANCE_FT,
  }
}
