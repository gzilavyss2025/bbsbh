import { logoCdnUrl } from '../logoCdn.js'
import { monoLogoFingerprint, monoLogoParts, monoLogoSvg } from '../logoMono.js'

// Pick an actual distinct secondary mark from the existing CDN variants.
// loadSvg supplies sanitized SVG, never arbitrary inline markup. No team-specific
// exceptions, invented logos, or repeated primary mark when a variant is absent.
export async function secondaryLogoSvg(teamId, sourceVariant, loadSvg) {
  let primary
  try { primary = await loadSvg(logoCdnUrl(teamId, sourceVariant)) } catch { return null }
  if (!primary) return null
  const fingerprint = monoLogoFingerprint(primary)
  for (const variant of ['primary', 'cap', 'wordmark']) {
    if (variant === sourceVariant) continue
    try {
      const svg = await loadSvg(logoCdnUrl(teamId, variant))
      if (!svg || monoLogoFingerprint(svg) === fingerprint) continue
      return monoLogoSvg(svg, { maskId: `heritage-secondary-${teamId}-${variant}`, pins: badgeFieldPins(svg) })
    } catch { /* A missing variant leaves the next real mark a chance. */ }
  }
  return null
}

// A badge (the Brewers' roundel) paints a dark disc first and draws its lettering
// and art over it in light colours. The automatic pass inks the disc AND the gold
// art on it, which prints a solid blob on the navy band. When the first shape is
// dark and light shapes sit on it, that disc's colour is the band showing through:
// knock it out and ink everything else. Any other mark keeps the automatic pass.
export function badgeFieldPins(svg) {
  const parts = monoLogoParts(svg)
  const field = parts[0]?.fill?.toLowerCase()
  if (!field || hexLightness(field) > 0.35 || !parts.some((p) => p.auto === 'knockout')) return null
  const pins = {}
  for (const part of parts) {
    if (part.fill?.toLowerCase() === 'none') continue
    pins[part.index] = part.fill?.toLowerCase() === field ? 'knockout' : 'ink'
  }
  return pins
}

function hexLightness(value) {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)?.[1]
  if (!hex) return 1
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  return (Math.max(r, g, b) + Math.min(r, g, b)) / 2
}
