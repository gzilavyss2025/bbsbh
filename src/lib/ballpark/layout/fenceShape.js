// Shape rules for a fence outline in the feet frame (home (0,0), +x toward RF,
// +y toward CF), shared by the renderer and the tests (#1859). Pure math.

const DEG = 180 / Math.PI
const bearing = ([x, y]) => Math.atan2(x, y) * DEG

// Where segment a→b crosses the ray from home at `deg`, or null.
function crossRay(a, b, deg) {
  const rad = deg / DEG
  const dx = Math.sin(rad)
  const dy = Math.cos(rad)
  const ex = b[0] - a[0]
  const ey = b[1] - a[1]
  const den = dx * ey - dy * ex
  if (Math.abs(den) < 1e-12) return null
  const t = (a[0] * ey - a[1] * ex) / den
  const u = (a[0] * dy - a[1] * dx) / den
  return t > 0 && u >= 0 && u <= 1 ? [a[0] + ex * u, a[1] + ey * u] : null
}

// The outline cut at the two foul lines (±45°) with segment intersections, so
// it starts on the LF line and ends on the RF line. A 2018 trace runs past
// both poles into foul ground (bullpen and camera-well walls); a Gameday
// outline ends on its own foul lines, a hair inside or outside 45°. An end
// that stops short of the line is carried onto it at the same distance.
export function clipToFoulLines(points) {
  if (!Array.isArray(points) || points.length < 2) return null
  let start = 0
  let first = null
  for (let i = 0; i < points.length - 1; i++) {
    const hit = crossRay(points[i], points[i + 1], -45)
    if (hit) { first = hit; start = i + 1; break }
  }
  let end = points.length - 1
  let last = null
  for (let i = points.length - 1; i > 0; i--) {
    const hit = crossRay(points[i - 1], points[i], 45)
    if (hit) { last = hit; end = i - 1; break }
  }
  const onLine = (p, deg) => {
    const r = Math.hypot(p[0], p[1])
    return [r * Math.sin(deg / DEG), r * Math.cos(deg / DEG)]
  }
  const inner = points.slice(start, end + 1).filter((p) => Math.abs(bearing(p)) < 45)
  if (!inner.length) return null
  return [first ?? onLine(inner[0], -45), ...inner, last ?? onLine(inner[inner.length - 1], 45)]
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
function segmentsCross(p1, p2, p3, p4) {
  const d1 = cross(p3, p4, p1)
  const d2 = cross(p3, p4, p2)
  const d3 = cross(p1, p2, p3)
  const d4 = cross(p1, p2, p4)
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
}

// Problems with a clipped outline, as strings; an empty list is a valid fence.
// It must run LF to RF, stay in fair territory past the infield, and never
// cross itself (the fair-territory polygon home → fence → home would tangle).
export function fenceProblems(points) {
  const out = []
  if (!Array.isArray(points) || points.length < 2) return ['fewer than two points']
  if (!(points[0][0] < 0 && points[points.length - 1][0] > 0)) out.push('does not run left field to right field')
  points.forEach((p, i) => {
    if (Math.abs(bearing(p)) > 45.01) out.push(`point ${i} is in foul territory`)
    if (Math.hypot(p[0], p[1]) < 200) out.push(`point ${i} is inside 200 ft`)
  })
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 2; j < points.length - 1; j++) {
      if (segmentsCross(points[i], points[i + 1], points[j], points[j + 1])) out.push(`segments ${i} and ${j} cross`)
    }
  }
  return out
}

// Wall height at a bearing. With Savant's five measured heights (lines, gaps,
// CF), a straight line between neighbours; the gaps sit at ±18°, where
// Savant's gap distances fall on the outlines (an inference; it does not
// publish the bearing). With only three (line, CF, line), between those.
// Between two measured points the value is a drawing choice, not a
// measurement: it sets the stroke weight, and no label shows it.
const FIVE = [['lf', -45], ['lc', -18], ['cf', 0], ['rc', 18], ['rf', 45]]
const THREE = [['lf', -45], ['cf', 0], ['rf', 45]]
export function heightAt(deg, heights) {
  const ks = FIVE.every(([k]) => Number.isFinite(heights?.[k])) ? FIVE : THREE
  const a = Math.max(-45, Math.min(45, deg))
  for (let i = 0; i < ks.length - 1; i++) {
    const [k0, a0] = ks[i]
    const [k1, a1] = ks[i + 1]
    if (a <= a1) return heights[k0] + (heights[k1] - heights[k0]) * ((a - a0) / (a1 - a0))
  }
  return heights[ks[ks.length - 1][0]]
}

// The measured height at a bearing, or null between measured points: the only
// heights a label may print. `tol` is how many degrees off a point still counts.
export function measuredHeightAt(deg, heights, tol = 2) {
  const ks = FIVE.every(([k]) => Number.isFinite(heights?.[k])) ? FIVE : THREE
  const hit = ks.find(([, a]) => Math.abs(deg - a) <= tol)
  return hit && Number.isFinite(heights?.[hit[0]]) ? heights[hit[0]] : null
}
