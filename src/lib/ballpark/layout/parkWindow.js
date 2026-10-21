// The window a park card crops the drawing to: the fixed frame with the empty sky above this
// park's highest mark cut off. Pure. Every park is drawn at one scale (a foot to a unit) in a
// frame sized for the deepest wall on file, so a typical park left a band of sky above its
// center-field sign (Gary, 2026-10-21). The window keeps the scale and the bottom of the frame;
// it never rescales, so a deep park still stands taller than a shallow one, and only a card's
// height changes from park to park.
import { buildFieldGeometry, diagramInput, VIEWBOX } from '../ballparkGeometry.js'

export const SKY_PAD = 4 // the paper left above the highest mark

// The window. `x` and `w` narrow it at the sides for a card that wants that (the player page's
// innings art); the default is the full frame's width. `geometry` is the drawing's own, for a
// caller that has built it already (BallparkDiagram). `percent` places an HTML label over the
// window, as a share of its box.
export function parkWindow(layout, { x = 0, w = VIEWBOX.w, geometry } = {}) {
  const g = geometry ?? buildFieldGeometry(diagramInput(layout))
  const top = Math.max(0, Math.floor(g.top - SKY_PAD))
  const h = VIEWBOX.h - top
  return {
    viewBox: `${x} ${top} ${w} ${h}`,
    aspectRatio: `${w} / ${h}`,
    percent: (p) => ({ left: ((p.x - x) / w) * 100, top: ((p.y - top) / h) * 100 }),
  }
}
