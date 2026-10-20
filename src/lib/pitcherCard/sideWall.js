// The real wall in the side view (#1771, docs/contact-replay.md §7.1): how far the park's fence is, and how
// tall, along the line of ONE batted ball. Pure and spoiler-free: it reads static park geometry
// (resolveBallparkLayout) and the ball's landing coordinate, which the replay already holds inside the reveal.
import { HIT_COORD_FT_PER_UNIT, HIT_COORD_ORIGIN } from '../ballpark/hitProjection.js'

// The wall heights sit at these angles off straightaway center (negative toward left field), line to line.
const ANGLES5 = [-45, -22.5, 0, 22.5, 45]
const KEYS5 = ['lf', 'lc', 'cf', 'rc', 'rf']
const ANGLES3 = [-45, 0, 45]
const KEYS3 = ['lf', 'cf', 'rf']

function lerpAt(angle, angles, values) {
  if (angle <= angles[0]) return values[0]
  for (let i = 1; i < angles.length; i++) {
    if (angle <= angles[i]) {
      const t = (angle - angles[i - 1]) / (angles[i] - angles[i - 1])
      return values[i - 1] + t * (values[i] - values[i - 1])
    }
  }
  return values.at(-1)
}

// Where a ray from home plate (0,0) at `angle` degrees off center (+ toward right field) first meets the
// fence polyline (feet, +x right field, +y center). Null when it never does.
function fenceDistance(points, angle) {
  const a = (angle * Math.PI) / 180
  const dx = Math.sin(a)
  const dy = Math.cos(a)
  let best = null
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i - 1]
    const [x2, y2] = points[i]
    const ex = x2 - x1
    const ey = y2 - y1
    const den = dx * ey - dy * ex
    if (Math.abs(den) < 1e-9) continue
    const t = (x1 * ey - y1 * ex) / den // distance along the ray
    const s = (x1 * dy - y1 * dx) / den // position along the segment
    if (t > 0 && s >= 0 && s <= 1 && (best == null || t < best)) best = t
  }
  return best
}

// The wall along a ball's line: { ft, height } (height null when the park has none on file), or null when
// there is no layout, no landing coordinate, or the line falls outside the fair lines.
export function wallAlong(layout, hit) {
  const pts = layout?.geometry?.fence
  if (!pts || pts.length < 2 || hit?.coordX == null || hit?.coordY == null) return null
  const fx = (hit.coordX - HIT_COORD_ORIGIN.x) * HIT_COORD_FT_PER_UNIT
  const fy = (HIT_COORD_ORIGIN.y - hit.coordY) * HIT_COORD_FT_PER_UNIT
  if (fy <= 0) return null
  const angle = (Math.atan2(fx, fy) * 180) / Math.PI
  if (Math.abs(angle) > 45) return null
  const ft = fenceDistance(pts, angle)
  if (ft == null) return null
  const m = layout.measurements?.measured?.height
  const w = layout.measurements?.wall
  const height = m ? lerpAt(angle, ANGLES5, KEYS5.map((k) => m[k])) : w ? lerpAt(angle, ANGLES3, KEYS3.map((k) => w[k])) : null
  return { ft: Math.round(ft), height: height == null || Number.isNaN(height) ? null : Math.round(height * 10) / 10 }
}
