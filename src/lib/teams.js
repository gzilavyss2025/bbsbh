// Static configuration that never needs a network call.

import { readableTextColor } from './contrast.js'
import { isFriday } from './dates.js'
import { TEAM_COLOR_PAIRS, MLB_TEAM_COLORS, milbBrandPair } from './brandColors.js'
import { byTeam, byTreatment as byTreatmentIn, treatmentRecord } from './tuningStore.js'
import MLB_TREATMENT_TUNING from './data/mlb-treatment-tuning.json' with { type: 'json' }
import LOGO_ART from './data/logo-art.json' with { type: 'json' }

// The per-team, per-treatment tile tuning the Team Identity Lab writes back to
// (src/lib/data/mlb-treatment-tuning.json, ADR-0029) — re-exported raw so that
// lab has one thing to read, edit, and POST as a whole file. Everything else in
// this module reads it through the derived tables below, which keep the exact
// shapes (and the exact resolver semantics) the app had when these were JS
// literals. See src/lib/CLAUDE.md for the store's schema.
export { MLB_TREATMENT_TUNING }

// Every field of a (team, treatment) tuning record, or null. `treatment` uses
// the jerseys.json vocabulary ('main' / 'alternate' / 'alternate-2…4' /
// 'city-connect').
function treatmentTuning(teamId, treatment) {
  return treatmentRecord(MLB_TREATMENT_TUNING, teamId, treatment)
}

// tuningStore's byTreatment, bound to this store and defaulting to the
// Main-excluding behaviour these MLB tables need (see its own doc comment).
function byTreatment(pick, { includeMain = false } = {}) {
  return byTreatmentIn(MLB_TREATMENT_TUNING, pick, { includeMain })
}

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
// that renders a logo is the app's light "paper"; the one dark surface, the
// navy section mastheads, wears the locally precomputed `mono` mark below
// rather than the CDN's own `-on-dark` variant, which keeps each club's REAL
// colors (verified live: only a mostly-monochrome mark like the Yankees'
// actually turns white there; a multicolor mark like the Brewers' does not) —
// not the uniform one-color lockup this app wants. There is NO alternate /
// per-uniform / home-road mark on this CDN (those paths 404), so this is the
// full set. `base` is the plain `{id}.svg` default that every existing caller
// already uses.
export const LOGO_VARIANTS = [
  { key: 'primary', label: 'Primary', path: 'team-primary-on-light' },
  { key: 'cap', label: 'Cap', path: 'team-cap-on-light' },
  { key: 'wordmark', label: 'Wordmark', path: 'team-wordmark-on-light' },
]

// The `mono` variant is NOT on this CDN — it's the one-color knockout mark the
// navy section mastheads wear, precomputed from the base art by
// scripts/gen-mono-logos.mjs and served same-origin from here (see
// src/lib/logoMono.js for how it's built, ADR-0031 for why). Coverage tracks
// public/data/teams.json, so a brand-new affiliate can be missing until that
// generator next runs — which is what TeamLogo's variant -> base fallback is
// for: that club just wears its full-color mark on the bar until the art
// exists.
const MONO_LOGO_BASE = '/data/logos/mono'

// Teams/treatments whose local art is a hand-flattened/recolored SVG (every
// path recolored off the official multicolor logo) rather than a
// photographed/cropped PNG like every other curated treatment. Keyed
// `${teamId}:${treatment}` since the same club's Alternate and Alternate 2
// can differ. Single source of truth for both localLogoUrl below and Team
// Color Lab's own tiles — grows as more art is added in whatever format
// it's supplied in.
const ALT_LOGO_SVG = new Set([
  '118:alternate', // Royals — same recolored-white KC mark as Main, reused here (main-overrides/KC.svg copied to alternate/KC.svg)
  '116:alternate-2', // Tigers — same recolored-white Old English "D" as Main, reused here (main-overrides/DET.svg copied to alternate-2/DET.svg)
])

// Teams whose Alternate mark is the plain, unmodified mlbstatic CDN base logo
// (teamLogoUrl(teamId, 'base')) rather than any procured local asset — no
// hand-cropped PNG, no recolored SVG. The tile still tints with ALT_COLORS'
// curated background; only the mark itself is the stock CDN art.
const ALT_USES_BASE_LOGO = new Set([
  108, // Angels — same plain CDN mark as Main, just re-paired with a grey tile for their Away Grey jersey
  145, // White Sox — same plain CDN mark as Main, re-paired with a pinstripe tile for their Home Pinstripe jersey
  117, // Astros — same plain CDN mark as Main, re-paired with an orange tile for their Alt Orange jersey
  134, // Pirates — same plain CDN mark as Main, re-paired with a black tile for their Alt 1 Black "P" jersey
])

// Teams with no real City Connect uniform at all (as opposed to one whose art
// just hasn't been procured yet) — Team Identity Lab skips the tile entirely
// rather than showing an empty placeholder that implies one is coming.
const NO_CITY_CONNECT = new Set([
  147, // Yankees — opted out of the program
  112, // Cubs — their City Connect mark moved to Alternate 2 (see ALT2_COLORS below); no separate CC look
])

export function hasCityConnect(teamId) {
  return !NO_CITY_CONNECT.has(teamId)
}

// Predictive fallback tile for a game whose actual worn jersey hasn't posted
// yet (jerseyTreatmentFor/api/jerseys.js returns null pre-game) — a best
// guess, not a fact, so jerseyTreatmentFor's real data always overrides it
// the moment it posts, including a confirmed-standard game (gen-jerseys.mjs
// stores 'main' explicitly rather than omitting it, precisely so a guess
// this function gets wrong — e.g. a Friday city-connect club that wore its
// plain jersey that night — doesn't stand uncorrected once Final). Away
// always predicts the plain Main mark (the away
// grey/road look — several clubs' Main tile is already re-paired with a grey
// fill for exactly that jersey, see ALT_USES_BASE_LOGO above). A home game on
// a Friday predicts City Connect for any club that has one, since Friday is
// most clubs' scheduled City Connect night.
export function defaultTreatmentFor(teamId, side, apiDate) {
  if (side === 'home' && isFriday(apiDate) && hasCityConnect(teamId)) return 'city-connect'
  return 'main'
}

// Same idea as ALT_USES_BASE_LOGO, but for the Alternate 2 treatment.
const ALT2_USES_BASE_LOGO = new Set([
  118, // Royals — the plain CDN mark is already navy #004687 (Main's own is a locally recolored white copy)
  110, // Orioles — same plain CDN mark as Main, re-paired with a white tile for their Home White jersey
  145, // White Sox — same plain CDN mark as Main, re-paired with a black tile for their Alt 1 Black "Sox" jersey
  108, // Angels — same plain CDN mark as Main, re-paired with a red tile for their Alt 1 Red jersey
  117, // Astros — same plain CDN mark as Main, re-paired with a navy tile for their Alt Blue jersey
  134, // Pirates — same plain CDN mark as Main, re-paired with a gold tile for their Alt 2 Black "Pittsburgh" jersey
  133, // Athletics — same plain CDN mark as Main (Main's own is the curated ATH.png), re-paired with a grey tile for their Road Grey jersey
])

// Same idea as ALT_USES_BASE_LOGO, but for the Alternate 3 treatment.
const ALT3_USES_BASE_LOGO = new Set([
  109, // Diamondbacks — same plain CDN mark as Main, re-paired with a black tile for their Alt 1 Black jersey
  110, // Orioles — same plain CDN mark as Main, re-paired with a grey tile for their Away Grey jersey
  108, // Angels — same plain CDN mark as Main, re-paired with a white tile for their Alt 2 White Pullover jersey
  145, // White Sox — same plain CDN mark as Main, re-paired with a grey tile for their Alt 2 "Southside" jersey
  158, // Brewers — same plain CDN mark as Main, re-paired with a powder blue tile for their Road Powder Blue jersey
  113, // Reds — the plain CDN wishbone-C mark, re-paired with a grey tile for their Away Grey jersey (Main's own is the locally recolored "Reds" script mark)
  114, // Guardians — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with a grey tile for their Away Grey jersey
  116, // Tigers — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with a grey tile for their Away Grey jersey
  117, // Astros — same plain CDN mark as Main, re-paired with a grey tile for their Road Grey jersey
  121, // Mets — same plain CDN mark as Main, re-paired with a grey tile for their Away Grey jersey
  134, // Pirates — same plain CDN mark as Main, re-paired with a grey tile for their Road Grey jersey
  139, // Rays — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with their navy tile for their Away Blue jersey
  143, // Phillies — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with a grey tile for their Away Grey jersey
  138, // Cardinals — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with a grey tile for their Road Grey jersey
])

// Same idea as ALT_USES_BASE_LOGO, but for the Alternate 4 treatment.
const ALT4_USES_BASE_LOGO = new Set([
  141, // Blue Jays — same plain CDN mark as Main, re-paired with a grey tile for their Away Grey jersey
  119, // Dodgers — same plain CDN mark as Main, re-paired with a grey tile for their Road Grey "Los Angeles" jersey
  135, // Padres — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with a brown tile for their Away Brown jersey
  140, // Rangers — same plain CDN mark as Main (Main's own is a locally recolored, procured badge), re-paired with a grey tile for their Away Grey jersey
  111, // Red Sox — same plain CDN mark as Main, re-paired with a grey tile for their Away Grey jersey
])

// Where a procured Alternate/City Connect logo for `teamId`/`treatment` is
// expected — hand-curated, transparent-cropped art checked into public/, since
// the mlbstatic CDN carries no such marks (see the LOGO_VARIANTS comment
// above). Filename is the club's real abbreviation, already the single
// source of truth for spelling a club's short code everywhere else in this
// app. Deliberately has NO team-id whitelist: coverage grows purely by
// dropping a new file into public/team-logos/{treatment}/ — a missing file
// 404s and callers (TeamLogo's fallback chain, Team Identity Lab's
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
  if (variant === 'alternate-3' && ALT3_USES_BASE_LOGO.has(teamId)) return `${LOGO_BASE}/${teamId}.svg`
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
  // MiLB's own two variations (milbColors.js's milbTreatmentTile), keyed by
  // team id rather than abbreviation — see logoArt.js's MILB_LOGO_DIRS.
  if (variant === 'milb-home' || variant === 'milb-away') return `/team-logos/${variant}/${teamId}.png`
  if (variant === 'mono') return `${MONO_LOGO_BASE}/${teamId}.svg`
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
// carry an official Primary/Secondary/Accent set the way Main does
// (mlb-team-colors.json). Single source of truth for Team Identity Lab's swatch
// tiles AND the
// home-page game card's jersey-variant background (treatmentBgColor below) —
// moved here so both read the same curated set rather than drifting. Each
// entry is a small swatch list; the one flagged `bg: true` is the color
// actually used as a fill. A team with no entry here has no known background
// yet — callers should leave their surface plain rather than render nothing.
//
// The Rockies' #33006F is deliberately NOT their Main Primary (#333366): it is
// a proposed purple that stays scoped to this narrow, opt-in Alternate
// background rather than being promoted into the app-wide brand pair. The Team
// Identity Lab used to mirror it onto the Main tile through a lab-only
// PRIMARY_OVERRIDE; that override is gone, so the lab now shows the two hexes
// as what they are — a Main Primary and a separate Alternate fill. Promoting
// the purple means editing 115.primary in mlb-team-colors.json on purpose, and
// it would retint every surface teamPrimaryColor feeds.
export const ALT_COLORS = {
  108: [{ label: 'Silver', hex: '#C4CED4', bg: true }], // Angels — same plain CDN mark as Main, on grey for Away Grey
  120: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Nationals — Road Grey jersey
  // White Sox — same plain CDN mark as Main (ALT_USES_BASE_LOGO above), on a
  // pinstripe tile (TREATMENT_PINSTRIPE_COLOR below) for their Home Pinstripe
  // jersey; no `bg` flag on either swatch since the tile isn't a flat fill.
  145: [
    { label: 'Primary', hex: '#27251F' },
    { label: 'Secondary', hex: '#C4CED4' },
  ],
  138: [{ label: 'Background', hex: '#9DDFFF', bg: true }], // Cardinals — the bird-on-bat mark
  115: [{ label: 'Primary', hex: '#33006F', bg: true }], // Rockies
  118: [{ label: 'Baby Blue', hex: '#6DADF4', bg: true }], // Royals
  141: [{ label: 'All Blue', hex: '#041E42', bg: true }], // Blue Jays — jay-head mark (alternate/TOR.png)
  109: [
    { label: 'Primary', hex: '#A71930', bg: true },
    { label: 'Secondary', hex: '#E3D4AD' },
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
  111: [
    { label: 'Primary', hex: '#BD3039', bg: true },
    { label: 'Secondary', hex: '#0C2340' },
  ], // Red Sox — Alt 1 Red jersey
  113: [
    { label: 'Primary', hex: '#C6011F', bg: true },
    { label: 'Secondary', hex: '#000000' },
  ], // Reds — Alt 1 Red "Reds" Script jersey
  114: [{ label: 'Background', hex: '#00385D', bg: true }], // Guardians — Alt 2 Blue jersey
  116: [{ label: 'Orange', hex: '#FA4616', bg: true }], // Tigers — Old English "D" mark (alternate/DET.png), Alt 1 Orange jersey
  117: [{ label: 'Orange', hex: '#EB6E1F', bg: true }], // Astros — same plain CDN mark as Main (ALT_USES_BASE_LOGO above), Alt Orange jersey
  119: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Dodgers — Alt 1 Road Grey "Dodgers" jersey
  121: [{ label: 'Black', hex: '#000000', bg: true }], // Mets — procured mark (alternate/NYM.png), Alt 1 Black jersey
  134: [{ label: 'Black', hex: '#27251F', bg: true }], // Pirates — same plain CDN mark as Main (ALT_USES_BASE_LOGO above), Alt 1 Black "P" jersey
  142: [{ label: 'Navy', hex: '#002B5C', bg: true }], // Twins — Alt 2 Navy jersey
  143: [{ label: 'Cream', hex: '#F5F0E1', bg: true }], // Phillies — procured mark (alternate/PHI.png), Alt 1 Cream jersey
  133: [
    { label: 'Primary', hex: '#003831' },
    { label: 'Secondary', hex: '#EFB21E', bg: true },
    { label: 'Third', hex: '#A2AAAD' },
  ], // Athletics
  135: [{ label: 'Background', hex: '#2F241D', bg: true }], // Padres — Alt 1 Brown Pinstripe jersey
  136: [{ label: 'Background', hex: '#F5F0E1', bg: true }], // Mariners — offwhite, for their Home White jersey
  137: [
    { label: 'Secondary', hex: '#27251F' },
    { label: 'Third', hex: '#EFD19F', bg: true },
  ], // Giants — Main's Secondary plus its researched Cream extra; background is the Cream
  139: [
    { label: 'Primary', hex: '#092C5C' },
    { label: 'Secondary', hex: '#8FBCE6', bg: true },
    { label: 'Third', hex: '#F5D130' },
  ], // Rays — Alt 1 Baby Blue jersey
  140: [
    { label: 'Primary', hex: '#003278', bg: true },
    { label: 'Secondary', hex: '#C0111F' },
  ], // Rangers — same Primary/Secondary pair as Main; background is Primary
  // (navy), same hex the T-badge's own chroma-keyed-out fill used to be —
  // Alt 2 Blue jersey
  144: [
    { label: 'Primary', hex: '#CE1141', bg: true },
    { label: 'Secondary', hex: '#13274F' },
  ], // Braves
  146: [{ label: 'Background', hex: '#141414', bg: true }], // Marlins
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
  108: [{ label: 'Background', hex: '#faf6eb', bg: true }], // Angels
  121: [{ label: 'Background', hex: '#383a35', bg: true }], // Mets
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
  114: [{ label: 'Background', hex: '#00385D', bg: true }], // Guardians — "CLE" wordmark
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
  // White Sox — procured mark (city-connect/CWS.png), a red pinstripe tile
  // (TREATMENT_PINSTRIPE_COLOR below) instead of a flat fill; no `bg` flag,
  // same footing as the Alternate entry above.
  145: [{ label: 'Red', hex: '#C8102E' }],
  138: [{ label: 'Primary', hex: '#C41E3A', bg: true }], // Cardinals — "The Lou" mark on their standard red
  146: [{ label: 'Background', hex: '#000000', bg: true }], // Marlins
  158: [
    { label: 'Primary', hex: '#0C436A' },
    { label: 'Secondary', hex: '#ff6c58', bg: true },
  ], // Brewers
  141: [{ label: 'Background', hex: '#161827', bg: true }], // Blue Jays
  137: [{ label: 'Background', hex: '#27251F', bg: true }], // Giants — script "SF" mark, near-black brand secondary (temporary, pending real City Connect background)
  142: [{ label: 'Background', hex: '#00549f', bg: true }], // Twins
  116: [{ label: 'Background', hex: '#2c3357', bg: true }], // Tigers
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
// for their Alt 1 Cream jersey. Red Sox: their own procured mark
// (public/team-logos/alternate-2/BOS.png, no longer a copy of ALT_COLORS'
// Alternate art) for the Alt 2 Yellow jersey — Primary blue tile, Secondary
// gold for the mark's own outline.
// Team Identity Lab prototype only, same footing as ALT_COLORS/CITY_CONNECT_COLORS.
export const ALT2_COLORS = {
  108: [{ label: 'Red', hex: '#BA0021', bg: true }], // Angels — same plain CDN mark as Main (ALT2_USES_BASE_LOGO above), Alt 1 Red jersey
  109: [
    { label: 'Primary', hex: '#A71930' },
    { label: 'Secondary', hex: '#000000' },
    { label: 'Background', hex: '#A29E9F', bg: true },
  ], // Diamondbacks — procured mark (alternate-2/AZ.png), Away Grey jersey
  111: [
    { label: 'Primary', hex: '#307FE2', bg: true },
    { label: 'Secondary', hex: '#FFD100' },
  ], // Red Sox — new procured mark (alternate-2/BOS.png), Alt 2 Yellow jersey
  113: [{ label: 'Black', hex: '#000000', bg: true }], // Reds — same mark as Alternate (alternate-2/CIN.png, copied), Alt 2 Black "CINCY" jersey
  114: [{ label: 'Red', hex: '#E31937', bg: true }], // Guardians — same mark as Alternate (alternate-2/CLE.png, copied), Alt 1 Red jersey
  116: [{ label: 'Navy', hex: '#0C2340', bg: true }], // Tigers — same recolored-white Old English "D" as Main (alternate-2/DET.svg, ALT_LOGO_SVG above), Alt 2 Navy jersey
  117: [{ label: 'Navy', hex: '#002D62', bg: true }], // Astros — same plain CDN mark as Main (ALT2_USES_BASE_LOGO above), Alt Blue jersey
  119: [
    { label: 'Background', hex: '#005A9C', bg: true },
    { label: 'White', hex: '#FFFDF6' },
  ], // Dodgers — same mark as Alternate (alternate-2/LAD.png, copied), Alt 2 All Blue jersey
  121: [{ label: 'Blue', hex: '#002D72', bg: true }], // Mets — same mark as Alternate (alternate-2/NYM.png, copied), Alt 2 Blue Pullover jersey
  134: [{ label: 'Gold', hex: '#FDB827', bg: true }], // Pirates — same plain CDN mark as Main (ALT2_USES_BASE_LOGO above), Alt 2 Black "Pittsburgh" jersey
  135: [{ label: 'Green', hex: '#4B5320', bg: true }], // Padres — same mark as Alternate (alternate-2/SD.png, copied), Alt 2 Green Camouflage jersey
  139: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Rays — same mark as Alternate (alternate-2/TB.png, copied), Alt 2 White "Devil Rays" jersey
  142: [{ label: 'Navy', hex: '#002B5C', bg: true }], // Twins — Alt 1 Cream "Twin Cities" jersey
  143: [{ label: 'Baby Blue', hex: '#8ECAE6', bg: true }], // Phillies — same mark as Alternate (alternate-2/PHI.png, copied), Alt 2 Baby Blue jersey
  110: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Orioles — same plain CDN mark as Main (ALT2_USES_BASE_LOGO above), Home White jersey
  112: [{ label: 'Background', hex: '#7698CE', bg: true }], // Cubs
  144: [{ label: 'Background', hex: '#F5F0E1', bg: true }], // Braves — procured mark (alternate-2/ATL.png), off-white for their Home White jersey
  145: [{ label: 'Background', hex: '#000000', bg: true }], // White Sox — same plain CDN mark as Main (ALT2_USES_BASE_LOGO above), Alt 1 Black "Sox" jersey
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
  133: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Athletics — same plain CDN mark as Main (ALT2_USES_BASE_LOGO above), Road Grey jersey
  115: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Rockies — full circular "COLORADO ROCKIES" badge (alternate-2/COL.png), Away Grey jersey
}

// A third Alternate treatment. Marlins: a procured mark (public/team-logos/
// alternate-3/MIA.png, the throwback "F" marlin) on its own teal tile.
// Mariners: the cream "S" mark for their Steelheads alt, on black.
export const ALT3_COLORS = {
  108: [{ label: 'Background', hex: '#FFFFFF', bg: true }], // Angels — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Alt 2 White (Blue Trim) Pullover jersey
  109: [{ label: 'Background', hex: '#000000', bg: true }], // Diamondbacks — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Alt 1 Black jersey
  110: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Orioles — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Away Grey jersey
  111: [
    { label: 'Background', hex: '#FFFFFF', bg: true },
    { label: 'Primary', hex: '#BD3039' },
    { label: 'Secondary', hex: '#0C2340' },
  ], // Red Sox — same mark as Alternate (alternate-3/BOS.png, copied), Alt White Marathon "Boston" jersey
  112: [{ label: 'Blue', hex: '#0E3386', bg: true }], // Cubs — same mark as Alternate (alternate-3/CHC.png, copied from alternate/CHC.png), Away Grey jersey
  119: [
    { label: 'Gold', hex: '#FFD100' },
    { label: 'Background', hex: '#F6EFDC', bg: true },
  ], // Dodgers — same mark as Alternate (alternate-3/LAD.png, copied), "Gold Series" jersey
  135: [{ label: 'Sand', hex: '#C2B280', bg: true }], // Padres — same mark as Alternate (alternate-3/SD.png, copied), Alt 3 Sand Camouflage jersey
  136: [{ label: 'Background', hex: '#000000', bg: true }], // Mariners
  140: [{ label: 'Baby Blue', hex: '#8ECAE6', bg: true }], // Rangers — same mark as Alternate (alternate-3/TEX.png, copied), Alt 1 Baby Blue jersey
  144: [{ label: 'Grey', hex: '#A2AAAD', bg: true }], // Braves — procured mark (alternate-3/ATL.png), Away Greys jersey
  145: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // White Sox — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Alt 2 "Southside" jersey
  146: [{ label: 'Background', hex: '#009CA7', bg: true }], // Marlins
  141: [{ label: 'Background', hex: '#C22028', bg: true }], // Blue Jays — Canada Red jay-on-maple-leaf mark (alternate-3/TOR.png), Alt 4 Canada Red jersey
  120: [{ label: 'Navy', hex: '#14225A', bg: true }], // Nationals — same script "W" mark as Alternate 1 (alternate-3/WSH.png), Alt 2 Blue jersey
  158: [{ label: 'Powder Blue', hex: '#6CACE4', bg: true }], // Brewers — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Road Powder Blue jersey
  113: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Reds — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Away Grey jersey
  114: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Guardians — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Away Grey jersey
  116: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Tigers — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Away Grey jersey
  117: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Astros — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Road Grey jersey
  121: [{ label: 'Blue', hex: '#002d72', bg: true }], // Mets — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Away Grey jersey
  134: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Pirates — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Road Grey jersey
  139: [{ label: 'Navy', hex: '#092C5C', bg: true }], // Rays — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Away Blue jersey — their own Primary navy, not grey
  142: [{ label: 'Navy', hex: '#002B5C', bg: true }], // Twins — Away Grey jersey
  143: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Phillies — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Away Grey jersey
  138: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Cardinals — same plain CDN mark as Main (ALT3_USES_BASE_LOGO above), Road Grey jersey
}

// A fourth Alternate treatment. Blue Jays: same plain CDN mark as Main
// (ALT4_USES_BASE_LOGO), re-paired with a grey tile for their Away Grey
// jersey.
export const ALT4_COLORS = {
  141: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Blue Jays
  119: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Dodgers — same plain CDN mark as Main (ALT4_USES_BASE_LOGO above), Road Grey "Los Angeles" jersey
  135: [{ label: 'Brown', hex: '#2F241D', bg: true }], // Padres — same plain CDN mark as Main (ALT4_USES_BASE_LOGO above), Away Brown jersey — their own brand brown, not grey
  140: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Rangers — same plain CDN mark as Main (ALT4_USES_BASE_LOGO above), Away Grey jersey
  111: [{ label: 'Grey', hex: '#9EA2A2', bg: true }], // Red Sox — same plain CDN mark as Main (ALT4_USES_BASE_LOGO above), Away Grey jersey
}

// Whether `teamId` has an Alternate 2/3/4 set up at all — either curated
// colors (ALT2_COLORS/ALT3_COLORS/ALT4_COLORS) or an explicit plain-CDN-mark
// opt-in (ALT2_USES_BASE_LOGO/ALT3_USES_BASE_LOGO/ALT4_USES_BASE_LOGO). All
// are opt-in per team (unlike Main/Alternate/City Connect, which every club
// eventually gets), so Team Identity Lab skips rendering the tile entirely for
// a team with neither, rather than showing an empty placeholder.
export function hasAlternate2(teamId) {
  return !!(ALT2_COLORS[teamId] || ALT2_USES_BASE_LOGO.has(teamId))
}

export function hasAlternate3(teamId) {
  return !!(ALT3_COLORS[teamId] || ALT3_USES_BASE_LOGO.has(teamId))
}

export function hasAlternate4(teamId) {
  return !!(ALT4_COLORS[teamId] || ALT4_USES_BASE_LOGO.has(teamId))
}

// The tile/card background hex for a team's Alternate, Alternate 2/3/4, or
// City Connect treatment, or null if that team has no curated background yet
// (callers should fall back to their own neutral fill, same as a missing
// logo file). 'main'/'base' have no entry here — a standard jersey always
// renders on the plain paper fill everywhere outside Team Identity Lab.
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
export const TREATMENT_SCALE = byTreatment((f) => f.scale)

// Per-team, per-treatment pinstripe background for a non-Main tile — same
// hand-styled line-on-a-fill pattern as MAIN_OVERRIDES' `pinstripe`
// (mainTreatmentPinstripe/mainTreatmentPinstripeColor), just for Alternate/
// City Connect/Alternate 2 instead of Main. A plain string is just the line
// color, white fill implied (the common case — the shared black default
// every other pinstriped tile uses); `{ color, bg }` swaps in a colored fill
// under the stripes instead of white (White Sox City Connect's red).
export const TREATMENT_PINSTRIPE_COLOR = byTreatment((f) =>
  f.pinstripeColor === undefined
    ? undefined
    : f.pinstripeBg
      ? { color: f.pinstripeColor, bg: f.pinstripeBg }
      : f.pinstripeColor,
)

export function treatmentPinstripeColor(teamId, treatment) {
  const v = TREATMENT_PINSTRIPE_COLOR[teamId]?.[treatment]
  if (v && typeof v === 'object') return v.color
  return v ?? null
}

// The colored fill under a pinstriped non-Main tile's lines, or null for the
// plain-white default every other pinstriped tile gets (see
// treatmentPinstripeColor above for the same string-vs-object split).
export function treatmentPinstripeBg(teamId, treatment) {
  const v = TREATMENT_PINSTRIPE_COLOR[teamId]?.[treatment]
  return (v && typeof v === 'object' && v.bg) || null
}

// Per-team, per-treatment header-chrome recolor — `{ bar, accent, onBar }`:
// the bar's fill, its kraft-tape bottom edge, and the ink on it. Promoted out
// of the Team Identity Lab's Header colors editor once a proposal is settled,
// same "propose in the page, land in this table" path
// TREATMENT_SCALE/TREATMENT_PINSTRIPE_COLOR above already follow.
//
// This table SHIPS now: it dresses the lineup page's club-name bar and section
// mastheads in whatever jersey that club is wearing that game (ADR-0030).
// Coverage is partial by design — a (team, treatment) with no entry falls back
// to the app's default navy chrome. Read it through `lib/headerTheme.js`, never
// directly; `scripts/check-contrast.mjs` asserts every entry's `onBar` clears
// WCAG AA against its `bar`, which is what makes a hand-tuned pair safe to
// ship.
//
// The names are deliberately semantic rather than the `{ blue, gold, font }`
// they started as: those named the DEFAULT navy chrome's own colors, which
// stops meaning anything once a club's bar is red.
export const TREATMENT_HEADER_COLOR_OVERRIDES = byTreatment((f) => f.header, {
  includeMain: true,
})

// The jerseys.json/mlb-treatment-tuning.json treatment vocabulary — the only
// strings `treatmentHeaderColorOverride` may collapse onto a club's bar.
// Exported so test/identity-lab-stores.test.js's own coverage check shares
// this one list instead of keeping a second copy that could drift.
export const MLB_TREATMENT_KEYS = new Set([
  'main',
  'alternate',
  'alternate-2',
  'alternate-3',
  'alternate-4',
  'city-connect',
])

// Two bars per club, not one per treatment: every jersey wears the club's
// Main header EXCEPT City Connect, which gets its own. A caller passes
// whichever treatment the club is actually in ('alternate', 'alternate-3', …)
// and this collapses it to the one of two stores that answers it, so an
// alternate jersey was never a third color to hand-tune in the first place.
// A string outside MLB_TREATMENT_KEYS (a MiLB game SIDE, a typo) answers null
// rather than collapsing to Main — otherwise a MiLB id's 'home'/'away' passed
// here by mistake would silently wear an MLB club's bar the moment that club
// landed one (see headerThemeFor's cross-vocabulary test).
export function treatmentHeaderColorOverride(teamId, treatment) {
  if (!MLB_TREATMENT_KEYS.has(treatment)) return null
  const slot = treatment === 'city-connect' ? 'city-connect' : 'main'
  return TREATMENT_HEADER_COLOR_OVERRIDES[teamId]?.[slot] ?? null
}

export function treatmentScale(teamId, treatment) {
  return TREATMENT_SCALE[teamId]?.[treatment] ?? 1
}

// Horizontal nudge (percent of the tile's own width, negative = left) for a
// mark whose visual weight sits off-center once scaled up — CSS translateX,
// applied before scale. Lab-only so far: no shipped surface renders these
// tiles large enough for the off-center weight to matter, so the game card and
// masthead never ask for it. Kept here rather than in the lab (where it lived
// as a page-local literal) so the whole per-treatment record has one home.
export function treatmentOffsetX(teamId, treatment) {
  return treatmentTuning(teamId, treatment)?.offsetX ?? 0
}

// The vertical counterpart to treatmentOffsetX, same units and same lab-only
// footing.
export function treatmentOffsetY(teamId, treatment) {
  return treatmentTuning(teamId, treatment)?.offsetY ?? 0
}

// Vertical anchor for the edge-bleed scale-up — CSS transform-origin-y. The
// 'center' default bleeds evenly off all four edges; 'top' (or a percentage)
// anchors the mark higher so the overscale only bleeds off the bottom, keeping
// the mark's full size without clipping its top/sides.
export function treatmentOriginY(teamId, treatment) {
  return treatmentTuning(teamId, treatment)?.originY ?? 'center'
}

// The whole tuning record for a (team, treatment), for the Team Identity Lab's
// own "what's landed right now" reads — every other caller should go through
// the named resolvers above.
export function treatmentTuningRecord(teamId, treatment) {
  return treatmentTuning(teamId, treatment)
}

// Per-team tuning for the Main/default logo tile — first designed on Team
// Color Lab as a prototype-only "what if every club's default tile had a
// colored background" pass (see that page's own history), now promoted here
// so the real home-page game card can share it: `bg` names which of the
// team's Primary/Secondary/Accent triad (mlb-team-colors.json,
// mainColorForRole below) fills the tile; whether the mlbstatic base mark
// swaps for a locally hand-edited one is decided separately, by file
// presence (mainOverrideLogoUrl below), for a club whose CDN mark doesn't
// read against the new fill (e.g. a navy-outlined mark on a navy tile);
// `scale` overrides the tile's default 1.32 edge-bleed for a mark
// that's especially dense/large at that fill. `pinstripe` (Rockies, Yankees)
// is a hand-styled background instead of a flat swatch — see
// mainTreatmentPinstripe/mainTreatmentPinstripeColor. `bgHex` (Brewers only)
// is a literal fill color that isn't any of the club's three brand
// swatches — takes priority over `bg` in mainTreatmentTint. A team with no
// entry here gets no tint, same as a missing Alternate/City Connect logo.
// Main's own slice of a team's `main` tuning record. The record also carries
// the fields every other treatment has (offsetX/offsetY/originY/header/note),
// which were never part of MAIN_OVERRIDES and must not leak into it — a team
// whose only Main tuning is a header-color proposal has no Main tile override
// at all, and gets no entry.
const MAIN_OVERRIDE_FIELDS = ['bg', 'bgHex', 'pinstripe', 'pinstripeColor', 'scale']

function mainOverrideFields(main) {
  if (!main) return null
  const out = {}
  for (const key of MAIN_OVERRIDE_FIELDS) if (main[key] !== undefined) out[key] = main[key]
  return Object.keys(out).length ? out : null
}

export const MAIN_OVERRIDES = Object.fromEntries(
  Object.entries(MLB_TREATMENT_TUNING)
    .map(([teamId, entry]) => [teamId, mainOverrideFields(entry.treatments?.main)])
    .filter(([, fields]) => fields),
)

// A team's triad color by role name — 'primary'/'secondary' from
// TEAM_COLOR_PAIRS, 'accent' from TEAM_COLORS — the named-field counterpart to
// the old array-indexed teamColorSwatches() lookup, so a Main tile's `bg` role
// override (MAIN_OVERRIDES) always reads the exact same value the Team
// Identity Lab's editable triad shows and saves, never a differently-deduped one.
// 'third' is accepted as the pre-rename spelling of 'accent': no entry in
// mlb-treatment-tuning.json uses it (only 'primary' and 'secondary' appear
// today), but `bg` is hand-authored in that JSON, so an older spelling resolves
// rather than silently going null.
function mainColorForRole(teamId, role) {
  if (role === 'primary') return TEAM_COLOR_PAIRS[teamId]?.[0] ?? null
  if (role === 'secondary') return TEAM_COLOR_PAIRS[teamId]?.[1] ?? null
  if (role === 'accent' || role === 'third') return TEAM_COLORS[teamId] ?? null
  return null
}

// One club's pinstripe tile keeps the plain mlbstatic mark on purpose even
// though a main-overrides file exists on disk (COL.svg — an earlier
// exploration the team's own tuning note says explicitly not to use: "the
// plain mlbstatic mark reads fine against white"). Everything else follows
// disk presence alone, same as localLogoUrl's alternates — this is the one
// hand-maintained exception to that, not a whitelist of what's allowed to
// render.
const MAIN_USES_BASE_LOGO = new Set([115])

// The locally hand-edited Main-treatment mark for `teamId`, straight off
// whatever the upload endpoint (or a hand-procured file) actually left in
// public/team-logos/main-overrides/ — read from the manifest that upload
// rewrites on every save (logo-art.json, ADR-0029), so a new upload needs no
// companion code or data change to take effect. PNG wins when a team
// somehow has both (WSH: a hand-authored .svg predates its procured .png).
// Null for a team with no file there, or one of the two MAIN_USES_BASE_LOGO
// exceptions above; callers fall back to the normal CDN base logo
// (teamLogoUrl(teamId, 'base')).
export function mainOverrideLogoUrl(teamId) {
  if (MAIN_USES_BASE_LOGO.has(teamId)) return null
  const abbr = teamAbbr({ id: teamId })
  if (!abbr) return null
  const entries = LOGO_ART['main-overrides'] ?? {}
  const ext = entries[`${abbr}.png`] ? 'png' : entries[`${abbr}.svg`] ? 'svg' : null
  return ext ? `/team-logos/main-overrides/${abbr}.${ext}` : null
}

// The Main tile's background hex for `teamId`, or null for a team with no
// curated tile yet (pinstripe teams also return null here — their tile is a
// hand-styled pattern, not a flat swatch; see mainTreatmentPinstripe).
export function mainTreatmentTint(teamId) {
  const override = MAIN_OVERRIDES[teamId]
  if (override?.bgHex) return override.bgHex
  if (!override?.bg) return null
  return mainColorForRole(teamId, override.bg)
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
// (mainOverrideLogoUrl) rather than the plain mlbstatic CDN base logo — true
// exactly when that file exists, per mainOverrideLogoUrl above.
export function mainTreatmentRecolor(teamId) {
  return !!mainOverrideLogoUrl(teamId)
}

// Everything one "logo tile" needs to render for a (team, treatment): the
// mark to show and the fill it sits on.
//   { logoVariant, tint, pinstripeColor, pinstripeBg, scale }
// `tint` is null when the tile is pinstriped (a pattern, not a swatch — see
// mainTreatmentPinstripe) or when a club has no curated tile for this
// treatment yet, in which case the caller's own default paper shows through.
// `pinstripeBg` is null for the plain-white-fill default every pinstriped
// tile gets except White Sox City Connect (see treatmentPinstripeBg above).
//
// One resolver because the same tile now appears in three places — the slate
// card (components/GameCard.jsx), the in-game masthead (screens/GameView.jsx),
// and Team Identity Lab's curation grid — and a club whose mark needs a
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
      pinstripeBg: null,
      scale: mainTreatmentScale(teamId),
    }
  }
  const pinstripeColor = treatmentPinstripeColor(teamId, treatment)
  return {
    logoVariant: treatment,
    tint: pinstripeColor ? null : treatmentBgColor(teamId, treatment),
    pinstripeColor,
    pinstripeBg: pinstripeColor ? treatmentPinstripeBg(teamId, treatment) : null,
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
// ids have no entry and callers must degrade (see teamTintColor). Sourced from
// mlb-team-colors.json's `accent` field (ADR-0029) — the same store the Team
// Identity Lab's editable Accent swatch reads and writes, so this table and
// that swatch can never disagree.
//
// The field is `accent`, NOT `third`, and the distinction is load-bearing: for
// 27 of 30 clubs this hex deliberately restates the club's own primary or
// secondary, because the pick optimizes for "tells two clubs apart" rather than
// "a third color the club owns". A real third-or-later brand color lives in
// `extras` (teamColorExtras below) and must never be conflated with this one.
const TEAM_COLORS = byTeam(MLB_TEAM_COLORS, (e) => e.accent)

// Extra current-era brand colors beyond a club's primary/secondary/accent —
// only for clubs with a well-documented third-or-later color in their CURRENT
// identity (no retro/throwback-only palettes: e.g. the White Sox's navy/red
// "Southside" alternate and the Brewers'/Marlins'/Blue Jays' pre-rebrand
// palettes are deliberately excluded). Cross-checked against Wikipedia team
// infoboxes and teamcolorcodes.com (2026-07-17); skipped rather than guessed
// wherever sources disagreed on the hex (e.g. Orioles' gray, Royals' powder
// blue). A club with no entry simply has no documented color beyond the pair
// plus accent — 14 of 30 have one today.
//
// Decorative and lab-facing only; no spoiler-facing surface reads it. Held as
// data in mlb-team-colors.json (ADR-0029) rather than as a JS literal so this
// research survives an edit in the Team Identity Lab instead of being a table
// the lab can only read and then silently drop.
export function teamColorExtras(teamId) {
  return MLB_TEAM_COLORS[teamId]?.extras ?? []
}

// `hex` -> `rgba(r, g, b, alpha)` so a team color can sit as a soft tint
// behind a headshot rather than a solid brand-colored block. `teamId` may be
// an MLB club — which uses the rival-distinguishing accent above — or a MiLB
// affiliate, which goes through brandColors.js's chain: its OWN researched
// primary first, its parent org's only as a fallback. That order is why a
// Durham Bulls headshot tints Bulls blue rather than Rays navy; before July
// 2026 this read MILB_PARENT_ORG directly and never saw the affiliate at all.
// Returns null for a team with no known color (an unaffiliated/complex-league
// MiLB id) — callers should skip the tint entirely rather than render a
// wrong/generic color.
export function teamTintColor(teamId, alpha = 0.22) {
  const hex = TEAM_COLORS[teamId] ?? milbBrandPair(teamId)?.[0]
  if (!hex) return null
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// `teamId`'s [primary, secondary] brand-color pair — an MLB club's own, or a
// MiLB affiliate's through brandColors.js's chain (its own researched pair,
// then its parent org's) — or null for a team with no known pair (an
// unaffiliated/complex-league MiLB id). Shared by every TEAM_COLOR_PAIRS reader
// below so the affiliate-fallback rule lives in exactly one place, and it is
// the SAME place teamTintColor above reads.
function resolveTeamColorPair(teamId) {
  return TEAM_COLOR_PAIRS[teamId] ?? milbBrandPair(teamId) ?? null
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

