// WCAG 2.x relative luminance / contrast ratio — for picking a text color
// against an arbitrary background hex (e.g. a team's brand color) rather than
// assuming light-on-dark always reads. Pure math, no app-specific knowledge.

function hexToRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}

function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// WCAG contrast ratio between two hex colors: 1 (identical) to 21 (black/white).
export function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relLuminance(hexA), relLuminance(hexB)]
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (light + 0.05) / (dark + 0.05)
}

// Whichever of `light`/`dark` contrasts better against `bg` — so a pale/gold
// background correctly falls through to dark text instead of assuming every
// brand color wants white-on-top.
export function readableTextColor(bg, light, dark) {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark
}
