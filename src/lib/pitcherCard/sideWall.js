// The real wall in the side view (#1771, docs/contact-replay.md §7.1): how far the park's fence is, and how
// tall, along the line of ONE batted ball. Pure and spoiler-free: it reads static park geometry
// (resolveBallparkLayout) and the ball's landing coordinate, which the replay already holds inside the reveal.
// The wall itself is wallOnLine, the one the Elevation Arc draws, so the two side views cannot disagree.
import { ballBearing, wallOnLine } from '../ballpark/ballFlight.js'
import { hitCoordToSvg } from '../ballpark/hitProjection.js'

// The wall along a ball's line: { ft, height }, or null when there is no layout, no landing coordinate, or the
// line falls outside the fair lines. Only an AUDITED outline counts: a minor-league park's outline is checked
// against the posted signs alone ('estimated', or no outline at all), and the post is labelled this park's
// wall, so it falls back to the generic fence (rendered on 816008, Norfolk).
export function wallAlong(layout, hit) {
  if (layout?.quality?.fence !== 'audited') return null
  const landing = hitCoordToSvg(hit?.coordX, hit?.coordY)
  if (!landing) return null
  const deg = ballBearing(landing)
  if (Math.abs(deg) > 45) return null // foul, or behind the plate
  const w = wallOnLine(layout, deg)
  return w ? { ft: Math.round(w.ft), height: w.height } : null
}
