import { WPA_LOGO_DEFAULTS } from './wpaLogo.js'
import { DEFAULT_PINSTRIPE_COLOR } from './wpaBandColors.js'
import { byTeam, byTreatment } from './tuningStore.js'
import MILB_COLORS from './data/milb-colors.json' with { type: 'json' }
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
// The pairs below are WEB RESEARCH, not an official source (statsapi carries
// no color field for any team, MLB or MiLB, and neither MLB nor MiLB publish
// one) — see .scratch/milb-team-colors/README.md for the full methodology,
// per-team confidence ratings, and known gaps. Re-verify before leaning on
// any single value here for something more permanent than a QA lab.
//
// Both tables now live on disk as src/lib/data/milb-colors.json (the
// researched pair per affiliate) and src/lib/data/milb-treatment-tuning.json
// (the Home/Away hand-tuning that used to sit here as four literals), so the
// Team Identity Lab can write an edit straight back rather than handing over a
// snippet to paste (ADR-0029). They're re-exported raw for that lab; every
// resolver in this file reads the derived tables below. See src/lib/CLAUDE.md
// for the schema.
export { MILB_COLORS, MILB_TREATMENT_TUNING }

// Five affiliates where research either found no hex at all, or only a
// single low-confidence/likely-stale source with unresolved conflicts
// (Portland Sea Dogs, Knoxville Smokies, Corpus Christi Hooks, Somerset
// Patriots, Columbus Clingstones — see the stash README) are left OUT of
// MILB_RESEARCHED_PAIRS on purpose, so milbColorPair's fallback below
// renders them with an explicit neutral placeholder rather than a
// possibly-wrong invented color.
export const MILB_RESEARCHED_PAIRS = byTeam(MILB_COLORS, (e) => e.pair)

// Same neutral graphite pair wpaBandColors.js's chipColorsFor falls back to
// for an unrecognized team — reused here rather than inventing a second
// "unknown team" color, for the 5 affiliates research couldn't confidently
// resolve (see the doc comment above).
const NEUTRAL_FALLBACK_PAIR = ['#6B6558', '#938C7C']

export function milbColorPair(teamId) {
  return MILB_RESEARCHED_PAIRS[teamId] ?? NEUTRAL_FALLBACK_PAIR
}

// Whether `teamId` has a real researched color (vs. the neutral fallback) —
// surfaced in the lab so an unresolved team is visibly flagged rather than
// looking indistinguishable from a confidently-researched one.
export function milbHasResearchedColor(teamId) {
  return Boolean(MILB_RESEARCHED_PAIRS[teamId])
}

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

// `{ [teamId]: { [variant]: { blue, gold, font } } }` — same "design-lab
// sketch, not wired to any real component" footing as teams.js's
// TREATMENT_HEADER_COLOR_OVERRIDES.
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

// Seeds for the header-colors mockup when neither a draft nor a landed
// MILB_HEADER_COLOR_OVERRIDES entry supplies one — this variant's own
// resolved bg/accent, so the mockup starts from a real color instead of the
// app's generic navy/gold pair (unlike TreatmentHeaderPreview's MLB
// equivalent, which falls back to the app's brand pair only when a team has
// no swatches of its own at all — every MiLB team always has at least the
// neutral fallback pair, so that last-resort branch never applies here).
const DEFAULT_HEADER_FONT = '#FBF6E9' // --paper-2, same literal teams.js's MLB mockup uses
export function milbHeaderColorsFor(teamId, variant, draft) {
  const override = MILB_HEADER_COLOR_OVERRIDES[teamId]?.[variant]
  const { bg, accent } = milbVariantColors(teamId, variant)
  return {
    blue: draft?.blue ?? override?.blue ?? bg,
    gold: draft?.gold ?? override?.gold ?? accent,
    font: draft?.font ?? override?.font ?? DEFAULT_HEADER_FONT,
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
    logoVariant: milbHasLogoArt(teamId, side) ? `milb-${side}` : 'base',
    tint: pos.pinstripe ? null : pos.bg,
    offsetX: pos.offsetX,
    offsetY: pos.offsetY,
    pinstripeColor: pos.pinstripe ? pos.bg : null,
    pinstripeBg: null,
    scale: pos.scale,
  }
}
