// WCAG 2.x relative luminance / contrast ratio — for picking a text color
// against an arbitrary background hex (e.g. a team's brand color) rather than
// assuming light-on-dark always reads. Pure math, no app-specific knowledge.
// Also the one hex -> rgb -> hsl conversion the logo and stamp modules share.

// `#rgb`, `#rrggbb` or `#rrggbbaa`, with or without the `#`; alpha is ignored.
export function toRgb(hex) {
  let h = hex.replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length > 6) h = h.slice(0, 6)
  const n = parseInt(h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// Saturation and lightness, both 0-1, of an [r, g, b] triple (0-255).
export function rgbToHsl([r, g, b]) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let s = 0
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  }
  return { s, l }
}

// WCAG relative luminance: 0 (black) to 1 (white). Exported because "which of
// these hexes is the DARKEST" is the same question in other clothes, and
// answering it off the hex digits gets yellow badly wrong — the green channel
// carries three quarters of the weight (src/lib/stamp/stampInk.js).
export function relativeLuminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// WCAG contrast ratio between two hex colors: 1 (identical) to 21 (black/white).
export function contrastRatio(hexA, hexB) {
  const [l1, l2] = [relativeLuminance(hexA), relativeLuminance(hexB)]
  const [light, dark] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (light + 0.05) / (dark + 0.05)
}

// Whichever of `light`/`dark` contrasts better against `bg` — so a pale/gold
// background correctly falls through to dark text instead of assuming every
// brand color wants white-on-top.
export function readableTextColor(bg, light, dark) {
  return contrastRatio(bg, light) >= contrastRatio(bg, dark) ? light : dark
}
