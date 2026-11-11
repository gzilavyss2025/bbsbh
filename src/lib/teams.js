// Static configuration that never needs a network call. This module owns the
// tuning stores, the logo URL builders and every MLB tile resolver
// (treatmentTile). Its other jobs live in teams/ and are re-exported here, so
// an importer keeps one path (#3039):
//   teams/levels.js     sportIds and the level toggles
//   teams/names.js      club names, abbreviations and ids
//   teams/headshots.js  player and coach headshot URLs
//   teams/clubColors.js accent, tint, chip and favourite-accent colours

import { isFriday } from './dates.js'
import { LOGO_CDN_BASE as LOGO_BASE, LOGO_VARIANTS } from './logo/logoCdn.js'
import { TEAM_COLOR_PAIRS, MLB_TEAM_COLORS } from './colors/brandColors.js'
import { byTreatment as byTreatmentIn, liveStore, treatmentRecord } from './tuningStore.js'
import { registerIdentityStore } from './identity/overlay.js'
import { customMarkFor } from './logo/customMarks.js'
import MLB_TREATMENT_TUNING_JSON from './data/mlb-treatment-tuning.json' with { type: 'json' }
import LOGO_ART from './data/logo-art.json' with { type: 'json' }
import MONO_LOGO_MANIFEST from './data/mono-logo-manifest.json' with { type: 'json' }
import ALT_COLORS_JSON from './data/alt-colors.json' with { type: 'json' }
import ALT2_COLORS_JSON from './data/alt2-colors.json' with { type: 'json' }
import ALT3_COLORS_JSON from './data/alt3-colors.json' with { type: 'json' }
import ALT4_COLORS_JSON from './data/alt4-colors.json' with { type: 'json' }
import CITY_CONNECT_COLORS_JSON from './data/city-connect-colors.json' with { type: 'json' }
import { logoUrlOverride, logoUrlOverrideForVariant } from './identity/logoUrlOverrides.js'
import { teamAbbr, isMlbTeamId } from './teams/names.js'
import { TEAM_COLORS } from './teams/clubColors.js'

export * from './teams/levels.js'
export * from './teams/names.js'
export * from './teams/headshots.js'
export * from './teams/clubColors.js'

// Registered with the key their RUNTIME overrides are filed under, then read
// only through tuningStore's readers — so a value retuned from a club's own page
// reaches every resolver below without any of them knowing an overlay exists
// (src/lib/identity/overlay.js, ADR-0050). Beside the imports rather than in one
// central module: one file importing all ten stores would pull
// data/wpa-tuning.json back into the eager entry chunk.
const MLB_TUNING_STORE = registerIdentityStore('mlb-treatment-tuning', MLB_TREATMENT_TUNING_JSON)
const ALT_STORE = registerIdentityStore('alt-colors', ALT_COLORS_JSON)
const ALT2_STORE = registerIdentityStore('alt2-colors', ALT2_COLORS_JSON)
const ALT3_STORE = registerIdentityStore('alt3-colors', ALT3_COLORS_JSON)
const ALT4_STORE = registerIdentityStore('alt4-colors', ALT4_COLORS_JSON)
const CITY_CONNECT_STORE = registerIdentityStore('city-connect-colors', CITY_CONNECT_COLORS_JSON)

// The per-team, per-treatment tile tuning the Team Identity Lab writes back to
// (src/lib/data/mlb-treatment-tuning.json, ADR-0029) — re-exported so that lab
// has one thing to read, edit, and POST as a whole file. Everything else in
// this module reads it through the derived tables below, which keep the exact
// shapes (and the exact resolver semantics) the app had when these were JS
// literals. See src/lib/data/CLAUDE.md for the store's schema.
//
// The OVERLAID view rather than the raw file, so the lab and the app cannot
// disagree about what is landed. Under `vite dev` the overlay is always empty —
// /api/identity is a Vercel function and the dev server serves none — so in the
// one place the lab's Save works, this is the file byte for byte.
export const MLB_TREATMENT_TUNING = liveStore(MLB_TUNING_STORE)

// Same idea, one store per non-Main treatment's background swatches (ALT_COLORS
// and friends below, ADR-0029) — re-exported so the lab can merge a swatch edit
// in and POST the whole file back, same as every other dimension it saves.
export const ALT_COLORS_STORE = liveStore(ALT_STORE)
export const ALT2_COLORS_STORE = liveStore(ALT2_STORE)
export const ALT3_COLORS_STORE = liveStore(ALT3_STORE)
export const ALT4_COLORS_STORE = liveStore(ALT4_STORE)
export const CITY_CONNECT_COLORS_STORE = liveStore(CITY_CONNECT_STORE)

// The derived-table shape every reader of ALT_COLORS/ALT2_COLORS/etc actually
// wants: `{ teamId: swatches }`, the exact shape these were as JS literals
// before they moved to src/lib/data/*-colors.json. The `note` a store entry
// carries is prose for a human reading the JSON, same as a tuning record's
// `note` — nothing here reads it back.
function swatchesFromColorStore(store) {
  return Object.fromEntries(Object.entries(store).map(([teamId, entry]) => [teamId, entry.swatches]))
}

// Every field of a (team, treatment) tuning record, or null. `treatment` uses
// the jerseys.json vocabulary ('main' / 'alternate' / 'alternate-2…4' /
// 'city-connect'). Exported for the Team Identity Lab's own "what's landed
// right now" reads — every other caller should go through the named resolvers
// below (treatmentOffsetX/Y, treatmentOriginY).
export function treatmentTuning(teamId, treatment) {
  return treatmentRecord(MLB_TUNING_STORE, teamId, treatment)
}

// tuningStore's byTreatment, bound to this store and defaulting to the
// Main-excluding behaviour these MLB tables need (see its own doc comment).
function byTreatment(pick, { includeMain = false } = {}) {
  return byTreatmentIn(MLB_TUNING_STORE, pick, { includeMain })
}



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
// The base URL and the three *distinct* per-variant marks a club's page draws
// from (the cap logo, the full primary logo, and the script wordmark) live in
// logoCdn.js — a leaf module scripts/lib/mono-logo-art.mjs (plain Node, not a
// Vite module) also imports, so the app and the mono-knockout generator can
// never build these URLs two different ways. We use the `-on-light` treatment
// throughout since every surface that renders a logo is the app's light
// "paper"; the one dark surface, the navy section mastheads, wears the
// locally precomputed `mono` mark below rather than the CDN's own `-on-dark`
// variant, which keeps each club's REAL colors (verified live: only a
// mostly-monochrome mark like the Yankees' actually turns white there; a
// multicolor mark like the Brewers' does not) — not the uniform one-color
// lockup this app wants. There is NO alternate / per-uniform / home-road mark
// on this CDN (those paths 404), so this is the full set. `base` is the plain
// `{id}.svg` default that every existing caller already uses.
export { LOGO_VARIANTS }

// The `mono` variant is NOT on this CDN — it's the one-color knockout mark the
// navy section mastheads wear, precomputed from the base art by
// scripts/gen-mono-logos.mjs and served same-origin from here (see
// src/lib/logo/logoMono.js for how it's built, ADR-0031 for why). Coverage tracks
// public/data/teams.json, so a brand-new affiliate can be missing until that
// generator next runs — which is what TeamLogo's variant -> base fallback is
// for: that club just wears its full-color mark on the bar until the art
// exists.
const MONO_LOGO_BASE = '/data/logos/mono'

// Whether this club actually HAS a precomputed knockout mark. Most consumers
// don't need to ask — TeamLogo's own variant -> base fallback (an <img> that
// 404s retries the CDN mark) covers them. The Logbook stamp does, because its
// mark is an <image> inside an SVG <mask>: a 404 there paints nothing at all
// rather than falling back, so the stamp has to know in advance to draw the
// club's abbreviation in that slot instead (the documented fallback, see
// .scratch/game-stamps/designs/stamp-concepts.md's "Team marks" rules).
export function hasMonoLogo(teamId) {
  return Boolean(MONO_LOGO_MANIFEST[String(teamId)])
}

// mono-logo-manifest.json (also written by gen-mono-logos.mjs) maps teamId to
// a content hash of that club's precomputed knockout SVG, appended below as
// `?v=`. The deployed PWA caches these SVGs CacheFirst for up to 30 days
// (vite.config.js) — without a version in the URL, a browser that already
// visited a club would keep serving its stale cached mark until that cache
// entry's own expiry, long after a corrected file (approved in
// `/identity-lab`, landed via mono-ink.json) had actually shipped. The hash
// changing the URL means a corrected mark reaches every visitor on the very
// next deploy instead. A team missing from the manifest (not yet generated)
// just gets an unversioned URL, same as before this existed.

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

// A bar's masthead mark override lives under a synthetic assignment key in
// custom-marks.json — never a real treatment: none of these appears in
// jerseys.json or any tuning store (ADR-0031's addendum). Only
// `city-connect-masthead` is ALSO an upload destination (logoArt.js's
// LOGO_TREATMENT_DIRS, from the earlier amendment that let that one bar take a
// dropped PNG); the other two are assignment keys only, so a paste is the only
// way into them.
export const MASTHEAD_MARK_KEYS = {
  main: 'main-masthead',
  'city-connect': 'city-connect-masthead',
  milb: 'milb-masthead',
}

// The closed set the dev assign endpoint accepts alongside the real treatment
// directories, so a masthead key needs no upload directory to be assignable.
export const MASTHEAD_MARK_ASSIGN_KEYS = new Set(Object.values(MASTHEAD_MARK_KEYS))

// Which BAR a club wears while it's in this jersey — the grouping every
// masthead override is keyed by (logoArt.js's MASTHEAD_MARK_KEYS).
//
// Deliberately the same grouping the colour triads already use, and NOT one
// answer per jersey: `treatmentHeaderColorOverride` sends Main and every
// alternate to one bar and City Connect to the other, and MiLB's
// `milbHeaderColorOverride` sends Home and Away to a single bar. A club has
// fewer bars than jerseys, and a masthead is a fact about the bar.
export function mastheadBarFor(teamId, treatment) {
  if (!isMlbTeamId(teamId)) return 'milb'
  return treatment === 'city-connect' ? 'city-connect' : 'main'
}

// A club's own override for the mark its themed `.metricbar` mastheads draw on
// one BAR — normally the club-wide precomputed knockout SVG every masthead
// shares (ADR-0031's `mono` variant), here swapped for that club's own art on
// that one bar, with every other bar left alone.
//
// TWO ways in, checked in this order, both written by the Identity Lab:
//
//   1. An ASSIGNED library mark (custom-marks.json) — an SVG pasted into the
//      bar's own mark panel, kept as-is or converted to a knockout there, or
//      one recolored by the Logo art editor. A pointer, so clearing it hands
//      the mark below straight back.
//   2. An uploaded PNG — CITY CONNECT ONLY, because that is the one bar with an
//      upload directory (the earlier amendment that introduced it). Read the way
//      mainOverrideLogoUrl reads main-overrides/: off the manifest an upload
//      rewrites on every save (logo-art.json, ADR-0029), so a fresh drop needs
//      no companion code change to take effect.
//
// The assignment wins because it is the one a click can undo — a PNG has to be
// deleted off disk, so letting it outrank a pointer would make the pointer
// unusable on any club that ever had one dropped on it.
//
// Null for a bar with neither (the overwhelming majority), for an unknown bar,
// and for City Connect on a club that doesn't wear one — callers fall back to
// the normal club-wide mono mark exactly as an absent mainOverrideLogoUrl falls
// back to the CDN base logo.
export function mastheadMarkUrl(teamId, bar) {
  const key = MASTHEAD_MARK_KEYS[bar]
  if (!key) return null
  if (bar === 'city-connect' && !hasCityConnect(teamId)) return null
  return pickMastheadMark(customMarkFor(teamId, key), uploadedMastheadPng(teamId, bar))
}

// The City Connect bar's uploaded-PNG rung, and only that bar's: the other two
// have no upload directory, so there is nothing on disk for them to find.
function uploadedMastheadPng(teamId, bar) {
  if (bar !== 'city-connect') return null
  const abbr = teamAbbr({ id: teamId })
  const entries = LOGO_ART['masthead-city-connect'] ?? {}
  return abbr && entries[`${abbr}.png`] ? `/team-logos/masthead-city-connect/${abbr}.png` : null
}

// The precedence above, on its own so it can be pinned without needing a real
// entry in the committed store — the same reason customMarks.js splits
// parseMarkAssignmentKey out of customMarkFor.
//
// A `cdn:` assignment (which customMarkFor answers as `{ cdnVariant }`, no
// `url`) is IGNORED rather than resolved. These slots exist for art the knockout
// pipeline cannot produce, and a stock CDN vector is precisely what that
// pipeline already converts — resolving one here would hand the bar a
// full-color mark that nothing re-inks.
export function pickMastheadMark(assigned, uploadedUrl) {
  return assigned?.url ?? uploadedUrl ?? null
}

// A club's own curated pick for its home/away predictive fallback
// (mlb-team-colors.json's `defaultHomeTreatment`/`defaultAwayTreatment`,
// edited from the Team Identity Lab) — the side-scoped counterpart to
// offDayTreatmentFor below. Absent for every club that hasn't set one, so
// defaultTreatmentFor falls through to its own Friday/City-Connect heuristic.
export function defaultHomeTreatmentFor(teamId) {
  return MLB_TEAM_COLORS[teamId]?.defaultHomeTreatment ?? null
}

export function defaultAwayTreatmentFor(teamId) {
  return MLB_TEAM_COLORS[teamId]?.defaultAwayTreatment ?? null
}

// Predictive fallback tile for a game whose actual worn jersey hasn't posted
// yet (jerseyTreatmentFor/api/jerseys.js returns null pre-game) — a best
// guess, not a fact, so jerseyTreatmentFor's real data always overrides it
// the moment it posts, including a confirmed-standard game (gen-jerseys.mjs
// stores 'main' explicitly rather than omitting it, precisely so a guess
// this function gets wrong — e.g. a Friday city-connect club that wore its
// plain jersey that night — doesn't stand uncorrected once Final). A club's
// own curated default for that side (above) wins outright over the
// heuristic below it. Absent that, away always predicts the plain Main mark
// (the away grey/road look — several clubs' Main tile is already re-paired
// with a grey fill for exactly that jersey, see ALT_USES_BASE_LOGO above). A
// home game on a Friday predicts City Connect for any club that has one,
// since Friday is most clubs' scheduled City Connect night.
export function defaultTreatmentFor(teamId, side, apiDate) {
  const curated = side === 'home' ? defaultHomeTreatmentFor(teamId) : defaultAwayTreatmentFor(teamId)
  if (curated) return curated
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
  143, // Phillies — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with a grey tile for their Away Grey jersey
])

// Same idea as ALT_USES_BASE_LOGO, but for the Alternate 4 treatment.
const ALT4_USES_BASE_LOGO = new Set([
  141, // Blue Jays — same plain CDN mark as Main, re-paired with a grey tile for their Away Grey jersey
  119, // Dodgers — same plain CDN mark as Main, re-paired with a grey tile for their Road Grey "Los Angeles" jersey
  135, // Padres — same plain CDN mark as Main (Main's own is a locally recolored copy), re-paired with a brown tile for their Away Brown jersey
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
// customMarkFor's result, resolved to an actual URL — a bare `.url` for a
// custom (recolored-in-the-lab) mark, or a `teamLogoUrl` lookup for a `cdn:`
// assignment (LogoDropZone's "Replace art" select can point a treatment at
// the CDN's own base/primary/cap/wordmark instead of a saved recolor;
// customMarks.js can't resolve that variant itself without importing this
// file right back, so it hands the variant name up instead).
function resolveAssignedMark(teamId, assigned) {
  return assigned.cdnVariant ? teamLogoUrl(teamId, assigned.cdnVariant) : assigned.url
}

// Never called for 'main' — that treatment renders the CDN base logo instead.
export function localLogoUrl(teamId, treatment) {
  // A mark recolored in the lab and ASSIGNED to this treatment wins, because
  // an assignment is an override that leaves the procured file untouched
  // (src/lib/logo/customMarks.js) — clearing it brings the art below straight back.
  const assigned = customMarkFor(teamId, treatment)
  if (assigned) return resolveAssignedMark(teamId, assigned)
  const abbr = teamAbbr({ id: teamId })
  if (!abbr) return null
  const ext = ALT_LOGO_SVG.has(`${teamId}:${treatment}`) ? 'svg' : 'png'
  return `/team-logos/${treatment}/${abbr}.${ext}`
}

export function teamLogoUrl(teamId, variant = 'base') {
  if (!teamId) return null
  // A runtime logo override (the team hub drawer's upload/URL, ADR-0050) wins
  // outright for a treatment tile — checked before the custom-mark assignment
  // and the *_USES_BASE_LOGO early returns, which would otherwise shadow it
  // for exactly the clubs those sets name (identity/logoUrlOverrides.js).
  const runtimeMark = logoUrlOverrideForVariant(teamId, variant)
  if (runtimeMark) return runtimeMark
  // A custom-mark assignment (LogoDropZone's "Replace art" select — a saved
  // recolor, or one of the CDN's own vectors) is an explicit override and
  // must win outright, even for a treatment in one of the *_USES_BASE_LOGO
  // sets below — those exist only to say "no procured local file", which an
  // assignment supersedes exactly the way it does for every other team
  // (localLogoUrl's own customMarkFor check). Checked first so this early
  // return can't shadow it the way it used to (a real, landed assignment
  // silently ignored — see the Athletics' Alternate 2).
  if (
    (variant === 'alternate' ||
      variant === 'alternate-2' ||
      variant === 'alternate-3' ||
      variant === 'alternate-4') &&
    customMarkFor(teamId, variant)
  ) {
    return localLogoUrl(teamId, variant)
  }
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
  // team id rather than abbreviation — see logoArt.js's MILB_LOGO_DIRS. Same
  // customMarkFor check localLogoUrl does above: a mark recolored in the lab
  // and assigned to this side wins, since the assignment is an override that
  // leaves the procured file untouched (src/lib/logo/customMarks.js).
  if (variant === 'milb-home' || variant === 'milb-away') {
    const assigned = customMarkFor(teamId, variant)
    if (assigned) return resolveAssignedMark(teamId, assigned)
    return `/team-logos/${variant}/${teamId}.png`
  }
  if (variant === 'mono') {
    const hash = MONO_LOGO_MANIFEST[String(teamId)]
    return hash ? `${MONO_LOGO_BASE}/${teamId}.svg?v=${hash}` : `${MONO_LOGO_BASE}/${teamId}.svg`
  }
  if (variant === 'base') return `${LOGO_BASE}/${teamId}.svg`
  const v = LOGO_VARIANTS.find((x) => x.key === variant)
  return v ? `${LOGO_BASE}/${v.path}/${teamId}.svg` : `${LOGO_BASE}/${teamId}.svg`
}

// The same CDN also serves a plain MLB league mark (the silhouetted-batter
// logo) under team id 1 in the "league" subfolder — verified live, a
// real logo, not the base logo echoed back. Used for the prospect-rank
// badges, which aren't tied to any one club.
// `id` 103 / 104 gives the American / National League mark (Gary, 2026-10-30).
export function leagueLogoUrl(id = 1) {
  return `${LOGO_BASE}/league-on-light/${id}.svg`
}

// Alternate/City Connect tile-background colors — hand-curated together with
// each team's curated logo file (localLogoUrl above), since these marks don't
// carry an official Primary/Secondary/Accent set the way Main does
// (mlb-team-colors.json). Single source of truth for Team Identity Lab's swatch
// tiles AND the home-page game card's jersey-variant background
// (treatmentBgColor below) — both read the same curated set rather than
// drifting. Each entry is a small swatch list; the one flagged `bg: true` is
// the color actually used as a fill. A team with no entry here has no known
// background yet — callers should leave their surface plain rather than
// render nothing.
//
// These five tables used to be JS literals with a per-entry comment (which
// mark, which jersey, any curation notes); they moved to
// src/lib/data/{alt,alt2,alt3,alt4,city-connect}-colors.json (ADR-0029) so the
// lab's Save button can write a swatch edit back same as it does scale/offset
// — each entry's old trailing comment is now that entry's `note` field. The
// Rockies' #33006F (ALT_COLORS[115]) is deliberately NOT their Main Primary
// (#333366): it is a proposed purple that stays scoped to this narrow, opt-in
// Alternate background rather than being promoted into the app-wide brand
// pair. Promoting it means editing 115.primary in mlb-team-colors.json on
// purpose, and it would retint every surface teamPrimaryColor feeds.
export const ALT_COLORS = liveStore(ALT_STORE, swatchesFromColorStore)
export const CITY_CONNECT_COLORS = liveStore(CITY_CONNECT_STORE, swatchesFromColorStore)
export const ALT2_COLORS = liveStore(ALT2_STORE, swatchesFromColorStore)
export const ALT3_COLORS = liveStore(ALT3_STORE, swatchesFromColorStore)
export const ALT4_COLORS = liveStore(ALT4_STORE, swatchesFromColorStore)

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
const TREATMENT_PINSTRIPE_COLOR = byTreatment((f) =>
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
// to the app's default navy chrome. Read it through `lib/colors/headerTheme.js`, never
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
// applied before scale. Read by treatmentTile, so every surface that resolves
// a tile through it (the slate card, the in-game masthead, Team Identity Lab's
// own grid) applies the same nudge. Kept here rather than in the lab (where it
// lived as a page-local literal) so the whole per-treatment record has one home.
export function treatmentOffsetX(teamId, treatment) {
  return treatmentTuning(teamId, treatment)?.offsetX ?? 0
}

// The vertical counterpart to treatmentOffsetX, same units.
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
// mainTreatmentPinstripe/mainTreatmentPinstripeColor; `pinstripeBg` optionally
// colors the fill under those lines (mainTreatmentPinstripeBg), plain white
// when absent. `bgHex` (Brewers only)
// is a literal fill color that isn't any of the club's three brand
// swatches — takes priority over `bg` in mainTreatmentTint. A team with no
// entry here gets no tint, same as a missing Alternate/City Connect logo.
// Main's own slice of a team's `main` tuning record. The record also carries
// the fields every other treatment has (offsetX/offsetY/originY/header/note),
// which were never part of MAIN_OVERRIDES and must not leak into it — a team
// whose only Main tuning is a header-color proposal has no Main tile override
// at all, and gets no entry.
const MAIN_OVERRIDE_FIELDS = ['bg', 'bgHex', 'pinstripe', 'pinstripeColor', 'pinstripeBg', 'scale']

function mainOverrideFields(main) {
  if (!main) return null
  const out = {}
  for (const key of MAIN_OVERRIDE_FIELDS) if (main[key] !== undefined) out[key] = main[key]
  return Object.keys(out).length ? out : null
}

export const MAIN_OVERRIDES = liveStore(MLB_TUNING_STORE, (store) =>
  Object.fromEntries(
    Object.entries(store)
      .map(([teamId, entry]) => [teamId, mainOverrideFields(entry.treatments?.main)])
      .filter(([, fields]) => fields),
  ),
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
  // The runtime override first — answering it from HERE is what routes Main's
  // tile to it: mainTreatmentRecolor turns true, treatmentTile picks
  // 'main-recolor', and that variant resolves right back through this function.
  const runtime = logoUrlOverride(teamId, 'main')
  if (runtime) return runtime
  // Same override as localLogoUrl's, for the one treatment that doesn't go
  // through it — a Main assignment beats even the MAIN_USES_BASE_LOGO
  // exceptions, since assigning one is an explicit act about this club.
  const assigned = customMarkFor(teamId, 'main')
  if (assigned) return resolveAssignedMark(teamId, assigned)
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

// The colored fill under a pinstriped Main tile's lines, or null for the
// plain-white default — same optional per-team curation as
// mainTreatmentPinstripeColor, just for the fill instead of the line
// (treatmentPinstripeBg's own counterpart for every other treatment).
export function mainTreatmentPinstripeBg(teamId) {
  return MAIN_OVERRIDES[teamId]?.pinstripeBg ?? null
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
      offsetX: treatmentOffsetX(teamId, 'main'),
      offsetY: treatmentOffsetY(teamId, 'main'),
    }
  }
  const pinstripeColor = treatmentPinstripeColor(teamId, treatment)
  return {
    logoVariant: treatment,
    tint: pinstripeColor ? null : treatmentBgColor(teamId, treatment),
    pinstripeColor,
    pinstripeBg: pinstripeColor ? treatmentPinstripeBg(teamId, treatment) : null,
    scale: treatmentScale(teamId, treatment),
    offsetX: treatmentOffsetX(teamId, treatment),
    offsetY: treatmentOffsetY(teamId, treatment),
  }
}

