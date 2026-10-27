// Source-art materials, not a guess about a real uniform. Keep this pure so
// a new source palette can be checked before committing a generated atlas.
export function materialFor(r, g, b) {
  if (b > r * 1.25 && b > g * 1.04 && b < 155) return 'equipment'
  // Orange/brown leather shares gold's luminance, but not its hue. The green
  // fraction keeps copper leather out of the yellow piping material.
  if (r > g * 1.12 && g > b * 1.35 && r > 85 && b < 115 && g - b > (r - b) * 0.55) return 'trim'
  return null
}
