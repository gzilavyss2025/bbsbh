// The club colour readers that are not a tile: the accent, extras, tint, chip
// and favourite-accent colours. Split out of teams.js (#3039); teams.js
// re-exports it. The colour chain itself lives in colors/brandColors.js.

import { readableTextColor } from '../contrast.js'
import { TEAM_COLOR_PAIRS, MLB_TEAM_COLORS, MLB_TEAM_COLORS_STORE, milbBrandPair } from '../colors/brandColors.js'
import { byTeam } from '../tuningStore.js'

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
export const TEAM_COLORS = byTeam(MLB_TEAM_COLORS_STORE, (e) => e.accent)

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
// Decorative and lab-facing only; no scoring surface reads it. Held as
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

// A club's single primary brand color (the first of TEAM_COLOR_PAIRS), for
// contexts that want one team-identity hex rather than a two-tone stripe
// (e.g. a solid hover fill). Returns
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
