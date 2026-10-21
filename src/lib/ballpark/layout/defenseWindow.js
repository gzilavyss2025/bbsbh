// Where the fielders stand on a park drawing. Pure; shared by the lineup page's FieldCard and
// the innings page's Field tab (DefenseDiamond), so the two cannot drift apart. Both crop the
// drawing with parkWindow.js.

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
