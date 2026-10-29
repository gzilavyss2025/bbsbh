import { logoCdnUrl } from '../logoCdn.js'
import { monoLogoFingerprint, monoLogoSvg } from '../logoMono.js'

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
      return monoLogoSvg(svg, { maskId: `heritage-secondary-${teamId}-${variant}` })
    } catch { /* A missing variant leaves the next real mark a chance. */ }
  }
  return null
}
