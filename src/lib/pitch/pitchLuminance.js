// The even-brightness rule for the pitch palette (#2974, docs/pitch-types.md).
// Pure: give it the paper grounds as hexes and it returns the failures.
// scripts/check-contrast.mjs runs it against the shipped tokens in both themes.
import { contrastRatio, relativeLuminance } from '../contrast.js'
import { PITCH_TYPES, pitchMark } from './pitchTypes.js'

// Non-text UI (WCAG 1.4.11): a mark must clear this on every paper it sits on.
export const MARK_MIN = 3
// Widest allowed spread of WCAG luminance across the 15 labeled colours. The
// palette was tuned to 0.207–0.210; 0.02 leaves room to nudge a hue, not to
// bring back a pastel. Do not loosen it — retune the hex.
export const LUMINANCE_BAND = 0.02

export function auditPitchPalette(grounds, types = PITCH_TYPES, unknown = pitchMark('UN')) {
  const failures = []
  for (const t of [...types, unknown]) {
    for (const [name, hex] of Object.entries(grounds)) {
      const r = contrastRatio(t.color, hex)
      if (r < MARK_MIN) failures.push(`${t.code} ${t.color} is ${r.toFixed(2)}:1 on ${name} ${hex} (need ${MARK_MIN}:1)`)
    }
  }
  const lums = types.map((t) => relativeLuminance(t.color))
  const lo = Math.min(...lums)
  const hi = Math.max(...lums)
  if (hi - lo > LUMINANCE_BAND) {
    const at = (v) => types[lums.indexOf(v)].code
    failures.push(`luminance spread ${(hi - lo).toFixed(3)} (${at(lo)} ${lo.toFixed(3)} to ${at(hi)} ${hi.toFixed(3)}) is over the ${LUMINANCE_BAND} band`)
  }
  const un = relativeLuminance(unknown.color)
  if (un >= lo) failures.push(`UN ${unknown.color} (${un.toFixed(3)}) must stay quieter than the band (below ${lo.toFixed(3)})`)
  return failures
}
