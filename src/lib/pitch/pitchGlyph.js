// The path of each pitch mark's shape, drawn at the origin: the family is the shape
// (docs/pitch-types.md). Pure, so any surface can draw a pitchMark(code) without
// importing another screen's files: the player page arsenal and the Now Pitching
// card both do. This file picks no colour; the colour is pitchMark's.
const SHAPES = {
  circle: (r) => `M${r} 0A${r} ${r} 0 1 0 ${-r} 0A${r} ${r} 0 1 0 ${r} 0Z`,
  diamond: (r) => `M0 ${-1.3 * r}L${1.3 * r} 0L0 ${1.3 * r}L${-1.3 * r} 0Z`,
  square: (r) => `M${-0.9 * r} ${-0.9 * r}H${0.9 * r}V${0.9 * r}H${-0.9 * r}Z`,
  triangle: (r) => `M0 ${-1.2 * r}L${1.1 * r} ${0.9 * r}H${-1.1 * r}Z`,
  hexagon: (r) => `M${r} 0L${r / 2} ${0.87 * r}H${-r / 2}L${-r} 0L${-r / 2} ${-0.87 * r}H${r / 2}Z`,
}

export const glyphD = (shape, r) => (SHAPES[shape] ?? SHAPES.hexagon)(r)
