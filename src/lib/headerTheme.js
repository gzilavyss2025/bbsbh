import { treatmentHeaderColorOverride, isMlbTeamId, mastheadBarFor, mastheadMarkUrl } from './teams.js'
import { milbHeaderColorOverride } from './milbColors.js'
import { contrastRatio } from './contrast.js'

// Which chrome the lineup page wears for a club — the one resolver between the
// two hand-tuned header tables and the one surface that reads them
// (screens/TeamInfo.jsx). ADR-0030.
//
// ---------------------------------------------------------------------------
// THE INVARIANT — do not violate it, and do not let a "small" exception in.
//
//   Theming's only inputs are (teamId, treatment).
//
// Never a score, an inning, an out, a win probability, or anything else
// derived from game state. Uniform, logo, and colour data is IDENTITY, not
// state: every input here is a static per-club table or public/data/jerseys.json's
// `gamePk:teamId -> treatment NAME`, and a colour cannot encode a result.
// `jerseyTreatmentFor` already renders unsealed on the slate and the in-game
// masthead — knowing a club wore City Connect tells you nothing about how the
// game went.
//
// The tempting future violation is obvious and would be a real spoiler: "tint
// the page by whoever's leading", "warm the bar as the lead grows", "swap the
// accent once it's out of hand". Any of those makes a colour a score channel
// and breaks the app's core invariant (root CLAUDE.md). If a caller ever wants
// to pass a feed, a linescore, or a reveal index into this file, the answer is
// no — take it up in ADR-0030 first.
// ---------------------------------------------------------------------------
//
// Coverage is deliberately PARTIAL. 73 (club, treatment) pairs are tuned out of
// several hundred possible; everything else answers null and the caller keeps
// the app's default navy chrome, which is why this returns null rather than
// synthesising a triad out of a club's brand colours. A synthesised bar would
// be an unreviewed colour pair on a real page, and the WCAG guard
// (scripts/check-contrast.mjs) can only assert pairs that actually exist in a
// store. Curating one club at a time in /identity-lab is the intended path.

// A themed bar carries the section mastheads' club mark, which is the mono
// knockout art — a flat single-ink silhouette, drawn white. On a light bar that
// vanishes, so the tone of `onBar` decides whether the mark stays white or gets
// re-inked dark, via the `--mark-filter` custom property `headerThemeStyle` sets
// below (09-team-info.css's `.metricbar__logo` reads it). A custom property
// rather than the `.is-themed--dark` class the bar/accent/text rules key off:
// those three read `var(--bar-fill)` etc., which the cascade resolves from the
// NEAREST ancestor that set it, so a light-themed section correctly ignores an
// outer dark-themed page (TeamInfo.jsx nests the opposing club's own-themed
// Defense/Starting-pitcher cards inside the page's own themed shell). A class-
// based descendant selector has no such "nearest wins" — `.is-themed--dark
// .metricbar__logo` used to match ANY themed mark anywhere under a dark page,
// which is exactly how a light-themed opponent's knockout mark went black
// while its own onBar-driven text correctly stayed white. Split at the
// midpoint of the WCAG range against white: an `onBar` that reads as ink
// rather than paper.
const LIGHT_ON_BAR_MAX_CONTRAST_VS_WHITE = 2

// 'light' | 'dark' — whether a bar with this ink leaves the white knockout mark
// alone or re-inks it dark. Exported because /identity-lab previews that same
// mark on its bar mocks off DRAFT colors, which never reach `headerThemeFor`
// (nothing is landed yet): a second midpoint over there would let the lab show
// a white mark on a bar the real page draws dark.
export function barMarkTone(onBar) {
  return contrastRatio(onBar, '#FFFFFF') <= LIGHT_ON_BAR_MAX_CONTRAST_VS_WHITE ? 'light' : 'dark'
}

// `{ bar, accent, onBar, onBarTone }` for a club in a given jersey, or null
// when that pair has no curated triad. `treatment` is an MLB treatment key
// ('main' | 'alternate' | 'alternate-2/3/4' | 'city-connect') for one of the 30
// clubs, and a MiLB game SIDE ('home' | 'away') for an affiliate — the same two
// vocabularies the rest of src/lib keeps separate (see src/lib/CLAUDE.md), so
// this reads whichever table the id belongs to rather than merging them. Both
// resolvers collapse several jerseys onto fewer bars (MLB's treatment onto
// Main/City-Connect, MiLB's Home/Away onto one shared bar) — see
// treatmentHeaderColorOverride/milbHeaderColorOverride for the two collapses.
// Which key a club's chrome is filed under. MLB clubs are keyed by treatment
// ('city-connect'); MiLB affiliates have no uniform catalog to name a
// treatment from, so their two-variation table is keyed by game side instead —
// the same split src/lib/CLAUDE.md keeps everywhere else, resolved here rather
// than merged into one fake vocabulary. Every caller of `headerThemeFor` needs
// this same translation (TeamInfo.jsx's club-name bar, BoxScore.jsx's team
// cards), so it lives beside the resolver rather than being copied per caller.
export function themeKeyFor(teamId, side, treatment) {
  return isMlbTeamId(teamId) ? treatment : side
}

export function headerThemeFor(teamId, treatment) {
  if (!teamId || !treatment) return null
  const landed = isMlbTeamId(teamId)
    ? treatmentHeaderColorOverride(teamId, treatment)
    : milbHeaderColorOverride(teamId, treatment)
  if (!landed?.bar || !landed?.onBar) return null
  return {
    bar: landed.bar,
    accent: landed.accent ?? landed.bar,
    onBar: landed.onBar,
    onBarTone: barMarkTone(landed.onBar),
  }
}

// The inline custom properties a themed surface sets, or undefined for an
// unthemed one carrying no mark scale either — so a caller spreads one value
// onto `style` instead of building the same object at each call site. The
// fallbacks live in the CSS (`var(--bar-fill, var(--navy))`), which is what
// keeps an unthemed page byte-identical to how it rendered before this feature
// existed.
//
// `markScale` rides along rather than living in the triad because it applies
// INDEPENDENTLY of one: a club with no curated colours still wears default navy
// chrome, still draws its knockout mark there, and may still need that mark
// sized up. So an unthemed bar with a scale gets a style object carrying only
// the scale, and a themed bar with no scale carries only the three colours.
export function headerThemeStyle(theme, markScale = null) {
  if (!theme && !markScale) return undefined
  return {
    ...(theme && {
      '--bar-fill': theme.bar,
      '--bar-accent': theme.accent,
      '--bar-text': theme.onBar,
      '--mark-filter': theme.onBarTone === 'dark' ? 'brightness(0)' : 'none',
    }),
    ...(markScale && { '--masthead-mark-scale': markScale }),
  }
}

// How far a bar's mark may be sized, and in what steps. A club's knockout art
// is letterboxed into the bar's height, and marks carry wildly different
// amounts of their own internal whitespace — a cap logo drawn tight to its
// viewBox and a roundel with a wide margin are the same file size and read at
// very different weights on the bar. This scales past that margin (the mark's
// wrapper clips, so growing it crops rather than overflowing).
//
// Floored below 1 as well as raised above it: the fix for a mark drawn tight to
// its edges is to pull it IN, and one control that only grows would leave that
// case with no answer.
export const MARK_SCALE_LIMITS = { min: 0.5, max: 2.5, step: 0.05, default: 1 }

// How a mark size LANDS in a tuning store, shared by both profiles so MLB and
// MiLB can't disagree about it: appended to the bar's colour record when it is
// anything other than the default, and dropped entirely when it isn't. An
// identity entry and an absent one render the same, and the shorter store is
// the one that says which bars actually needed a hand — the same rule the stamp
// placement editor keeps for its four fields.
export function withMarkScale(record, markScale) {
  const n = markScaleValue(markScale)
  if (n === null) return record
  return { ...record, markScale: n }
}

// A draft's mark size as it would LAND: a clamped number, or null for "no
// override" — which is what a cleared field, a missing one, and the default all
// mean. Blank has to be spelled out rather than left to `Number`, because
// `Number('')` is 0: finite, not the default, and so silently written as a
// clamped 0.5 by the rule above until this existed.
export function markScaleValue(markScale) {
  if (markScale === '' || markScale == null) return null
  const n = Number(markScale)
  if (!Number.isFinite(n) || n === MARK_SCALE_LIMITS.default) return null
  return clampMarkScale(n)
}

// Whether a header DRAFT, once landed, would equal what is already landed —
// which is the question the lab's auto-clear sweep is really asking, and the one
// a raw field-by-field compare gets wrong here.
//
// The asymmetry is the mark size: the save path DROPS a default or blank one
// rather than writing it, so a draft carrying `markScale: 1` can never equal a
// landed record that (correctly) has no `markScale` at all. Left to the generic
// comparison that read as a change still pending, forever — the bar reported
// itself Themed and landed while its draft refused to clear.
//
// Deliberately compares the LANDED FORM rather than just ignoring the field:
// clearing a club's mark size back to the default IS a pending change when the
// store still holds one, and this keeps saying so.
export function headerDraftMatchesLanded(fields, landed, matchColors) {
  if (!landed) return false
  const { markScale, ...colors } = fields
  if (!matchColors(colors, landed)) return false
  if (!Object.hasOwn(fields, 'markScale')) return true
  return markScaleValue(markScale) === (markScaleValue(landed.markScale) ?? null)
}

// The mark this club's mastheads draw on the bar it wears in this jersey, and
// how big: `{ url, scale }`. `url` is null for a bar nobody has dressed (the
// override is the exception, not the rule) and `scale` is null at the default,
// so an untuned club emits no custom property at all rather than an identity
// one.
//
// Identity-only inputs, the same invariant this whole module keeps: which bar a
// jersey maps to is `mastheadBarFor`, and the scale is read off the same
// per-bar header record the colour triad above comes from.
export function mastheadMarkFor(teamId, treatment) {
  const record = isMlbTeamId(teamId)
    ? treatmentHeaderColorOverride(teamId, treatment)
    : milbHeaderColorOverride(teamId, treatment)
  const scale = Number(record?.markScale)
  return {
    url: mastheadMarkUrl(teamId, mastheadBarFor(teamId, treatment)),
    scale: Number.isFinite(scale) && scale !== MARK_SCALE_LIMITS.default ? clampMarkScale(scale) : null,
  }
}

// Clamped in the resolver as well as in the editor's input, the same
// belt-and-braces the stamp placement fields keep (ADR-0035's amendment): a
// hand-edited store must not be able to fling a mark off its bar.
export function clampMarkScale(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return MARK_SCALE_LIMITS.default
  return Math.min(MARK_SCALE_LIMITS.max, Math.max(MARK_SCALE_LIMITS.min, n))
}

// The class a themed surface adds. The `--dark` variant is what re-inks the
// mono club mark on a light bar; a caller with no theme adds nothing at all.
export function headerThemeClass(theme) {
  if (!theme) return ''
  return theme.onBarTone === 'dark' ? 'is-themed is-themed--dark' : 'is-themed'
}
