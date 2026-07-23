// Which mark tiles a WPA band, and whether it may be recolored — the single
// resolver every WPA step-and-repeat surface shares (the real chart,
// components/WinProbChart.jsx, plus the two dev labs that preview it,
// screens/TeamColorLab.jsx and screens/TeamPatternLab.jsx). Pure string
// resolution over teams.js's URL builders, deliberately kept out of the
// chart's .jsx so it's unit-testable (test/wpa-logo.test.js).
import { teamLogoUrl } from './teams.js'

// A handful of clubs' base logo mark is itself (near-)solid in the same hex
// as their own primary brand color — verified against the actual CDN SVGs,
// not a guess — so tiled over a same-colored band, the mark all but vanishes
// into its own background. Each entry is a hand-picked fix for one club, in
// one of three modes:
//   - 'flood': recolor the WHOLE rendered silhouette (its alpha channel) to
//     `color` via an SVG filter (feFlood + feComposite) — for a mark that's
//     genuinely (or close enough to) one flat color throughout, so there's
//     nothing worth preserving from its original fills.
//   - 'outline': keep the mark's own original colors, but add (or, per
//     Phillies, thicken an EXISTING) `color` halo just outside its
//     silhouette via feMorphology (dilate) + feFlood + feComposite +
//     feMerge — for a mark that's otherwise fine, just needs a touch more
//     separation from its own band.
//   - 'swap': the mark has MULTIPLE distinct original colors and only ONE
//     of them collides with the band — recoloring the whole silhouette
//     (flood) would wrongly flatten the colors that were already fine, and
//     an SVG filter can't reliably isolate one specific original hex from
//     another at this render size (anti-aliased edges between the two
//     regions blend into a smear). So `src` points at a small precomputed
//     variant of the CDN's own SVG (public/team-logo-overrides/), a
//     byte-for-byte copy with ONLY the colliding fill's hex swapped —
//     verified against the live CDN source, not reconstructed from memory.
// A team with no entry here keeps its logo's own natural colors.
//
// EVERY entry is scoped to the CDN BASE MARK it was verified against — see
// wpaLogoFor below. It is NOT a blanket per-club rule, because most
// treatments don't wear the base mark at all.
export const LOGO_COLOR_OVERRIDES = {
  113: { mode: 'flood', color: '#FFFFFF' }, // Reds — base mark is solid red, no black in it to preserve
  118: { mode: 'flood', color: '#FFFFFF' }, // Royals
  119: { mode: 'flood', color: '#FFFFFF' }, // Dodgers
  120: { mode: 'flood', color: '#FFFFFF' }, // Nationals
  133: { mode: 'flood', color: '#FFFFFF' }, // Athletics
  135: { mode: 'flood', color: '#FFC425' }, // Padres — their own secondary yellow
  137: { mode: 'flood', color: '#27251F' }, // Giants — their own secondary near-black
  138: { mode: 'flood', color: '#FFFFFF' }, // Cardinals
  147: { mode: 'flood', color: '#FFFFFF' }, // Yankees
  116: { mode: 'flood', color: '#FFFFFF' }, // Tigers — the "D"
  142: { mode: 'swap', src: '/team-logo-overrides/142.svg' }, // Twins — navy "T" to white, red kept
  114: { mode: 'swap', src: '/team-logo-overrides/114.svg' }, // Guardians — navy outer border to white, red kept
  143: { mode: 'outline', color: '#FFFFFF', radius: 0.6 }, // Phillies — thicken the mark's existing white edge
}

// The mark this (team, treatment) band tiles, plus the LOGO_COLOR_OVERRIDES
// entry — if any — that may recolor it:
//   { src, recolor }   src: url or null (no art on file — the band then reads
//                      as its flat structural color, same as before logo
//                      tiling existed); recolor: an override entry or null,
//                      handed straight to WinProbChart's <RecolorFilter>.
//
// The recolor tables above are curated AGAINST THE CDN BASE MARK — a stock
// mlbstatic SVG whose fills were read off the live source. Every other
// treatment (Alternate, City Connect, Alternate 2/3/4) tiles hand-procured,
// transparent-cropped art checked into public/team-logos/ (teams.js's
// localLogoUrl), art that was cropped and color-picked to read on its own
// curated tile background in the first place. Flooding THAT to one flat hex
// erases the very colors it was procured for — a multicolor roundel comes
// out a solid white blob — and a 'swap' override would point the tile at the
// club's base-mark variant instead of the treatment's own art entirely.
//
// So the gate is the resolved URL, not the treatment name: an override
// applies only when this treatment actually resolves to the base mark it was
// verified against. That covers 'main' plus the handful of treatments teams.js
// deliberately routes back to the stock CDN art (ALT_USES_BASE_LOGO and
// friends), and excludes all procured local art without a second table to
// keep in sync.
export function wpaLogoFor(teamId, treatment = 'main') {
  const src = teamLogoUrl(teamId, treatment === 'main' ? 'base' : treatment)
  const override = LOGO_COLOR_OVERRIDES[teamId]
  if (!override || src !== teamLogoUrl(teamId, 'base')) return { src, recolor: null }
  return { src: override.mode === 'swap' ? override.src : src, recolor: override }
}
