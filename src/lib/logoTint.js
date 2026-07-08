// Derive a soft background wash for a team from its OWN logo colors, so the
// full-color mark reads cleanly on it with no border or drop shadow. The
// mlbstatic logo CDN serves its SVGs cross-origin (Access-Control-Allow-Origin:
// *), so we read the actual fills out of the markup rather than guessing or
// maintaining a per-club color table — statsapi carries no color field, and
// there are hundreds of MiLB clubs. Pure string/number math; the fetching lives
// in api/person-fetch.js (fetchTeamLogoTint).

// Every hex fill in the SVG, normalized to 6-digit lowercase. Handles both
// `fill="#rgb"` / `fill="#rrggbb"` attributes and `fill:#…` inside a style="".
function extractHexColors(svg) {
  const out = []
  const re = /fill\s*[:=]\s*["']?\s*#([0-9a-f]{3}|[0-9a-f]{6})\b/gi
  let m
  while ((m = re.exec(svg))) {
    let h = m[1].toLowerCase()
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    out.push(h)
  }
  return out
}

function hexToRgb(h) {
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHsl([r, g, b]) {
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

// The brand color to build the wash from: the darkest reasonably-saturated
// color in the mark. Going dark guarantees the wash (a pale tint of it) sets
// off the whole logo without a border — the logo's dark parts contrast against
// the pale field, its light/white parts against the faint tint. Near-white
// (outlines, paper) and near-black are skipped; some saturation is required so
// a slightly-darker gray can't beat a real team color.
export function brandColorFromSvg(svg) {
  let best = null
  let bestScore = -1
  for (const h of extractHexColors(svg)) {
    const { s, l } = rgbToHsl(hexToRgb(h))
    if (l > 0.92 || l < 0.06) continue
    const score = (1 - l) * (0.4 + 0.6 * s)
    if (score > bestScore) {
      bestScore = score
      best = h
    }
  }
  return best
}

// Mix a color toward white to a pale tint (`frac` = how much brand color).
function mixWhite(h, frac) {
  const t = (c) => Math.round(c * frac + 255 * (1 - frac))
  return `#${hexToRgb(h).map((c) => t(c).toString(16).padStart(2, '0')).join('')}`
}

// The final background wash for a team, or null when the logo yielded no usable
// color (the caller then falls back to a plain neutral cell).
export function tintFromSvg(svg, frac = 0.16) {
  const brand = brandColorFromSvg(svg)
  return brand ? mixWhite(brand, frac) : null
}
