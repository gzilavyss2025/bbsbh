import { WPA_LOGO_DEFAULTS } from './wpaLogo.js'
import { DEFAULT_PINSTRIPE_COLOR } from './wpaBandColors.js'
import { byTreatment } from './tuningStore.js'
import { teamLogoUrl } from './teams.js'
import { customMarkFor } from './customMarks.js'
import {
  MILB_COLORS,
  MILB_RESEARCHED_PAIRS,
  milbColorPair,
  milbHasResearchedColor,
} from './brandColors.js'
import MILB_TREATMENT_TUNING from './data/milb-treatment-tuning.json' with { type: 'json' }
import LOGO_ART from './data/logo-art.json' with { type: 'json' }

// Per-affiliate MiLB brand colors + the Home/Away tuning tables behind the
// Team Identity Lab's MiLB dimensions (screens/identity-lab/profiles/milb.jsx,
// one profile per level). Deliberately separate from teams.js's MLB
// color system: MLB gets a Main/Alternate/City-Connect/… treatment catalog
// because real per-jersey art and colors exist and are worth curating one by
// one. MiLB doesn't — too many one-off jerseys, reported inconsistently
// across statsapi, for too little payoff — so every MiLB affiliate gets
// exactly two variations, Home and Away, no exceptions, built from ONE
// researched primary/secondary pair per team.
//
// Those pairs are WEB RESEARCH, not an official source (statsapi carries no
// color field for any team, MLB or MiLB, and neither MLB nor MiLB publish
// one). Each entry carries its own `confidence`, `source`, and `note` so the
// caveat travels with the value instead of living in a separate README —
// re-verify before leaning on any single one for something more permanent
// than a QA lab. Three affiliates (482 Corpus Christi, 553 Knoxville, 1956
// Somerset) are marked `"found": false` with no pair at all: research turned
// up color NAMES only, and an invented hex is worse than the fallback.
//
// Both tables live on disk as src/lib/data/milb-colors.json (the researched
// pair per affiliate) and src/lib/data/milb-treatment-tuning.json (the
// Home/Away hand-tuning that used to sit here as four literals), so the Team
// Identity Lab can write an edit straight back rather than handing over a
// snippet to paste (ADR-0029). They're re-exported raw for that lab; every
// resolver in this file reads the derived tables. See src/lib/CLAUDE.md for
// the schema.
export { MILB_COLORS, MILB_TREATMENT_TUNING }

// The affiliate -> color-pair chain itself lives in brandColors.js, one layer
// down, because teams.js's headshot tint reads the exact same chain and this
// module can't be imported from there without closing a cycle (see that file's
// header). Re-exported here so every existing MiLB caller — the lab, the
// tile resolvers below — still has one import for "MiLB colors".
export { MILB_RESEARCHED_PAIRS, milbColorPair, milbHasResearchedColor }

// The two variations, no exceptions: Home wears the primary as its main
// color with the secondary as accent; Away swaps the pair — same two hexes,
// opposite roles. No separate "road grey" research was done (out of scope —
// see the module doc comment), so Away leans on the team's own secondary
// rather than a generic grey.
export function milbVariantColors(teamId, variant) {
  const [primary, secondary] = milbColorPair(teamId)
  return variant === 'away' ? { bg: secondary, accent: primary } : { bg: primary, accent: secondary }
}

// The four full-season MiLB levels this lab covers — same sportId set (and
// exclusion of complex/rookie leagues, which have no stable per-club identity)
// as the lab's WPA-pattern dimension uses for its own league filter. One
// descriptor per level becomes one profile in the Team Identity Lab
// (screens/identity-lab/profiles/milb.jsx), so the four can't drift apart.
// They were four separate routes until that consolidation; the `routeName` each
// carried went with them.
export const MILB_COLOR_LAB_LEVELS = [
  { key: 'aaa', sportId: 11, label: 'Triple-A' },
  { key: 'aa', sportId: 12, label: 'Double-A' },
  { key: 'higha', sportId: 13, label: 'High-A' },
  { key: 'a', sportId: 14, label: 'Single-A' },
]

// ---------------------------------------------------------------------------
// Hand-tuning tables (Phase 2) — same shape/naming convention as teams.js's
// MLB tables (TREATMENT_SCALE/TREATMENT_OFFSET_X/Y, MAIN_OVERRIDES) and
// lib/wpaLogo.js / lib/wpaBandColors.js's WPA_LOGO_LAYOUT_OVERRIDES /
// WPA_TREATMENT_BAND_COLOR_OVERRIDES / TREATMENT_HEADER_COLOR_OVERRIDES —
// just keyed by `'home'`/`'away'` instead of an MLB treatment key, and kept
// in this MiLB-only file so nothing here can collide with or drift against
// the MLB tables. Filled in from the lab itself — its Save writes the store
// these are derived from (ADR-0029), so a tuning session lands as a real diff
// rather than a snippet to paste by hand.

// `{ [teamId]: { [variant]: { scale, offsetX, offsetY, bg, pinstripe } } }`
export const MILB_LOGO_POS_OVERRIDES = byTreatment(MILB_TREATMENT_TUNING, (f) => f.position)

// `{ [teamId]: { [variant]: { size, rotate, offsetX, offsetY, paddingX, paddingY, rowShift } } }`
export const MILB_WPA_LOGO_LAYOUT_OVERRIDES = byTreatment(
  MILB_TREATMENT_TUNING,
  (f) => f.wpaLayout,
)

// `{ [teamId]: { [variant]: string | { pinstripe: true, color } } }`
export const MILB_WPA_BAND_COLOR_OVERRIDES = byTreatment(MILB_TREATMENT_TUNING, (f) => f.band)

// `{ [teamId]: { [variant]: boolean } }` — whether the WPA band tiles the
// club's wordmark instead of its usual mark (milbWpaMarkUrl below).
export const MILB_WPA_WORDMARK_OVERRIDES = byTreatment(MILB_TREATMENT_TUNING, (f) => f.wpaWordmark)

// `{ [teamId]: { [variant]: { bar, accent, onBar } } }` — the MiLB half of the
// header chrome a themed lineup page wears (ADR-0030), same shape and same
// role as teams.js's TREATMENT_HEADER_COLOR_OVERRIDES. `lib/headerTheme.js` is
// what both of them resolve through; nothing else should read either table
// directly except the lab that authors them.
export const MILB_HEADER_COLOR_OVERRIDES = byTreatment(MILB_TREATMENT_TUNING, (f) => f.header)

// The resolved Scale/X/Y/Background/Pinstripe for a (team, variant)'s main
// logo-box tile — a draft (the lab's own unsaved edit) wins outright over a
// landed MILB_LOGO_POS_OVERRIDES entry, which wins outright over the plain
// researched variant color with no position tweak. Same "draft beats curated
// beats default" chain as the MLB dimension's own position math.
export function milbLogoPosition(teamId, variant, draft) {
  const o = MILB_LOGO_POS_OVERRIDES[teamId]?.[variant]
  const { bg } = milbVariantColors(teamId, variant)
  return {
    scale: draft?.scale ?? o?.scale ?? 1,
    offsetX: draft?.offsetX ?? o?.offsetX ?? 0,
    offsetY: draft?.offsetY ?? o?.offsetY ?? 0,
    bg: draft?.bg ?? o?.bg ?? bg,
    pinstripe: draft?.pinstripe ?? o?.pinstripe ?? false,
  }
}

// Same merge chain, for the WPA band's logo tile layout — mirrors
// lib/wpaLogo.js's wpaLogoLayout, against MILB_WPA_LOGO_LAYOUT_OVERRIDES
// instead of that file's MLB-keyed table. `WPA_LOGO_DEFAULTS` (imported) is
// the one piece of shared ground truth with the real chart, so a MiLB tile
// with no override at all still renders at the exact same tile geometry a
// real WinProbChart band uses.
export function milbWpaLogoLayout(teamId, variant, draft) {
  const o = MILB_WPA_LOGO_LAYOUT_OVERRIDES[teamId]?.[variant]
  return {
    size: draft?.size ?? o?.size ?? WPA_LOGO_DEFAULTS.size,
    rotate: draft?.rotate ?? o?.rotate ?? WPA_LOGO_DEFAULTS.rotate,
    offsetX: draft?.offsetX ?? o?.offsetX ?? WPA_LOGO_DEFAULTS.offsetX,
    offsetY: draft?.offsetY ?? o?.offsetY ?? WPA_LOGO_DEFAULTS.offsetY,
    paddingX: draft?.paddingX ?? o?.paddingX ?? WPA_LOGO_DEFAULTS.paddingX,
    paddingY: draft?.paddingY ?? o?.paddingY ?? WPA_LOGO_DEFAULTS.paddingY,
    rowShift: draft?.rowShift ?? o?.rowShift ?? WPA_LOGO_DEFAULTS.rowShift,
  }
}

// The WPA band's effective pinstripe state for a (team, variant) — a draft
// toggle wins, else a landed MILB_WPA_BAND_COLOR_OVERRIDES entry, else no
// pinstripe (unlike MLB, no MiLB variant defaults to pinstriped). Returns the
// line color, or null for "render as a flat fill" (see milbWpaBandColor).
export function milbWpaBandPinstripeColor(teamId, variant, draft) {
  if (draft?.pinstripe != null) return draft.pinstripe ? (draft.bandColor ?? DEFAULT_PINSTRIPE_COLOR) : null
  const override = MILB_WPA_BAND_COLOR_OVERRIDES[teamId]?.[variant]
  if (override && typeof override === 'object') {
    return override.pinstripe ? (override.color ?? DEFAULT_PINSTRIPE_COLOR) : null
  }
  return null
}

// The WPA band's flat fill color for a (team, variant), ignored when
// milbWpaBandPinstripeColor above says this band should render pinstriped
// instead. Same draft-beats-curated-beats-computed chain as the position/
// layout resolvers.
export function milbWpaBandColor(teamId, variant, draft) {
  if (draft?.bandColor) return draft.bandColor
  const override = MILB_WPA_BAND_COLOR_OVERRIDES[teamId]?.[variant]
  const overrideColor = override && typeof override === 'object' ? override.color : override
  if (overrideColor) return overrideColor
  return milbVariantColors(teamId, variant).bg
}

// Whether (teamId, variant)'s WPA band should tile the club's wordmark
// instead of its normal mark — a draft toggle wins outright over a landed
// override, absent means false (tile the normal mark, same as always). The
// minimal MiLB counterpart to MLB's WPA_OWN_ART/WpaArtPicker: one on/off
// switch rather than a whole second art-source library, since a wordmark is
// the one alternate mark nearly every affiliate already has on the CDN.
export function milbWpaWordmark(teamId, variant, draft) {
  return draft?.wpaWordmark ?? Boolean(MILB_WPA_WORDMARK_OVERRIDES[teamId]?.[variant])
}

// The mark URL a (team, variant)'s WPA band actually tiles: the wordmark when
// toggled on, else whatever the tile itself wears — the curated milb-home/away
// art if procured, else the plain CDN base mark (same chain milbTreatmentTile
// resolves for the real, non-WPA tile), so the band and the tile agree unless
// wordmark is explicitly turned on.
export function milbWpaMarkUrl(teamId, variant, draft) {
  const side = variant === 'home' ? 'home' : 'away'
  if (milbWpaWordmark(teamId, side, draft)) return teamLogoUrl(teamId, 'wordmark')
  return milbHasLogoArt(teamId, side) ? teamLogoUrl(teamId, `milb-${side}`) : teamLogoUrl(teamId, 'base')
}

// Every affiliate's Home and Away jerseys share ONE header bar rather than
// each owning its own — same idea as teams.js's treatmentHeaderColorOverride
// collapsing MLB's five jerseys down to two (PR #453), except MiLB never had
// a Main/City-Connect-style asymmetry to justify keeping two in the first
// place. Always resolves off the 'home' slot regardless of which side is
// asked, falling back to 'away' for any club whose header landed before this
// collapse and still only lives there.
export function milbHeaderColorOverride(teamId, side) {
  if (side !== 'home' && side !== 'away') return null
  const overrides = MILB_HEADER_COLOR_OVERRIDES[teamId]
  return overrides?.home ?? overrides?.away ?? null
}

// Seeds for the lab's header editor when neither a draft nor a landed
// override supplies one — this variant's own resolved bg/accent, so the
// mockup starts from a real color instead of the app's generic navy/gold pair
// (unlike TreatmentHeaderPreview's MLB equivalent, which falls back to the
// app's brand pair only when a team has no swatches of its own at all — every
// MiLB team always has at least the neutral fallback pair, so that
// last-resort branch never applies here).
const DEFAULT_HEADER_ON_BAR = '#FBF6E9' // --paper-2, same literal teams.js's MLB mockup uses
export function milbHeaderColorsFor(teamId, variant, draft) {
  const override = milbHeaderColorOverride(teamId, variant)
  const { bg, accent } = milbVariantColors(teamId, variant)
  return {
    bar: draft?.bar ?? override?.bar ?? bg,
    accent: draft?.accent ?? override?.accent ?? accent,
    onBar: draft?.onBar ?? override?.onBar ?? DEFAULT_HEADER_ON_BAR,
  }
}

// Coverage for the curated Home/Away marks (PRD 4.3), read from the same
// upload-rebuilt manifest logoArt.js's MLB path uses — never from a per-tile
// 404, which with 120 affiliates × 2 sides would fire hundreds of them per
// page (see the /__dev/team-logo upload's manifest note, src/lib/CLAUDE.md).
// A team/side with no entry here just keeps wearing today's tinted CDN base
// mark — the design that lets this ship with zero art procured yet.
const MILB_ART_COVERAGE = {
  home: new Set(Object.values(LOGO_ART['milb-home'] ?? {}).map((e) => e.teamId)),
  away: new Set(Object.values(LOGO_ART['milb-away'] ?? {}).map((e) => e.teamId)),
}

// Whether `teamId` has a curated mark for `variant` ('home'/'away') — surfaced
// in the lab so an affiliate still missing art is visibly flagged (PRD 4.3's
// "make coverage scannable"), and read by milbTreatmentTile below to decide
// which mark a real tile wears.
export function milbHasLogoArt(teamId, variant) {
  const side = variant === 'home' ? 'home' : 'away'
  return MILB_ART_COVERAGE[side].has(teamId)
}

// Whether `teamId`'s `variant` side has ANY real art to show, rather than the
// plain tinted CDN base mark — either the curated procured file above, or a
// mark recolored in the Logo art editor and ASSIGNED to this side
// (LogoDropZone's assign select, customMarks.js). An affiliate with no
// procured art at all still gets a real tile the moment one of its saved
// marks is assigned — recoloring the CDN mark is often the only way a thin-
// coverage MiLB club gets a second look, so a bare assignment can't be
// invisible to the one check that decides whether to bother trying
// teamLogoUrl's `milb-home`/`milb-away` variant (which itself resolves the
// assigned mark, teams.js) instead of falling back to `base`.
export function milbHasArt(teamId, variant) {
  const side = variant === 'home' ? 'home' : 'away'
  return milbHasLogoArt(teamId, side) || Boolean(customMarkFor(teamId, `milb-${side}`))
}

// The real game-card/masthead tile's shape (see teams.js's treatmentTile,
// which TeamTreatmentMark reads for every MLB club) computed from this
// module's Home/Away tables instead — the live wiring this lab was staged
// for. `variant` is the game side ('home'/'away'); anything else falls back
// to 'away' so a caller that hasn't resolved a side yet still gets a real
// tile rather than a crash. No `draft` param — unlike the lab's own preview
// path, the shipped app only ever reads the landed MILB_LOGO_POS_OVERRIDES
// table.
export function milbTreatmentTile(teamId, variant) {
  const side = variant === 'home' ? 'home' : 'away'
  const pos = milbLogoPosition(teamId, side)
  return {
    logoVariant: milbHasArt(teamId, side) ? `milb-${side}` : 'base',
    tint: pos.pinstripe ? null : pos.bg,
    offsetX: pos.offsetX,
    offsetY: pos.offsetY,
    pinstripeColor: pos.pinstripe ? pos.bg : null,
    pinstripeBg: null,
    scale: pos.scale,
  }
}
