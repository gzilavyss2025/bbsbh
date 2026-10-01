import { useImageMissing } from './images/useImageMissing.js'
import { milbWpaMarkUrl } from '../lib/milbColors.js'
import { teamLogoUrl } from '../lib/teams.js'

// The MiLB counterpart to useWpaLogo.js — same probe-and-fallback shape (an
// SVG <image> inside a <pattern> can't report its own 404, so a miss would
// otherwise paint a band with no marks on it at all, silently), reading
// milbColors.js's own Home/Away resolution chain instead of the MLB-keyed
// one. A miss — most likely a wordmark the CDN doesn't actually carry for
// this affiliate — falls back to the plain base mark, which every club has.
export function useMilbWpaLogo(teamId, variant, draft) {
  const src = milbWpaMarkUrl(teamId, variant, draft)
  const missing = useImageMissing(src)

  return { src: missing ? teamLogoUrl(teamId, 'base') : src, recolor: null }
}
