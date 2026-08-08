import LEAGUE_LOGO_MANIFEST from '../../lib/data/league-logo-manifest.json' with { type: 'json' }

// The two LEAGUE knockout marks a Game Log book cover can carry instead of a
// club crest (src/lib/books.js's `coverMark`). Art and manifest are both
// precomputed by scripts/gen-league-logos.mjs; nothing here fetches or
// converts anything at render time.
//
// The two shapes are not interchangeable — MLB is a near-square badge, MiLB a
// wide wordmark — so every consumer needs the mark's own viewBox rather than
// assuming a square slot the way a club crest can (PassportCover.jsx's
// CREST_BOX). That viewBox is read out of the generated art at build time and
// recorded in the manifest, so the numbers here can never disagree with the
// files they describe.
const LEAGUE_MARK_BASE = '/data/logos/league'

export const LEAGUE_MARK_LABELS = { mlb: 'MLB', milb: 'MiLB' }

export function leagueMarkUrl(mark) {
  return LEAGUE_LOGO_MANIFEST[mark] ? `${LEAGUE_MARK_BASE}/${mark}.svg` : null
}

// `[minX, minY, width, height]`, or null for a mark this build has no art for
// — the caller drops the crest rather than drawing an empty box, the same
// degrade PassportCover already takes for a club with no knockout file.
export function leagueMarkBox(mark) {
  const raw = LEAGUE_LOGO_MANIFEST[mark]?.viewBox
  if (!raw) return null
  const parts = raw.trim().split(/\s+/).map(Number)
  return parts.length === 4 && parts.every(Number.isFinite) ? parts : null
}
