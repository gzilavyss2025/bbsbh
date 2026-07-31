import { treatmentHeaderColorOverride, isMlbTeamId } from './teams.js'
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
// re-inked dark (see .metricbar--themed-dark). Split at the midpoint of the
// WCAG range against white: an `onBar` that reads as ink rather than paper.
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
// unthemed one — so a caller spreads one value onto `style` instead of building
// the same three-property object at each call site. The fallbacks live in the
// CSS (`var(--bar-fill, var(--navy))`), which is what keeps an unthemed page
// byte-identical to how it rendered before this feature existed.
export function headerThemeStyle(theme) {
  if (!theme) return undefined
  return {
    '--bar-fill': theme.bar,
    '--bar-accent': theme.accent,
    '--bar-text': theme.onBar,
  }
}

// The class a themed surface adds. The `--dark` variant is what re-inks the
// mono club mark on a light bar; a caller with no theme adds nothing at all.
export function headerThemeClass(theme) {
  if (!theme) return ''
  return theme.onBarTone === 'dark' ? 'is-themed is-themed--dark' : 'is-themed'
}
