// The mlbstatic team-logo CDN's base URL and per-variant subfolder paths — a
// leaf module with no other imports, so scripts/lib/mono-logo-art.mjs (a
// plain Node script, not a Vite module) can build the exact same CDN URLs
// teams.js does without pulling in teams.js's whole dependency graph
// (tuningStore, customMarks, brandColors — none of it relevant to just
// knowing where a club's art lives).
export const LOGO_CDN_BASE = 'https://www.mlbstatic.com/team-logos'

// See teams.js's teamLogoUrl for the full story on these three — verified
// live to return real, distinct art across MLB and MiLB, not the base logo
// echoed back.
export const LOGO_VARIANTS = [
  { key: 'primary', label: 'Primary', path: 'team-primary-on-light' },
  { key: 'cap', label: 'Cap', path: 'team-cap-on-light' },
  { key: 'wordmark', label: 'Wordmark', path: 'team-wordmark-on-light' },
]

export function logoCdnUrl(teamId, variant = 'base') {
  if (variant === 'base') return `${LOGO_CDN_BASE}/${teamId}.svg`
  const v = LOGO_VARIANTS.find((x) => x.key === variant)
  return v ? `${LOGO_CDN_BASE}/${v.path}/${teamId}.svg` : `${LOGO_CDN_BASE}/${teamId}.svg`
}
