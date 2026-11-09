import { tenseBars } from '../../../api/tensest/tenseBars.js'

// The pressure strip under the win-probability plot (#2980, Gary's option C):
// the Pressure meter laid on its side, one segment per play. A segment spans
// the step the line draws for that play: WinProbChart puts a synthetic 50%
// origin before the first play, so play k runs from stop k to stop k + 1.
// `points` come already clamped to the reveal (api/winprob.js), so the strip
// can show no sealed play. A play with no LI (a game's first) gets no segment.

// How tall a segment stands: low for bars 1–4, mid 5–7, high 8–10.
export function stripLevel(bars) {
  if (!Number.isInteger(bars) || bars < 1) return null
  return bars >= 8 ? 'high' : bars >= 5 ? 'mid' : 'low'
}

export function pressureStrip(points, cutoffs, { left, width }) {
  if (!Array.isArray(points) || points.length === 0) return []
  const stops = points.length // the origin plus each play, minus one
  const x = (i) => left + (i / stops) * width
  const segs = []
  points.forEach((p, k) => {
    const bars = tenseBars(p.li, cutoffs)
    const level = stripLevel(bars)
    if (level) segs.push({ idx: k, x0: x(k), x1: x(k + 1), bars, level })
  })
  return segs
}
