import { teamChipColors } from '../../../../lib/teams.js'
import { NEUTRAL_FALLBACK_PAIR } from '../../../../lib/brandColors.js'
import { materialFor } from '../cutscene/ballpark/materials.js'

// The same identity chain as the club chips: affiliate's own researched colors, then its
// parent organization, then neutral. These are team-inspired colors, not a uniform claim.
export function batterPalette(teamId, overrides = {}) {
  const kit = teamChipColors(teamId)
  const equipment = kit?.primary ?? NEUTRAL_FALLBACK_PAIR[0]
  return { equipment, jersey: equipment, trim: kit?.secondary ?? NEUTRAL_FALLBACK_PAIR[1], ...overrides }
}

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

// Source-specific material regions. Preserve the wooden bat, gloves, face shadow and alpha.
// The waistband separates the cream shirt and trousers; the bat sits above the uniform.
export function recolorBatter(image, palette) {
  const targets = Object.fromEntries(Object.entries(palette).filter(([, v]) => v).map(([k, v]) => [k, rgb(v)]))
  const p = image.data
  for (let i = 0; i < p.length; i += 4) {
    if (p[i + 3] < 16) continue
    const r = p[i], g = p[i + 1], b = p[i + 2], y = Math.floor(i / 4 / image.width) / image.height
    let material = materialFor(r, g, b), reference = material === 'equipment' ? 90 : 195
    if (material === 'trim' && y < 0.3) material = null // wooden bat and helmet's bright rim stay neutral
    const cloth = r > 95 && r > g && g > b && g > r * 0.72 && b > r * 0.5 && r - g < 55 && g - b < 55
    if (!material && cloth && y >= 0.24) { material = y < 0.49 ? 'jersey' : 'pants'; reference = 232 }
    const target = targets[material]
    if (!target) continue
    const light = Math.max(r, g, b) / reference
    for (let c = 0; c < 3; c++) p[i + c] = Math.min(255, target[c] * Math.min(1, light) + Math.max(0, light - 1) * 105)
  }
  return image
}
