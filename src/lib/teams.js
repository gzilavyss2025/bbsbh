// Static configuration that never needs a network call.

// The user scores Brewers games most often, so we pin them to the top of the
// slate. teamId 158 is the Milwaukee Brewers in the MLB Stats API.
export const PINNED_TEAM_ID = 158
export const PINNED_TEAM_NAME = 'Milwaukee Brewers'

// MLB Stats API sportId codes. sportId 1 is MLB; the minors use the codes
// below. MiLB data quality varies, so screens that use these must degrade
// gracefully when fields are missing.
export const SPORT_IDS = {
  MLB: 1,
  AAA: 11,
  AA: 12,
  'A+': 13,
  A: 14,
  // Rookie level — covers every complex/rookie league (ACL/FCL/DSL/VSL),
  // disambiguated only by league.name on a split, not a separate sportId.
  ROK: 16,
}

// Every level we search across when the user types a team name.
export const SEARCHABLE_SPORT_IDS = [1, 11, 12, 13, 14]

// A team's slug-safe abbreviation, derived from a schedule/roster payload's
// own team object. Some hydrations omit `abbreviation` (thin MiLB rows,
// hydration outages); an empty one would build a broken/ambiguous matchup
// slug or stat-split label, so fall back to the first letters of the name.
export function teamAbbr(team) {
  return (
    team?.abbreviation ||
    (team?.teamName || team?.name || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  )
}

// The level toggle, in display order — one definition for every screen that
// offers the MLB/AAA/AA/A+/A switch (the slate, the logo sheet), so the two
// can't drift.
export const LEVELS = [
  { label: 'MLB', sportId: SPORT_IDS.MLB },
  { label: 'AAA', sportId: SPORT_IDS.AAA },
  { label: 'AA', sportId: SPORT_IDS.AA },
  { label: 'A+', sportId: SPORT_IDS['A+'] },
  { label: 'A', sportId: SPORT_IDS.A },
]

export const SPORT_LABEL = {
  1: 'MLB',
  11: 'AAA',
  12: 'AA',
  13: 'A+',
  14: 'A',
  16: 'ROK',
}

// MiLB-only, ordered LOW-to-HIGH — drives the player page's level-progression
// card (the climb toward MLB), the opposite direction from LEVELS above
// (which is MLB-first, for the slate/logo-sheet level switcher).
export const MILB_LEVELS = [
  { label: 'ROK', sportId: SPORT_IDS.ROK },
  { label: 'A', sportId: SPORT_IDS.A },
  { label: 'A+', sportId: SPORT_IDS['A+'] },
  { label: 'AA', sportId: SPORT_IDS.AA },
  { label: 'AAA', sportId: SPORT_IDS.AAA },
]

// ---------------------------------------------------------------------------
// Team logos
//
// The same MLB platform that serves our data (statsapi.mlb.com) also hosts a
// team-logo CDN, keyed by the exact team ids we already carry everywhere in
// this app. Every club — MLB and MiLB alike — is drawn to one square viewBox,
// so:
//   • dimensions are identical across every team (no per-team sizing);
//   • it's SVG, so it stays crisp at any render size AND doubles as a clean,
//     scalable reference for sketching a team's logo by hand;
//   • there's no new dependency, asset checkout, or license bundling — it's the
//     same source of truth as the schedule and box score.
//
// Coverage of the lower MiLB levels isn't total, so this is treated as
// decorative: callers must render it behind a graceful fallback (see
// components/TeamLogo.jsx), consistent with the rest of the app's "degrade,
// don't assume" handling of MiLB data.
//
// To pull a reference logo at any size for sketching, open the URL directly —
// e.g. https://www.mlbstatic.com/team-logos/158.svg for the Brewers (158).
const LOGO_BASE = 'https://www.mlbstatic.com/team-logos'

// The same CDN serves three *distinct* marks per club — the cap logo, the full
// primary logo, and the script wordmark — each keyed by the team id we already
// carry, under a subfolder path. Verified live across MLB and MiLB (every level
// returns real, different art, not the base logo echoed back). This gives the
// sketcher more than one thing to draw for a team instead of the same roundel
// every time. We use the `-on-light` treatment throughout since every surface
// that renders a logo is the app's light "paper". There is NO alternate /
// per-uniform / home-road mark on this CDN (those paths 404), so this is the
// full set. `base` is the plain `{id}.svg` default that every existing caller
// already uses.
export const LOGO_VARIANTS = [
  { key: 'primary', label: 'Primary', path: 'team-primary-on-light' },
  { key: 'cap', label: 'Cap', path: 'team-cap-on-light' },
  { key: 'wordmark', label: 'Wordmark', path: 'team-wordmark-on-light' },
]

export function teamLogoUrl(teamId, variant = 'base') {
  if (!teamId) return null
  if (variant === 'base') return `${LOGO_BASE}/${teamId}.svg`
  const v = LOGO_VARIANTS.find((x) => x.key === variant)
  return v ? `${LOGO_BASE}/${v.path}/${teamId}.svg` : `${LOGO_BASE}/${teamId}.svg`
}

// The same CDN also serves a plain MLB league mark (the silhouetted-batter
// logo) under team id 1 in the "league" subfolder — verified live, a
// real logo, not the base logo echoed back. Used for the prospect-rank
// badges, which aren't tied to any one club.
export function leagueLogoUrl() {
  return `${LOGO_BASE}/league-on-light/1.svg`
}

// ---------------------------------------------------------------------------
// Player headshots
//
// The same mlbstatic CDN that serves team logos also serves per-player
// headshots, keyed by the person id we already carry everywhere (the same id
// that drives /people/{id}). Verified live: returns a 1:1 transparent "silo"
// cutout (426×426 at w_426, palette PNG + tRNS), the subject already framed
// consistently — head crown ~3.3% from the top, shoulders bleeding off the
// bottom — so a plain CSS top-center cover crop (see .shot img) reframes it to
// 3:4 with no per-image work. The `d_people:generic:headshot:silo` transform
// baked into the path means the CDN itself serves a transparent silhouette PNG
// for an id it has no photo for (verified: the plain silo URL 404s for an
// unknown id, this default returns 200 image/png) — so this degrades one more
// step than logos do (a true network/404 still drops to the monogram in
// components/Headshot.jsx). MiLB coverage is partial, hence the same
// "decorative, render behind a fallback" rule as logos.
const HEADSHOT_BASE = 'https://img.mlbstatic.com/mlb-photos/image/upload'

export function headshotUrl(personId, width = 213) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/d_people:generic:headshot:silo:current.png/w_${width},q_auto:best/v1/people/${personId}/headshot/silo/current`
}
