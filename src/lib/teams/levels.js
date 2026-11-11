// Levels and sportIds: the MLB/MiLB level vocabulary every screen shares.
// Split out of teams.js (#3039); teams.js re-exports it.

// The default club: the slate pins the user's favorite team (useFavoriteTeam),
// and this is the fallback until they pick one (preferences.js `club`). Some
// tool pages (LogoSheet, GamePhotosPage) still start from it directly.
// teamId 158 is the Milwaukee Brewers in the MLB Stats API.
export const PINNED_TEAM_ID = 158

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

// Every level we search across when the user types a team name. Three other
// files hand-copy this exact value rather than importing it (each is bundled
// separately from browser-facing src/ — see their own headers for why):
// scripts/gen-teams.mjs, api/_lib/cards.js, and src/lib/account/preferences.js's
// LEVEL_SPORT_IDS. scripts/check-searchable-sport-ids.mjs fails `npm run lint`
// if any of the four drifts from this one — update this array first, then the
// other three (issue #852).
export const SEARCHABLE_SPORT_IDS = [1, 11, 12, 13, 14]

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
  17: 'WINTER', // one id for all four winter leagues — src/lib/winter/leagues.js
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
