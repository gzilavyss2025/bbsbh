// The window a park card crops the drawing to: the fixed frame with the empty sky above this
// park's highest mark cut off. Pure. Every park is drawn at one scale (a foot to a unit) in a
// frame sized for the deepest wall on file, so a typical park left a band of sky above its
// center-field sign (Gary, 2026-10-21). The window keeps the scale and the bottom of the frame;
// it never rescales, so a deep park still stands taller than a shallow one, and only a card's
// height changes from park to park.
import { buildFieldGeometry, diagramInput, VIEWBOX, wallStroke } from '../ballparkGeometry.js'

const SIGN_HALF = 10 // a distance sign (18-unit type) is centred on its point; keep its upper half in view
export const SKY_PAD = 4 // the paper left above the highest mark

// The y of each point in a fence segment's path ("M x y L x y ...").
const pathYs = (d) => [...d.matchAll(/[ML]\s*-?[\d.]+\s+(-?[\d.]+)/g)].map((m) => Number(m[1]))

// Where this park's window starts: SKY_PAD above its highest distance sign or wall edge.
export function skyTop(layout) {
  const g = buildFieldGeometry(diagramInput(layout))
  const marks = g.labels.map((l) => l.y - SIGN_HALF)
  for (const s of g.fenceSegs) for (const y of pathYs(s.d)) marks.push(y - wallStroke(s.h) / 2)
  if (!marks.length) return 0
  return Math.max(0, Math.floor(Math.min(...marks) - SKY_PAD))
}

// The window itself. `x` and `w` narrow it at the sides for a card that wants that (the player
// page's innings art); the default is the full frame's width. `percent` places an HTML label
// over the window, as a share of its box.
export function parkWindow(layout, { x = 0, w = VIEWBOX.w } = {}) {
  const top = skyTop(layout)
  const h = VIEWBOX.h - top
  return {
    viewBox: `${x} ${top} ${w} ${h}`,
    aspectRatio: `${w} / ${h}`,
    percent: (p) => ({ left: ((p.x - x) / w) * 100, top: ((p.y - top) / h) * 100 }),
  }
}
