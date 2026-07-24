// Static configuration that never needs a network call.

import { readableTextColor } from './contrast.js'

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
// hydration outages, or a raw stats-split row's embedded team object — see
// statsLevels.js's combineToPool) — for those, prefer the real abbreviation
// from TEAM_ABBR (the 30 current MLB clubs) over guessing from the name,
// since a naive first-three-letters slice mangles multi-word cities (San
// Francisco -> "SAN" instead of "SF", Arizona -> "ARI" instead of "AZ", New
// York -> "NEW" for both the Mets and Yankees). Only MiLB/unrecognized ids
// fall through to that truncation.
export function teamAbbr(team) {
  return (
    team?.abbreviation ||
    TEAM_ABBR[team?.id] ||
    (team?.teamName || team?.name || '').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase()
  )
}

// The 30 current MLB clubs' real abbreviations (verified against
// public/data/teams.json, itself sourced from statsapi's own `abbreviation`
// field via gen-teams.mjs) — same id set/shape as TEAM_COLORS below.
const TEAM_ABBR = {
  108: 'LAA',
  109: 'AZ',
  110: 'BAL',
  111: 'BOS',
  112: 'CHC',
  113: 'CIN',
  114: 'CLE',
  115: 'COL',
  116: 'DET',
  117: 'HOU',
  118: 'KC',
  119: 'LAD',
  120: 'WSH',
  121: 'NYM',
  133: 'ATH',
  134: 'PIT',
  135: 'SD',
  136: 'SEA',
  137: 'SF',
  138: 'STL',
  139: 'TB',
  140: 'TEX',
  141: 'TOR',
  142: 'MIN',
  143: 'PHI',
  144: 'ATL',
  145: 'CWS',
  146: 'MIA',
  147: 'NYY',
  158: 'MIL',
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
// that renders a logo is the app's light "paper" — including the navy section
// mastheads on the lineup page, which force the mark to solid white with a CSS
// filter (see index.css's .metricbar__logo) rather than pulling the CDN's own
// `-on-dark` variant, which keeps each club's REAL colors (verified live: only
// a mostly-monochrome mark like the Yankees' actually turns white there; a
// multicolor mark like the Brewers' does not) — not the uniform white lockup
// this app wants on that one dark surface. There is NO alternate /
// per-uniform / home-road mark on this CDN (those paths 404), so this is the
// full set. `base` is the plain `{id}.svg` default that every existing caller
// already uses.
export const LOGO_VARIANTS = [
  { key: 'primary', label: 'Primary', path: 'team-primary-on-light' },
  { key: 'cap', label: 'Cap', path: 'team-cap-on-light' },
  { key: 'wordmark', label: 'Wordmark', path: 'team-wordmark-on-light' },
]

// Teams whose `base` mark's own design already bakes in a light/white ring or
// outline around its main shape (Cubs' white-bordered roundel, Astros' navy
// circle, the Blue Jays' outlined bird, the Brewers' outlined glove) — verified
// live by rendering all 30 clubs' base marks through the masthead's white
// filter (.metricbar__logo--white, index.css): every OTHER club flattens to a
// clean white silhouette, but these four collapse into an unreadable solid
// blob, since the filter can't tell that ring apart from the shape it
// encloses once both become the same color. These four render in their real
// CDN colors instead, which already read fine directly against the navy bar.
export const MASTHEAD_LOGO_NATURAL_COLOR = new Set([
  112, // Cubs
  117, // Astros
  141, // Blue Jays
  158, // Brewers
])

// The masthead logo's className for `teamId` — the white-filter treatment
// (see index.css's .metricbar__logo--white) for most clubs, or the plain
// (unfiltered, real-colored) mark for the small exception set above that
// flattens into an unreadable blob under that filter.
export function mastheadLogoClass(teamId) {
  return MASTHEAD_LOGO_NATURAL_COLOR.has(teamId) ? 'metricbar__logo' : 'metricbar__logo metricbar__logo--white'
}

// Teams/treatments whose local art is a hand-flattened/recolored SVG (every
// path recolored off the official multicolor logo) rather than a
// photographed/cropped PNG like every other curated treatment. Keyed
// `${teamId}:${treatment}` since the same club's Alternate and Alternate 2
// can differ. Single source of truth for both localLogoUrl below and Team
// Color Lab's own tiles — grows as more art is added in whatever format
// it's supplied in.
const ALT_LOGO_SVG = new Set([
  '118:alternate', // Royals — same recolored-white KC mark as Main, reused here (main-overrides/KC.svg copied to alternate/KC.svg)
  '147:alternate', // Yankees — the plain mlbstatic base mark (hat-and-bat crest), fill recolored from its default #132448 to #0C2340
])

// Teams whose Alternate mark is the plain, unmodified mlbstatic CDN base logo
// (teamLogoUrl(teamId, 'base')) rather than any procured local asset — no
// hand-cropped PNG, no recolored SVG. The tile still tints with ALT_COLORS'
// curated background; only the mark itself is the stock CDN art.
const ALT_USES_BASE_LOGO = new Set([
  133, // Athletics — no curated Alternate art; the real multicolor A's mark on the secondary gold tile
  108, // Angels — same plain CDN mark as Main, just re-paired with a grey tile for their Away Grey jersey
])

// Teams with no real City Connect uniform at all (as opposed to one whose art
// just hasn't been procured yet) — Team Color Lab skips the tile entirely
// rather than showing an empty placeholder that implies one is coming.
const NO_CITY_CONNECT = new Set([
  147, // Yankees — opted out of the program
])

export function hasCityConnect(teamId) {
  return !NO_CITY_CONNECT.has(teamId)
}

// Same idea as ALT_USES_BASE_LOGO, but for the Alternate 2 treatment.
const ALT2_USES_BASE_LOGO = new Set([
  118, // Royals — the plain CDN mark is already navy #004687 (Main's own is a locally recolored white copy)
])

// Same idea as ALT_USES_BASE_LOGO, but for the Alternate 4 treatment.
const ALT4_USES_BASE_LOGO = new Set([
  141, // Blue Jays — same plain CDN mark as Main, re-paired with a grey tile for their Away Grey jersey
])

// Where a procured Alternate/City Connect logo for `teamId`/`treatment` is
// expected — hand-curated, transparent-cropped art checked into public/, since
// the mlbstatic CDN carries no such marks (see the LOGO_VARIANTS comment
// above). Filename is the club's real abbreviation, already the single
// source of truth for spelling a club's short code everywhere else in this
// app. Deliberately has NO team-id whitelist: coverage grows purely by
// dropping a new file into public/team-logos/{treatment}/ — a missing file
// 404s and callers (TeamLogo's fallback chain, Team Color Lab's
// TreatmentLogo) degrade gracefully, so there's no manifest to hand-maintain.
// Never called for 'main' — that treatment renders the CDN base logo instead.
export function localLogoUrl(teamId, treatment) {
  const abbr = teamAbbr({ id: teamId })
  if (!abbr) return null
  const ext = ALT_LOGO_SVG.has(`${teamId}:${treatment}`) ? 'svg' : 'png'
  return `/team-logos/${treatment}/${abbr}.${ext}`
}

export function teamLogoUrl(teamId, variant = 'base') {
  if (!teamId) return null
  if (variant === 'alternate' && ALT_USES_BASE_LOGO.has(teamId)) return `${LOGO_BASE}/${teamId}.svg`
  if (variant === 'alternate-2' && ALT2_USES_BASE_LOGO.has(teamId)) return `${LOGO_BASE}/${teamId}.svg`
  if (variant === 'alternate-4' && ALT4_USES_BASE_LOGO.has(teamId)) return `${LOGO_BASE}/${teamId}.svg`
  if (
    variant === 'alternate' ||
    variant === 'city-connect' ||
    variant === 'alternate-2' ||
    variant === 'alternate-3' ||
    variant === 'alternate-4'
  )
    return localLogoUrl(teamId, variant)
  // A locally hand-edited recolor of the Main mark (mainOverrideLogoUrl,
  // MAIN_OVERRIDES below) rather than the plain CDN base logo — for the
  // handful of clubs whose base mark doesn't read against its new tinted
  // tile (e.g. a navy-outlined mark on a navy fill).
  if (variant === 'main-recolor') return mainOverrideLogoUrl(teamId)
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

// Alternate/City Connect tile-background colors — hand-curated together with
// each team's curated logo file (localLogoUrl above), since these marks don't
// carry an official three-color set the way Main does (teamColorSwatches
// below). Single source of truth for Team Color Lab's swatch tiles AND the
// home-page game card's jersey-variant background (treatmentBgColor below) —
// moved here so both read the same curated set rather than drifting. Each
// entry is a small swatch list; the one flagged `bg: true` is the color
// actually used as a fill. A team with no entry here has no known background
// yet — callers should leave their surface plain rather than render nothing.
// Rockies' hex mirrors TeamColorLab's own proposed Primary override (that
// page's PRIMARY_OVERRIDE) — kept as a literal here since this is a narrow,
// opt-in background only shown when the Alternate treatment itself is shown,
// not a promotion of that proposal into the app's real teamPrimaryColor.
export const ALT_COLORS = {
  108: [{ label: 'Silver', hex: '#C4CED4', bg: true }], // Angels — same plain CDN mark as Main, on grey for Away Grey
  120: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Nationals — Road Grey jersey
  138: [{ label: 'Background', hex: '#9DDFFF', bg: true }], // Cardinals — the bird-on-bat mark
  115: [{ label: 'Primary', hex: '#33006F', bg: true }], // Rockies
  118: [{ label: 'Baby Blue', hex: '#6DADF4', bg: true }], // Royals
  141: [{ label: 'All Blue', hex: '#041E42', bg: true }], // Blue Jays — jay-head mark (alternate/TOR.png)
  109: [
    { label: 'Primary', hex: '#A71930', bg: true },
    { label: 'Third', hex: '#30CED8' },
  ], // Diamondbacks
  112: [
    { label: 'Primary', hex: '#0E3386', bg: true },
    { label: 'Secondary', hex: '#CC3433' },
  ], // Cubs
  110: [
    { label: 'Primary', hex: '#DF4601' },
    { label: 'Secondary', hex: '#000000', bg: true },
  ], // Orioles
  111: [{ label: 'Background', hex: '#0C2340', bg: true }], // Red Sox
  113: [
    { label: 'Primary', hex: '#C6011F', bg: true },
    { label: 'Secondary', hex: '#000000' },
  ], // Reds
  114: [{ label: 'Background', hex: '#00385D', bg: true }], // Guardians
  119: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Dodgers
  133: [
    { label: 'Primary', hex: '#003831' },
    { label: 'Secondary', hex: '#EFB21E', bg: true },
    { label: 'Third', hex: '#A2AAAD' },
  ], // Athletics
  135: [{ label: 'Background', hex: '#2F241D', bg: true }], // Padres
  136: [{ label: 'Background', hex: '#F5F0E1', bg: true }], // Mariners — offwhite, for their Home White jersey
  137: [
    { label: 'Secondary', hex: '#27251F' },
    { label: 'Third', hex: '#EFD19F', bg: true },
  ], // Giants — same Secondary/Third pair as Main; background is Third (Cream)
  139: [
    { label: 'Primary', hex: '#092C5C' },
    { label: 'Secondary', hex: '#8FBCE6', bg: true },
    { label: 'Third', hex: '#F5D130' },
  ], // Rays
  140: [
    { label: 'Primary', hex: '#003278', bg: true },
    { label: 'Secondary', hex: '#C0111F' },
  ], // Rangers — same Primary/Secondary pair as Main; background is Primary
  // (navy), same hex the T-badge's own chroma-keyed-out fill used to be
  144: [
    { label: 'Primary', hex: '#CE1141', bg: true },
    { label: 'Secondary', hex: '#13274F' },
  ], // Braves
  146: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Marlins
  147: [{ label: 'Gray', hex: '#C4CED3', bg: true }], // Yankees — grey behind the navy hat-and-bat mark
  // Brewers — white with the shared black pinstripe (TREATMENT_PINSTRIPE_COLOR
  // above) instead of a flat swatch fill; no `bg` flag since the tile isn't a
  // solid color.
  158: [
    { label: 'Primary', hex: '#12284B' },
    { label: 'Secondary', hex: '#FEC52E' },
  ],
}

export const CITY_CONNECT_COLORS = {
  109: [
    { label: 'Primary', hex: '#0097A9' },
    { label: 'Secondary', hex: '#523178', bg: true },
  ], // Diamondbacks
  136: [{ label: 'Background', hex: '#203F79', bg: true }], // Mariners — the trident mark
  110: [{ label: 'Secondary', hex: '#E1D2BE', bg: true }], // Orioles
  144: [
    { label: 'Primary', hex: '#D32826' },
    { label: 'Secondary', hex: '#374EA1' },
    { label: 'Third', hex: '#7BA7D8', bg: true },
  ], // Braves
  113: [
    { label: 'Primary', hex: '#C6011F' },
    { label: 'Secondary', hex: '#000000', bg: true },
  ], // Reds
  115: [
    { label: 'Primary', hex: '#8ABFEB', bg: true },
    { label: 'Secondary', hex: '#4F4FC9' },
  ], // Rockies
  118: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Royals
  111: [{ label: 'Primary', hex: '#5A8D84', bg: true }], // Red Sox
  117: [
    { label: 'Primary', hex: '#0F2948' },
    { label: 'Secondary', hex: '#CEC8B2', bg: true },
    { label: 'Third', hex: '#FC7A1E' },
  ], // Astros
  133: [
    { label: 'Primary', hex: '#003831', bg: true },
    { label: 'Secondary', hex: '#EFB21E' },
  ], // Athletics
  139: [{ label: 'Background', hex: '#000000', bg: true }], // Rays
  140: [
    { label: 'Primary', hex: '#892535', bg: true },
    { label: 'Secondary', hex: '#EBDFCB' },
  ], // Rangers — both sampled off the png itself (red field, cream T)
  145: [{ label: 'Background', hex: '#000000', bg: true }], // White Sox
  138: [{ label: 'Primary', hex: '#C41E3A', bg: true }], // Cardinals — "The Lou" mark on their standard red
  146: [{ label: 'Background', hex: '#000000', bg: true }], // Marlins
  158: [{ label: 'Primary', hex: '#0C436A', bg: true }], // Brewers
  141: [{ label: 'Background', hex: '#161827', bg: true }], // Blue Jays
  137: [{ label: 'Background', hex: '#27251F', bg: true }], // Giants — script "SF" mark, near-black brand secondary (temporary, pending real City Connect background)
}

// A second Alternate treatment. Rangers: same badge as ALT_COLORS' Alternate,
// recolored (public/team-logos/alternate-2/TEX.png: the red offset border
// swapped for Primary blue) and re-paired with the opposite swatch as its
// tile fill. Brewers: a procured Wisconsin-state "M" mark
// (public/team-logos/alternate-2/MIL.png) on its own Primary navy tile.
// Marlins: a procured tri-color (public/team-logos/alternate-2/MIA.png) with
// its own Background swatch (black, not one of the three brand colors).
// Royals: the plain CDN mark (ALT2_USES_BASE_LOGO above), already navy
// #004687, on a plain grey tile matching their Away Grey jersey. Cubs: the
// mark formerly procured as City Connect (public/team-logos/alternate-2/
// CHC.png, moved from city-connect/ — Cubs have no separate City Connect
// look, this mark belongs here instead) on a plain blue tile. Cardinals: the
// same bird-on-bat mark as ALT_COLORS' Alternate, re-paired with a cream tile
// for their Alt 1 Cream jersey.
// Team Color Lab prototype only, same footing as ALT_COLORS/CITY_CONNECT_COLORS.
export const ALT2_COLORS = {
  112: [{ label: 'Background', hex: '#7698CE', bg: true }], // Cubs
  118: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Royals
  120: [{ label: 'Background', hex: '#BD032B', bg: true }], // Nationals — outlined script "W" mark (alternate-2/WSH.png), Alt 1 Red "W" jersey
  136: [{ label: 'Primary', hex: '#0C2C56', bg: true }], // Mariners — the outlined-S mark, for their Away Navy jersey
  137: [{ label: 'Background', hex: '#000000', bg: true }], // Giants — the mark moved off City Connect, for their Alt 2 Black "Gigantes" jersey
  138: [{ label: 'Background', hex: '#FCEDD6', bg: true }], // Cardinals
  140: [
    { label: 'Secondary', hex: '#C0111F', bg: true },
    { label: 'Primary', hex: '#003278' },
  ], // Rangers
  146: [
    { label: 'Primary', hex: '#00A3E0' },
    { label: 'Secondary', hex: '#EF3340' },
    { label: 'Third', hex: '#41748D' },
    { label: 'Background', hex: '#000000', bg: true },
  ], // Marlins
  158: [
    { label: 'Primary', hex: '#12284B', bg: true },
    { label: 'Secondary', hex: '#FEC52E' },
  ], // Brewers — the Wisconsin-state "M" mark on its own Primary navy
  141: [{ label: 'Baby Blue', hex: '#84BEE4', bg: true }], // Blue Jays — jay-head mark (alternate-2/TOR.png), Alt 2 Baby Blue jersey
}

// A third Alternate treatment. Marlins: a procured mark (public/team-logos/
// alternate-3/MIA.png, the throwback "F" marlin) on its own teal tile.
// Mariners: the cream "S" mark for their Steelheads alt, on black.
export const ALT3_COLORS = {
  136: [{ label: 'Background', hex: '#000000', bg: true }], // Mariners
  146: [{ label: 'Background', hex: '#009CA7', bg: true }], // Marlins
  141: [{ label: 'Background', hex: '#C22028', bg: true }], // Blue Jays — Canada Red jay-on-maple-leaf mark (alternate-3/TOR.png), Alt 4 Canada Red jersey
  120: [{ label: 'Navy', hex: '#14225A', bg: true }], // Nationals — same script "W" mark as Alternate 1 (alternate-3/WSH.png), Alt 2 Blue jersey
}

// A fourth Alternate treatment. Blue Jays: same plain CDN mark as Main
// (ALT4_USES_BASE_LOGO), re-paired with a grey tile for their Away Grey
// jersey.
export const ALT4_COLORS = {
  141: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Blue Jays
}

// Whether `teamId` has an Alternate 2/3/4 set up at all — either curated
// colors (ALT2_COLORS/ALT3_COLORS/ALT4_COLORS) or an explicit plain-CDN-mark
// opt-in (ALT2_USES_BASE_LOGO/ALT4_USES_BASE_LOGO). All are opt-in per team
// (unlike Main/Alternate/City Connect, which every club eventually gets), so
// Team Color Lab skips rendering the tile entirely for a team with neither,
// rather than showing an empty placeholder.
export function hasAlternate2(teamId) {
  return !!(ALT2_COLORS[teamId] || ALT2_USES_BASE_LOGO.has(teamId))
}

export function hasAlternate3(teamId) {
  return !!ALT3_COLORS[teamId]
}

export function hasAlternate4(teamId) {
  return !!(ALT4_COLORS[teamId] || ALT4_USES_BASE_LOGO.has(teamId))
}

// The tile/card background hex for a team's Alternate, Alternate 2/3/4, or
// City Connect treatment, or null if that team has no curated background yet
// (callers should fall back to their own neutral fill, same as a missing
// logo file). 'main'/'base' have no entry here — a standard jersey always
// renders on the plain paper fill everywhere outside Team Color Lab.
export function treatmentBgColor(teamId, treatment) {
  const colors =
    treatment === 'alternate'
      ? ALT_COLORS[teamId]
      : treatment === 'alternate-2'
        ? ALT2_COLORS[teamId]
        : treatment === 'alternate-3'
          ? ALT3_COLORS[teamId]
          : treatment === 'alternate-4'
            ? ALT4_COLORS[teamId]
            : treatment === 'city-connect'
              ? CITY_CONNECT_COLORS[teamId]
              : null
  return colors?.find((c) => c.bg)?.hex ?? null
}

// Per-team, per-treatment tweak to a tinted tile's edge-bleed scale (applied
// on top of the 1.32 default every tile normally gets) — a few marks read
// large/dense enough that the default overscale reads as "the whole tile is
// this color" against a real fill (see .scratch/gamecard-team-colors' parked
// solid-tile-color issue for the general version of this problem on Main;
// these per-team fixes are the narrower version already solved for Alternate/
// City Connect specifically).
export const TREATMENT_SCALE = {
  139: { alternate: 1.6 }, // Rays — mark reads small against the tint at 1.32 alone
  113: { 'city-connect': 0.75 }, // Reds — the "C" mark already touches all four
  // edges of its own canvas, so the default 1.32 edge-bleed crops it; shrink
  // down so the whole mark stays inside the tile.
  117: { 'city-connect': 0.72 }, // Astros — same edge-to-edge canvas issue as the Reds mark
  118: { alternate: 0.85, 'alternate-2': 0.85 }, // Royals — same KC mark + scale as Main's own override
  109: { alternate: 1.1 }, // Diamondbacks — bumped up so the top-anchored bleed just barely clips the teal border
  115: { 'city-connect': 1.15 }, // Rockies — mark reads small against the tint at 1.32 alone
  136: { alternate: 0.95 }, // Mariners — shrunk 5% off the default 1.32 edge-bleed
  120: { alternate: 0.9, 'alternate-3': 0.9 }, // Nationals — same script "W" mark as Alternate, matched to its 10%-shrunk size
  140: {
    // T-badge (alternate/TEX.png, swapped in from Main) — the navy fill was
    // chroma-keyed to transparent, and its own bbox already fills most of the
    // canvas, so shrink slightly off the default 1.32 edge-bleed to avoid
    // clipping the crossbar tips.
    alternate: 0.85,
    'city-connect': 0.855, // shrunk 5%, then another 10%; tile bg matches the png's own red so the new edge gap is seamless
    'alternate-2': 0.85, // same badge/canvas as Alternate, just recolored — same edge-bleed fix applies
  },
  141: { 'city-connect': 0.75 }, // Blue Jays — the T/leaf mark already touches all four edges of its own canvas, so the default 1.32 edge-bleed crops it; shrink down so the whole mark stays inside the tile
  158: { alternate: 0.8 }, // Brewers — the wheat/laurel-and-ball mark shrunk 20% off the default 1.32 edge-bleed
}

// Per-team, per-treatment pinstripe background for a non-Main tile — same
// hand-styled white-with-line pattern as MAIN_OVERRIDES' `pinstripe`
// (mainTreatmentPinstripe/mainTreatmentPinstripeColor), just for Alternate/
// City Connect/Alternate 2 instead of Main. The value is the line color
// itself (no separate boolean flag needed) — the shared black default
// (mainTreatmentPinstripeColor's own default) unless a team needs its own.
export const TREATMENT_PINSTRIPE_COLOR = {
  158: { alternate: 'rgba(0, 0, 0, 0.16)' }, // Brewers Alternate — same plain black pinstripe as Rockies/every other pinstriped tile
}

export function treatmentPinstripeColor(teamId, treatment) {
  return TREATMENT_PINSTRIPE_COLOR[teamId]?.[treatment] ?? null
}

export function treatmentScale(teamId, treatment) {
  return TREATMENT_SCALE[teamId]?.[treatment] ?? 1
}

// Per-team tuning for the Main/default logo tile — first designed on Team
// Color Lab as a prototype-only "what if every club's default tile had a
// colored background" pass (see that page's own history), now promoted here
// so the real home-page game card can share it: `bg` names which of
// teamColorSwatches' first three entries (Primary/Secondary/Third, in that
// order) fills the tile; `recolor` swaps the mlbstatic base mark for a
// locally hand-edited one (mainOverrideLogoUrl below) when the CDN mark's own
// colors don't read against the new fill (e.g. a navy-outlined mark on a navy
// tile); `scale` overrides the tile's default 1.32 edge-bleed for a mark
// that's especially dense/large at that fill. `pinstripe` (Rockies, Yankees)
// is a hand-styled background instead of a flat swatch — see
// mainTreatmentPinstripe/mainTreatmentPinstripeColor. `bgHex` (Brewers only)
// is a literal fill color that isn't any of the club's three brand
// swatches — takes priority over `bg` in mainTreatmentTint. A team with no
// entry here gets no tint, same as a missing Alternate/City Connect logo.
export const MAIN_OVERRIDES = {
  109: { bg: 'secondary' }, // Diamondbacks
  108: { bg: 'secondary', scale: 0.9 }, // Angels
  110: { bg: 'secondary' }, // Orioles
  111: { bg: 'secondary' }, // Red Sox
  // Cubs — white with the shared black pinstripe (mainTreatmentPinstripe) to
  // match their Home Pinstripe jersey, instead of a flat Secondary tile.
  112: { pinstripe: true, scale: 0.9 },
  113: { bg: 'secondary' }, // Reds
  114: { bg: 'primary', recolor: true }, // Guardians — navy border -> white
  // Rockies — white with a subtle black pinstripe (mainTreatmentPinstripe
  // below) to match their home pinstripe jersey, instead of a flat
  // brand-color tint like every other override here. No `recolor` — the
  // plain mlbstatic mark (its black rim included) reads fine against white,
  // so this wears the stock CDN svg unmodified.
  115: { pinstripe: true },
  116: { bg: 'primary', recolor: true }, // Tigers — navy -> white
  117: { bg: 'secondary', scale: 0.9 }, // Astros
  118: { bg: 'primary', recolor: true, scale: 0.85 }, // Royals — navy -> white
  119: { bg: 'primary', recolor: true, scale: 0.85 }, // Dodgers — blue -> white
  // Nationals — the script "W" mark (main-overrides/WSH.png), white background
  120: { bgHex: '#FFFFFF', recolor: true },
  121: { bg: 'primary', scale: 0.9 }, // Mets
  133: { bg: 'primary', recolor: true }, // Athletics — green -> white
  134: { bg: 'primary', scale: 0.95 }, // Pirates
  135: { bg: 'primary', recolor: true, scale: 0.85 }, // Padres — dark -> secondary gold
  136: { bg: 'secondary', recolor: true }, // Mariners — compass-rose mark
  137: { bg: 'secondary', scale: 0.9 }, // Giants
  138: { bg: 'primary', recolor: true, scale: 0.85 }, // Cardinals — red -> white
  139: { bg: 'primary', recolor: true, scale: 0.95 }, // Rays — navy letters -> white, kept the baby-blue undertone shadow
  // Rangers — the circular "Texas Rangers" crest badge (main-overrides/TEX.png,
  // swapped in from Alternate) rather than the mlbstatic mark; it's already
  // edge-to-edge in its own canvas like the Reds/Astros marks below, so scale
  // down off the default 1.32 edge-bleed instead of up.
  140: { bg: 'primary', recolor: true, scale: 0.75 },
  141: { bgHex: '#F5F0E1' }, // Blue Jays — subtle off-white, not any of the three brand swatches
  142: { bg: 'primary', recolor: true, scale: 0.85 }, // Twins — navy T -> white
  143: { bg: 'primary', recolor: true }, // Phillies — red/white swapped
  144: { bg: 'secondary', recolor: true }, // Braves — red -> white (bg matches the navy border)
  145: { bg: 'secondary' }, // White Sox
  146: { bg: 'third' }, // Marlins — Slate Gray
  // Yankees — white with the shared black pinstripe (mainTreatmentPinstripe)
  // to match their home pinstripe jersey, instead of a flat navy tile. No
  // `recolor` — the plain mlbstatic mark is already navy, so this wears the
  // stock CDN svg unmodified. No `pinstripeColor` override — the navy read
  // too strong against white, plain black matches every other pinstriped tile.
  147: { pinstripe: true },
  158: { bgHex: '#FFF5EA' }, // Brewers — cream, not any of the three brand swatches
}

const MAIN_BG_ROLE_INDEX = { primary: 0, secondary: 1, third: 2 }

// Every other override here is a hand-edited copy of the vector mlbstatic
// mark (.svg); the Rangers' and Mariners' are procured raster art.
const MAIN_OVERRIDE_PNG = new Set([140, 136, 120])

// The locally hand-edited Main-treatment mark for `teamId`, for a team whose
// MAIN_OVERRIDES entry sets `recolor: true` — served same-origin out of
// public/ like localLogoUrl above. Callers should fall back to the normal CDN
// base logo (teamLogoUrl(teamId, 'base')) when this team has no override or
// the file 404s.
export function mainOverrideLogoUrl(teamId) {
  const abbr = teamAbbr({ id: teamId })
  if (!abbr) return null
  const ext = MAIN_OVERRIDE_PNG.has(teamId) ? 'png' : 'svg'
  return `/team-logos/main-overrides/${abbr}.${ext}`
}

// The Main tile's background hex for `teamId`, or null for a team with no
// curated tile yet (pinstripe teams also return null here — their tile is a
// hand-styled pattern, not a flat swatch; see mainTreatmentPinstripe).
export function mainTreatmentTint(teamId) {
  const override = MAIN_OVERRIDES[teamId]
  if (override?.bgHex) return override.bgHex
  if (!override?.bg) return null
  const idx = MAIN_BG_ROLE_INDEX[override.bg]
  return teamColorSwatches(teamId)[idx]?.hex ?? null
}

// The Main tile's edge-bleed scale override for `teamId`, or 1 (the shared
// tinted-tile default) for a team with no override.
export function mainTreatmentScale(teamId) {
  return MAIN_OVERRIDES[teamId]?.scale ?? 1
}

// Whether `teamId`'s Main tile should render the hand-styled pinstripe
// pattern (Rockies, Yankees) instead of any flat swatch fill.
export function mainTreatmentPinstripe(teamId) {
  return !!MAIN_OVERRIDES[teamId]?.pinstripe
}

// The pinstripe line color for a pinstriped Main tile — black by default
// (Rockies), overridable per team (Yankees' navy) to match that club's own
// home pinstripe.
export function mainTreatmentPinstripeColor(teamId) {
  return MAIN_OVERRIDES[teamId]?.pinstripeColor ?? 'rgba(0, 0, 0, 0.16)'
}

// Whether `teamId`'s Main mark should swap to the locally hand-edited file
// (mainOverrideLogoUrl) rather than the plain mlbstatic CDN base logo.
export function mainTreatmentRecolor(teamId) {
  return !!MAIN_OVERRIDES[teamId]?.recolor
}

// Everything one "logo tile" needs to render for a (team, treatment): the
// mark to show and the fill it sits on.
//   { logoVariant, tint, pinstripeColor, scale }
// `tint` is null when the tile is pinstriped (a pattern, not a swatch — see
// mainTreatmentPinstripe) or when a club has no curated tile for this
// treatment yet, in which case the caller's own default paper shows through.
//
// One resolver because the same tile now appears in three places — the slate
// card (components/GameCard.jsx), the in-game masthead (screens/GameView.jsx),
// and Team Color Lab's curation grid — and a club whose mark needs a
// scale-down or a recolor to read against its own fill needs it in all of
// them. Treatment vocabulary is the jerseys.json one (api/jerseys.js), with
// null / 'main' / 'base' all meaning "the club's Main look" since the slate
// card and the WPA chart spell that default differently.
export function treatmentTile(teamId, treatment) {
  const isMain = !treatment || treatment === 'main' || treatment === 'base'
  if (isMain) {
    const pinstriped = mainTreatmentPinstripe(teamId)
    return {
      logoVariant: mainTreatmentRecolor(teamId) ? 'main-recolor' : 'base',
      tint: pinstriped ? null : mainTreatmentTint(teamId),
      pinstripeColor: pinstriped ? mainTreatmentPinstripeColor(teamId) : null,
      scale: mainTreatmentScale(teamId),
    }
  }
  const pinstripeColor = treatmentPinstripeColor(teamId, treatment)
  return {
    logoVariant: treatment,
    tint: pinstripeColor ? null : treatmentBgColor(teamId, treatment),
    pinstripeColor,
    scale: treatmentScale(teamId, treatment),
  }
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

// `width` is the CDN-delivered pixel width, NOT the CSS display size. It
// defaults to 320 so the largest on-screen rung (--shot-xl, 104px wide) is
// still ≥1 device pixel per source pixel on a 3× phone (104×3 = 312) — at the
// old 213 those big headshots were upscaled ~1.5× and looked pixelated. One
// shared width means every call site reuses a single cached image; callers
// should only override it for a materially larger surface.
export function realHeadshotUrl(personId, width = 320) {
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
export function milbHeadshotUrl(personId, width = 320) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/headshot/milb/current`
}

// Coaches and managers have NO `silo`/`milb` variant — both 404 for a coaching
// personId (verified live). Their photo lives under a distinct `{code}/coach`
// context instead. Verified live across teams: the code is NOT team-specific —
// `67` and `83` both resolve for every manager tested (Murphy/Melvin/Boone/
// Counsell); we use `67`, a 426×640-family ~2:3 portrait JPEG on a colored
// backdrop (same shape as the milb variant, so the .shot top-center cover crop
// reframes it head-near-top with no per-image work). Same no-`d_people:generic`
// rule as the player URLs: a personId with no coach photo on file still 404s
// cleanly, so Headshot.jsx degrades to the team logo. Used by Headshot's
// `coach` mode (components/Headshot.jsx) — the manager page's only photo source.
export function coachHeadshotUrl(personId, width = 320) {
  if (!personId) return null
  return `${HEADSHOT_BASE}/w_${width},q_auto:best/v1/people/${personId}/headshot/67/coach/current`
}

// The ordered PHOTO rungs of a person's Headshot fallback chain (see
// components/Headshot.jsx), before the shared team-logo / monogram rungs the
// component appends. Pure so the rung POLICY is unit-testable on its own
// (test/teams.test.js) rather than buried in the component's render.
//   • coaches/managers (`coach`): the `{code}/coach` variant only — a coaching
//     personId has no silo/milb (both 404).
//   • MiLB / prospect players (`mlb` false): silo → milb. The milb rung is a
//     real, RECENT minor-league face for a prospect whose MLB `silo` studio
//     shot 404s — exactly the case that rung exists for.
//   • MAJOR-LEAGUE players (`mlb` true): silo ONLY. An established MLB player's
//     `milb` variant is a years-old prospect photo in the wrong team's cap;
//     since the MLB `silo` studio shot is the one that can lag or briefly 404
//     (regeneration, a trade), letting a momentary silo miss fall to that
//     stale minor-league shot — permanently, once Headshot advances a rung —
//     showed veterans in their old rookie-ball hats. Dropping the milb rung
//     for a confirmed MLB player degrades a silo miss to the club logo
//     (neutral, current) instead. A brand-new call-up with no silo yet shows
//     the club logo rather than his recent MiLB face — an accepted, rare trade
//     for never mis-capping a regular.
// `mlb` is a plain boolean the caller decides (Headshot derives it from the
// player's ACTUAL team, not the display teamId — a prospect's card tints with
// his parent MLB org but must still keep the milb rung).
export function headshotSources(personId, { coach = false, mlb = false } = {}) {
  if (!personId) return []
  if (coach) return [coachHeadshotUrl(personId)]
  if (mlb) return [realHeadshotUrl(personId)]
  return [realHeadshotUrl(personId), milbHeadshotUrl(personId)]
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

// Each MLB club's REAL primary + secondary brand colors — distinct from
// TEAM_COLORS above, which deliberately picks ONE rival-distinguishing accent
// (sometimes skipping a club's actual navy/blue on purpose). This pair is for
// contexts that want a club's genuine two-tone identity at full brightness
// (e.g. the box score's favor lean-bar diagonal stripe — StatBox.jsx), not a
// subtle single-hue tint. Verified against teamcolorcodes.com/mlb-color-codes
// (2026-07-16), not picked from memory — every other color in this file is
// hand-picked for a DIFFERENT purpose (distinctiveness), so this couldn't
// reuse that data even if it wanted to.
const TEAM_COLOR_PAIRS = {
  108: ['#003263', '#BA0021'], // Angels
  109: ['#A71930', '#E3D4AD'], // Diamondbacks
  110: ['#DF4601', '#000000'], // Orioles
  111: ['#BD3039', '#0C2340'], // Red Sox
  112: ['#0E3386', '#CC3433'], // Cubs
  113: ['#C6011F', '#000000'], // Reds
  114: ['#00385D', '#E50022'], // Guardians
  115: ['#333366', '#C4CED4'], // Rockies
  116: ['#0C2340', '#FA4616'], // Tigers
  117: ['#002D62', '#EB6E1F'], // Astros
  118: ['#004687', '#BD9B60'], // Royals
  119: ['#005A9C', '#EF3E42'], // Dodgers
  120: ['#AB0003', '#14225A'], // Nationals
  121: ['#002D72', '#FF5910'], // Mets
  133: ['#003831', '#EFB21E'], // Athletics
  134: ['#27251F', '#FDB827'], // Pirates
  135: ['#2F241D', '#FFC425'], // Padres
  136: ['#0C2C56', '#005C5C'], // Mariners
  137: ['#FD5A1E', '#27251F'], // Giants
  138: ['#C41E3A', '#0C2340'], // Cardinals
  139: ['#092C5C', '#8FBCE6'], // Rays
  140: ['#003278', '#C0111F'], // Rangers
  141: ['#134A8E', '#1D2D5C'], // Blue Jays
  142: ['#002B5C', '#D31145'], // Twins
  143: ['#E81828', '#002D72'], // Phillies
  144: ['#CE1141', '#13274F'], // Braves
  145: ['#27251F', '#C4CED4'], // White Sox
  146: ['#00A3E0', '#EF3340'], // Marlins
  147: ['#003087', '#E4002C'], // Yankees
  158: ['#12284B', '#FFC52F'], // Brewers
}

// `teamId`'s [primary, secondary] brand-color pair (MLB club or MiLB
// affiliate, resolved to its parent org's pair via MILB_PARENT_ORG, same
// fallback teamTintColor uses), or null for a team with no known pair (an
// unaffiliated/complex-league MiLB id) — shared by every TEAM_COLOR_PAIRS
// reader below so the affiliate-fallback rule lives in exactly one place.
function resolveTeamColorPair(teamId) {
  return TEAM_COLOR_PAIRS[teamId] ?? TEAM_COLOR_PAIRS[MILB_PARENT_ORG[teamId]] ?? null
}

// A diagonal, 100%-opacity two-tone stripe for `teamId` — a plain CSS
// `background` value, ready to drop on any element via inline style. Returns
// null for a team with no known pair, so callers can fall back to a flat
// color rather than render nothing.
export function teamStripeGradient(teamId) {
  const pair = resolveTeamColorPair(teamId)
  if (!pair) return null
  const [a, b] = pair
  // 3px bands (6px per repeat) — fine enough to read as a woven zebra
  // texture rather than a couple of wide diagonal blocks at the compact bar
  // sizes this is actually used at (StatBox.jsx's favor meter).
  return `repeating-linear-gradient(45deg, ${a} 0px, ${a} 3px, ${b} 3px, ${b} 6px)`
}

// A club's single primary brand color (the first of TEAM_COLOR_PAIRS), for
// contexts that want one team-identity hex rather than a two-tone stripe
// (e.g. RadarPill's pressed-glyph state, or a solid hover fill). Returns
// null for a team with no known pair.
export function teamPrimaryColor(teamId) {
  return resolveTeamColorPair(teamId)?.[0] ?? null
}

// Candidate text colors for a team-brand-colored chip — the app's own
// text-on-ink / text-heading tokens (tokens/colors.css). Mirrored here as hex
// since contrast math needs literal values, not CSS custom properties.
const CHIP_TEXT_LIGHT = '#FBF6E9' // --text-on-ink (--paper-2)
const CHIP_TEXT_DARK = '#16222F' // --text-heading (--ink-0)

// `teamId`'s primary/secondary pair plus whichever of the app's two text
// tokens actually contrasts best against the primary (WCAG), for a chip that
// prints a team's brand color as a solid fill — a pale/gold primary
// correctly falls through to dark ink instead of assuming light text always
// works. Returns null for a team with no known pair.
export function teamChipColors(teamId) {
  const pair = resolveTeamColorPair(teamId)
  if (!pair) return null
  const [primary, secondary] = pair
  return { primary, secondary, text: readableTextColor(primary, CHIP_TEXT_LIGHT, CHIP_TEXT_DARK) }
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

// Every current MLB club's team id, in no particular order — for surfaces that
// need to enumerate the whole league (e.g. showing all 30 clubs even ones a
// given umpire/player hasn't touched this season).
export const ALL_MLB_TEAM_IDS = Object.keys(MLB_TEAM_NAMES).map(Number)

// True only for a CURRENT MLB club's team id — the 30 ids in MLB_TEAM_NAMES.
// A MiLB affiliate id, a null/undefined team, or anything else is false. Used
// to gate the Headshot fallback chain (headshotSources above): a confirmed
// major-leaguer never falls back to his stale `milb` prospect photo.
export function isMlbTeamId(teamId) {
  return teamId != null && MLB_TEAM_NAMES[teamId] != null
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

// A club nickname short enough for a tight two-line tile (the off-day card),
// where the canonical nickname would wrap. Only clubs whose nickname overflows
// get an entry; everyone else falls back to teamClubName. "D-backs" is the
// team's own brand-approved short form for the Diamondbacks.
const SHORT_CLUB_NAMES = {
  109: 'D-backs',
}

// "Pirates" / "D-backs" — the nickname to show on space-constrained tiles.
// Falls back to the full nickname (teamClubName) when there's no short form.
export function teamClubNameShort(teamId) {
  return SHORT_CLUB_NAMES[teamId] ?? teamClubName(teamId)
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

// Extra current-era brand colors beyond a club's primary/secondary/accent —
// only for clubs with a well-documented third-or-later color in their CURRENT
// identity (no retro/throwback-only palettes: e.g. the White Sox's navy/red
// "Southside" alternate and the Brewers'/Marlins'/Blue Jays' pre-rebrand
// palettes are deliberately excluded). Cross-checked against Wikipedia team
// infoboxes and teamcolorcodes.com (2026-07-17); skipped rather than guessed
// wherever sources disagreed on the hex (e.g. Orioles' gray, Royals' powder
// blue). Absent teams simply have no documented color beyond the pair + accent.
const TEAM_COLOR_EXTRAS = {
  108: [{ label: 'Silver', hex: '#C4CED4' }], // Angels
  109: [{ label: 'Teal', hex: '#30CED8' }], // Diamondbacks
  115: [{ label: 'Black', hex: '#000000' }], // Rockies
  117: [{ label: 'Metallic Orange', hex: '#F4911E' }], // Astros
  119: [{ label: 'Silver', hex: '#A5ACAF' }], // Dodgers
  133: [{ label: 'Gray', hex: '#A2AAAD' }], // Athletics
  136: [
    { label: 'Silver', hex: '#C4CED4' },
    { label: 'Red', hex: '#D50032' },
  ], // Mariners
  137: [
    { label: 'Cream', hex: '#EFD19F' },
    { label: 'Metallic Gold', hex: '#AE8F6F' },
  ], // Giants
  138: [{ label: 'Yellow', hex: '#FEDB00' }], // Cardinals
  142: [{ label: 'Kasota Gold', hex: '#B9975B' }], // Twins
  144: [{ label: 'Yellow', hex: '#EAAA00' }], // Braves
  146: [
    { label: 'Slate Gray', hex: '#41748D' },
    { label: 'Black', hex: '#000000' },
  ], // Marlins
  147: [
    { label: 'Navy', hex: '#0C2340' },
    { label: 'Gray', hex: '#C4CED3' },
  ], // Yankees
  158: [{ label: 'Powder Blue', hex: '#6CACE4' }], // Brewers (2026 alt road jersey)
}

// A club's known brand colors as labeled swatches — the real primary +
// secondary pair (TEAM_COLOR_PAIRS), the separately hand-picked
// distinctiveness accent (TEAM_COLORS), and any researched extras
// (TEAM_COLOR_EXTRAS) — deduped by hex so a club whose accent or extra just
// restates an earlier swatch doesn't repeat it. MLB-only, empty array for a
// MiLB id. Built for the team-color-lab dev page
// (src/screens/TeamColorLab.jsx) — not used by any spoiler-facing surface.
export function teamColorSwatches(teamId) {
  const [primary, secondary] = TEAM_COLOR_PAIRS[teamId] ?? []
  const candidates = [
    { label: 'Primary', hex: primary },
    { label: 'Secondary', hex: secondary },
    { label: 'Accent', hex: TEAM_COLORS[teamId] },
    ...(TEAM_COLOR_EXTRAS[teamId] ?? []),
  ].filter((c) => c.hex)
  const seen = new Set()
  return candidates.filter((c) => {
    const key = c.hex.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
