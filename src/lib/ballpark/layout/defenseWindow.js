// Where the fielders stand on a park drawing, and the window the defense cards crop it to.
// Pure; shared by the lineup page's FieldCard and the innings page's Field tab (DefenseDiamond),
// so the two cannot drift apart.
import { buildFieldGeometry, diagramInput, PLOT_SKY_CROP, VIEWBOX } from '../ballparkGeometry.js'

// Each position's spot, in the drawing's own coordinates (feet off home plate, 1:1 with SVG units).
export const DEFENSE_SPOTS = {
  CF: { x: 310, y: 182 },
  LF: { x: 156, y: 238 },
  RF: { x: 464, y: 238 },
  SS: { x: 222, y: 338 },
  '2B': { x: 398, y: 338 },
  '3B': { x: 188, y: 446 },
  '1B': { x: 432, y: 446 },
  P: { x: 310, y: 442 },
  C: { x: 310, y: 512 },
}

const MAX_CROP = 72 // never crop past here: ~12px of dead sky off the shared plot window
const SIGN_HALF = 14 // a distance sign is centred on its point; keep its upper half in view

// The window onto the fixed viewBox for one park: the shared plot window with the dead sky above
// the highest distance sign cropped off, up to MAX_CROP. Never a rescale. A park whose sign
// draws high (Comerica's CF) keeps the shared crop.
export function defenseWindow(layout) {
  const { labels } = buildFieldGeometry(diagramInput(layout))
  const highest = labels.length ? Math.min(...labels.map((l) => l.y)) : PLOT_SKY_CROP + SIGN_HALF
  const top = Math.round(Math.min(MAX_CROP, Math.max(PLOT_SKY_CROP, highest - SIGN_HALF)))
  const h = VIEWBOX.h - top
  return {
    viewBox: `0 ${top} ${VIEWBOX.w} ${h}`,
    aspectRatio: `${VIEWBOX.w} / ${h}`,
    percent: ({ x, y }) => ({ left: (x / VIEWBOX.w) * 100, top: ((y - top) / h) * 100 }),
  }
}
