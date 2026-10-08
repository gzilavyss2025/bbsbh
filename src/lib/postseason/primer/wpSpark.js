// The ribbon's win-chance line for one finished game (ADR-0087): `wp` is the
// home club's win chance, 0-100, at most 26 points (slice 1's game shape). The
// line is drawn from one club's side: `flip` is true when that club was away.
// Returns SVG point strings in a w x h box (high chance = top), the share above
// the middle line and the share below it as two fills (closed along the middle).
// Null when there is no line to draw (the degrade convention).
import { gamePoints } from '../seriesFlow.js'

const WP_POINTS = 26

// The `wp` a finished game carries: the home club's win chance, even at the start
// and then after each play, rounded, at most WP_POINTS evenly spaced. The nightly
// shard (seriesBlock.js) and the live read (primerGames.js) both build it here, so
// the same game draws the same line whichever one supplied it.
export function wpLine(winProb, homeId) {
  const ys = gamePoints(winProb, homeId, homeId).points.map((p) => Math.round(p.y))
  if (ys.length <= WP_POINTS) return ys
  return Array.from({ length: WP_POINTS }, (_, i) => ys[Math.round((i * (ys.length - 1)) / (WP_POINTS - 1))])
}

const pt = (x, y) => `${x.toFixed(1)},${y.toFixed(1)}`

export function wpSpark(wp, { flip = false, w = 100, h = 26 } = {}) {
  if (!Array.isArray(wp) || wp.length < 2 || !wp.every(Number.isFinite)) return null
  const mid = h / 2
  const pts = wp.map((p, i) => ({ x: (i / (wp.length - 1)) * w, y: (1 - (flip ? 100 - p : p) / 100) * h }))
  // A fill follows the line exactly, so where the line crosses the middle a
  // point goes in at the crossing: the share above it ends, the share below begins.
  const withCrossings = pts.flatMap((p, i) => {
    const q = pts[i + 1]
    if (!q || (p.y - mid) * (q.y - mid) >= 0) return [p]
    return [p, { x: p.x + ((mid - p.y) / (q.y - p.y)) * (q.x - p.x), y: mid }]
  })
  const trace = (list, clamp) => list.map(({ x, y }) => pt(x, clamp(y))).join(' ')
  const closed = (clamp) => `${trace(withCrossings, clamp)} ${pt(w, mid)} ${pt(0, mid)}`
  return { line: trace(pts, (y) => y), up: closed((y) => Math.min(y, mid)), down: closed((y) => Math.max(y, mid)) }
}
