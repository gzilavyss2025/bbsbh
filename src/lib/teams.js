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
// 3:4 with no per-image work. MiLB coverage is partial, hence the same
// "decorative, render behind a fallback" rule as logos: components/Headshot.jsx
// and StatBox.jsx's PitcherPhoto both use the URL below (WITHOUT the CDN's
// `d_people:generic:headshot:silo` default-image transform some other
// integrations use), so a personId with no real photo on file 404s instead of
// silently serving the CDN's own generic gray silo placeholder — the miss is
// then distinguishable from a real photo and can fall back to something more
// useful (Headshot.jsx falls back further to the player's team logo, or a
// monogram with no team).
const HEADSHOT_BASE = 'https://img.mlbstatic.com/mlb-photos/image/upload'

export function realHeadshotUrl(personId, width = 213) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/headshot/silo/current`
}

// The `milb` context of the SAME CDN/personId — what milb.com's own team pages
// render. Verified live: a 426×640 portrait JPEG (a real photo on a colored
// backdrop, NOT a transparent silo cutout), and crucially present for many
// prospects whose `silo` variant 404s (they've no posed MLB studio shot yet).
// Same no-`d_people:generic` rule as realHeadshotUrl: a personId with no photo
// on file still 404s cleanly here, so it degrades to the team-logo fallback.
// Headshot.jsx uses this as the second rung of its chain — silo (preferred,
// matches the app's floating-cutout treatment) → milb (a real face for a
// prospect) → team logo → monogram.
export function milbHeadshotUrl(personId, width = 213) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/headshot/milb/current`
}

// ---------------------------------------------------------------------------
// Team colors
//
// One brand color per MLB club, hand-picked (not sourced from the API —
// statsapi carries no color field) for whichever of a club's usual colors is
// LEAST likely to be mistaken for another club's — favoring a distinctive
// accent (gold, orange, teal…) over yet another navy whenever a club has one,
// since roughly half the league's primary color is some shade of navy/blue.
// Decorative only: used to tint a headshot's background (see teamTintColor
// and components/Headshot.jsx) so a player reads at a glance as "this is a
// Team A face, that one's Team B" — a rough visual grouping, not a guarantee
// every possible matchup gets two clearly distinct hues (a run of same-
// division rivals can still share a color family). MLB clubs only — MiLB team
// ids have no entry and callers must degrade (see teamTintColor).
const TEAM_COLORS = {
  108: '#BA0021', // Angels
  109: '#A71930', // Diamondbacks
  110: '#DF4601', // Orioles
  111: '#BD3039', // Red Sox
  112: '#0E3386', // Cubs
  113: '#C6011F', // Reds
  114: '#E31937', // Guardians (red accent, not their navy)
  115: '#333366', // Rockies
  116: '#0C2340', // Tigers
  117: '#EB6E1F', // Astros (orange accent, not their navy)
  118: '#BD9B60', // Royals (gold accent, not their blue)
  119: '#005A9C', // Dodgers
  120: '#AB0003', // Nationals
  121: '#002D72', // Mets
  133: '#EFB21E', // Athletics (gold accent, not their dark green)
  134: '#FDB827', // Pirates
  135: '#2F241D', // Padres
  136: '#005C5C', // Mariners (Northwest green accent, not their navy)
  137: '#FD5A1E', // Giants
  138: '#C41E3A', // Cardinals
  139: '#F5D130', // Rays (yellow accent, not their navy)
  140: '#C0111F', // Rangers (red accent, not their navy)
  141: '#E8291C', // Blue Jays (red accent, not their blue)
  142: '#D31145', // Twins (red accent, not their navy)
  143: '#E81828', // Phillies
  144: '#CE1141', // Braves
  145: '#27251F', // White Sox
  146: '#00A3E0', // Marlins
  147: '#003087', // Yankees
  158: '#FFC52F', // Brewers (gold accent, not their navy)
}

// Every current MiLB affiliate's teamId -> its parent MLB org's teamId, so a
// farmhand's headshot can tint with his org's TEAM_COLORS entry the same way
// an MLB player's does (see teamTintColor). Generated from
// public/data/affiliates.json by scripts/gen-milb-team-colors.mjs — an org's
// farm system changes at most once a year (the offseason PDC realignment), so
// like milbHistory.js this is a hand-run regenerate, not a cron. Re-run that
// script after a realignment; don't hand-edit the block below.
// MILB_PARENT_ORG:BEGIN (generated by scripts/gen-milb-team-colors.mjs)
const MILB_PARENT_ORG = {
  561: 108, // Salt Lake Bees
  559: 108, // Rocket City Trash Pandas
  460: 108, // Tri-City Dust Devils
  526: 108, // Rancho Cucamonga Quakes
  2310: 109, // Reno Aces
  5368: 109, // Amarillo Sod Poodles
  419: 109, // Hillsboro Hops
  516: 109, // Visalia Rawhide
  568: 110, // Norfolk Tides
  418: 110, // Chesapeake Baysox
  493: 110, // Frederick Keys
  548: 110, // Delmarva Shorebirds
  533: 111, // Worcester Red Sox
  546: 111, // Portland Sea Dogs
  428: 111, // Greenville Drive
  414: 111, // Salem RidgeYaks
  451: 112, // Iowa Cubs
  553: 112, // Knoxville Smokies
  550: 112, // South Bend Cubs
  521: 112, // Myrtle Beach Pelicans
  416: 113, // Louisville Bats
  498: 113, // Chattanooga Lookouts
  459: 113, // Dayton Dragons
  450: 113, // Daytona Tortugas
  445: 114, // Columbus Clippers
  402: 114, // Akron RubberDucks
  437: 114, // Lake County Captains
  481: 114, // Hill City Howlers
  342: 115, // Albuquerque Isotopes
  538: 115, // Hartford Yard Goats
  486: 115, // Spokane Indians
  259: 115, // Fresno Grizzlies
  512: 116, // Toledo Mud Hens
  106: 116, // Erie SeaWolves
  582: 116, // West Michigan Whitecaps
  570: 116, // Lakeland Flying Tigers
  5434: 117, // Sugar Land Space Cowboys
  482: 117, // Corpus Christi Hooks
  573: 117, // Asheville Tourists
  3712: 117, // Fayetteville Woodpeckers
  541: 118, // Omaha Storm Chasers
  1350: 118, // Northwest Arkansas Naturals
  565: 118, // Quad Cities River Bandits
  3705: 118, // Columbia Fireflies
  238: 119, // Oklahoma City Comets
  260: 119, // Tulsa Drillers
  456: 119, // Great Lakes Loons
  6482: 119, // Ontario Tower Buzzers
  534: 120, // Rochester Red Wings
  547: 120, // Harrisburg Senators
  426: 120, // Wilmington Blue Rocks
  436: 120, // Fredericksburg Nationals
  552: 121, // Syracuse Mets
  505: 121, // Binghamton Rumble Ponies
  453: 121, // Brooklyn Cyclones
  507: 121, // St. Lucie Mets
  400: 133, // Las Vegas Aviators
  237: 133, // Midland RockHounds
  499: 133, // Lansing Lugnuts
  524: 133, // Stockton Ports
  484: 134, // Indianapolis Indians
  452: 134, // Altoona Curve
  477: 134, // Greensboro Grasshoppers
  3390: 134, // Bradenton Marauders
  4904: 135, // El Paso Chihuahuas
  510: 135, // San Antonio Missions
  584: 135, // Fort Wayne TinCaps
  103: 135, // Lake Elsinore Storm
  529: 136, // Tacoma Rainiers
  574: 136, // Arkansas Travelers
  403: 136, // Everett AquaSox
  401: 136, // Inland Empire 66ers
  105: 137, // Sacramento River Cats
  3410: 137, // Richmond Flying Squirrels
  461: 137, // Eugene Emeralds
  476: 137, // San Jose Giants
  235: 138, // Memphis Redbirds
  440: 138, // Springfield Cardinals
  443: 138, // Peoria Chiefs
  279: 138, // Palm Beach Cardinals
  234: 139, // Durham Bulls
  421: 139, // Montgomery Biscuits
  2498: 139, // Bowling Green Hot Rods
  233: 139, // Charleston RiverDogs
  102: 140, // Round Rock Express
  540: 140, // Frisco RoughRiders
  6324: 140, // Hub City Spartanburgers
  448: 140, // Hickory Crawdads
  422: 141, // Buffalo Bisons
  463: 141, // New Hampshire Fisher Cats
  435: 141, // Vancouver Canadians
  424: 141, // Dunedin Blue Jays
  1960: 142, // St. Paul Saints
  3898: 142, // Wichita Wind Surge
  492: 142, // Cedar Rapids Kernels
  509: 142, // Fort Myers Mighty Mussels
  1410: 143, // Lehigh Valley IronPigs
  522: 143, // Reading Fightin Phils
  427: 143, // Jersey Shore BlueClaws
  566: 143, // Clearwater Threshers
  431: 144, // Gwinnett Stripers
  6325: 144, // Columbus Clingstones
  432: 144, // Rome Emperors
  478: 144, // Augusta GreenJackets
  494: 145, // Charlotte Knights
  247: 145, // Birmingham Barons
  580: 145, // Winston-Salem Dash
  487: 145, // Kannapolis Cannon Ballers
  564: 146, // Jacksonville Jumbo Shrimp
  4124: 146, // Pensacola Blue Wahoos
  554: 146, // Beloit Sky Carp
  479: 146, // Jupiter Hammerheads
  531: 147, // Scranton/Wilkes-Barre RailRiders
  1956: 147, // Somerset Patriots
  537: 147, // Hudson Valley Renegades
  587: 147, // Tampa Tarpons
  556: 158, // Nashville Sounds
  5015: 158, // Biloxi Shuckers
  572: 158, // Wisconsin Timber Rattlers
  249: 158, // Wilson Warbirds
}
// MILB_PARENT_ORG:END

// `hex` -> `rgba(r, g, b, alpha)` so a team color can sit as a soft tint
// behind a headshot rather than a solid brand-colored block. `teamId` may be
// an MLB club or a MiLB affiliate (resolved to its parent org's color via
// MILB_PARENT_ORG). Returns null for a team with no known color (an
// unaffiliated/complex-league MiLB id) — callers should skip the tint
// entirely rather than render a wrong/generic color.
export function teamTintColor(teamId, alpha = 0.22) {
  const hex = TEAM_COLORS[teamId] ?? TEAM_COLORS[MILB_PARENT_ORG[teamId]]
  if (!hex) return null
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// The 30 MLB clubs' display names, split into [location, club nickname], keyed
// by the team id carried everywhere in the app. statsapi does expose these
// (locationName / teamName), but every surface that wants a name already has
// the id in hand and the identities are effectively immutable, so a static map
// beats threading extra name fields (or an extra fetch) through. MLB only — the
// name helpers below return null for a MiLB id, and callers degrade.
const MLB_TEAM_NAMES = {
  108: ['Los Angeles', 'Angels'],
  109: ['Arizona', 'Diamondbacks'],
  110: ['Baltimore', 'Orioles'],
  111: ['Boston', 'Red Sox'],
  112: ['Chicago', 'Cubs'],
  113: ['Cincinnati', 'Reds'],
  114: ['Cleveland', 'Guardians'],
  115: ['Colorado', 'Rockies'],
  116: ['Detroit', 'Tigers'],
  117: ['Houston', 'Astros'],
  118: ['Kansas City', 'Royals'],
  119: ['Los Angeles', 'Dodgers'],
  120: ['Washington', 'Nationals'],
  121: ['New York', 'Mets'],
  133: ['Athletics', 'Athletics'], // relocating club, MLB-branded simply "Athletics"
  134: ['Pittsburgh', 'Pirates'],
  135: ['San Diego', 'Padres'],
  136: ['Seattle', 'Mariners'],
  137: ['San Francisco', 'Giants'],
  138: ['St. Louis', 'Cardinals'],
  139: ['Tampa Bay', 'Rays'],
  140: ['Texas', 'Rangers'],
  141: ['Toronto', 'Blue Jays'],
  142: ['Minnesota', 'Twins'],
  143: ['Philadelphia', 'Phillies'],
  144: ['Atlanta', 'Braves'],
  145: ['Chicago', 'White Sox'],
  146: ['Miami', 'Marlins'],
  147: ['New York', 'Yankees'],
  158: ['Milwaukee', 'Brewers'],
}

// "Pittsburgh" — the club's place name, for prose like "Last game against
// Pittsburgh". Null for a MiLB id.
export function teamLocationName(teamId) {
  return MLB_TEAM_NAMES[teamId]?.[0] ?? null
}

// "Pirates" — the club's nickname, for prose like "@ Pirates". Null for a MiLB id.
export function teamClubName(teamId) {
  return MLB_TEAM_NAMES[teamId]?.[1] ?? null
}

// "Pittsburgh Pirates" — the full club name. Collapses the relocating
// Athletics' duplicated halves to a single "Athletics". Null for a MiLB id.
export function teamFullName(teamId) {
  const t = MLB_TEAM_NAMES[teamId]
  if (!t) return null
  return t[0] === t[1] ? t[1] : `${t[0]} ${t[1]}`
}

// A solid per-team accent for the favorite-team highlight (the pinned slate
// card's border/gradient + star). Distinct from TEAM_COLORS above: that map
// deliberately picks whichever color is LEAST likely to be confused with
// another club side-by-side, favoring a distinctive accent over yet another
// navy — but the favorite highlight is never shown next to another team's, so
// it's free to use a club's own truest, darkest signature color even where
// that's navy. Only the Brewers currently differ from TEAM_COLORS' pick.
const FAVORITE_ACCENT_OVERRIDES = {
  158: '#12284B', // Brewers navy (TEAM_COLORS uses their gold to stay distinct from rivals)
}

// Returns a hex string, or null for a team with no known color (MiLB — this
// map is MLB-only, same coverage as TEAM_COLORS). Callers should degrade to a
// fixed default rather than render no accent at all.
export function favoriteAccentColor(teamId) {
  return FAVORITE_ACCENT_OVERRIDES[teamId] || TEAM_COLORS[teamId] || null
}
