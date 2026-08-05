// Which mark tiles a WPA band, how that tile is laid out, and whether the
// mark may be recolored — the geometry + art resolution every WPA
// step-and-repeat surface shares (the real chart, components/WinProbChart.jsx,
// plus the two dev labs that preview it, screens/identity-lab/ and
// screens/identity-lab/profiles/pattern.jsx). Pure string/number math over teams.js's URL
// builders, deliberately kept out of the chart's .jsx so it's unit-testable
// (test/wpa-logo.test.js).
import { teamLogoUrl } from '../teams.js'
import { byTreatment } from '../tuningStore.js'
import { wpaArtUrl } from '../logoArt.js'
import { WPA_LOGO_DEFAULTS } from './wpaDefaults.js'
import WPA_TUNING from '../data/wpa-tuning.json' with { type: 'json' }

// The WPA band's own hand-tuned store (src/lib/data/wpa-tuning.json), shared
// with wpaBandColors.js — one file per dimension, so a club's band color and
// its tile layout are edited side by side in the Team Identity Lab and land in
// one diff. Re-exported raw for that lab; everything here reads the derived
// table below. See src/lib/CLAUDE.md.
export { WPA_TUNING }

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
//   { src, recolor }   src: url or null; recolor: an override entry or null,
//                      handed straight to WinProbChart's <RecolorFilter>.
//
// This resolves a URL, it does NOT promise the file behind it exists —
// procured treatment art is added club by club, so a team wearing an
// Alternate nobody has cropped a mark for yet still resolves to that
// Alternate's path. wpaLogoWithFallback below is what turns that miss into
// the club's base mark; callers wanting the fallback should go through the
// useWpaLogo hook (hooks/useWpaLogo.js) rather than calling this directly.
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
// A handful of (team, treatment) WPA tiles want a DIFFERENT mark than the
// one that treatment normally wears everywhere else on the site — the mark
// itself (teams.js's real per-treatment art) and this tile's own band color
// (WPA_TREATMENT_BAND_COLOR_OVERRIDES) are untouched; only which logo file
// gets tiled changes. Value is the `teamLogoUrl` variant to substitute in —
// always an EXISTING variant a club already wears somewhere. This is
// deliberately a separate, lower-priority mechanism from WPA_OWN_ART/
// `ownArt` below (an uploaded WPA-ONLY file with no other home): the two
// answer different questions — "point at another variant that already
// exists" vs. "tile a file procured for this purpose only" — and merging
// them would mean copying these two clubs' art into a second directory to
// express what the redirect already says.
export const WPA_MARK_SOURCE_OVERRIDES = {
  // Braves Alt 2 Navy (treatment 'main') — the plain "A" cap mark stays the
  // club's Main mark everywhere else (card tile, header, etc.); the WPA band
  // alone swaps in the Atlanta script wordmark, the same art the Road Grey
  // mark (alternate-3) uses, which reads better repeated small than the cap.
  144: { main: 'alternate-3' },
  // Reds Home White (treatment 'main') — the card/header Main tile wears the
  // locally recolored "Reds" script mark (MAIN_OVERRIDES' recolor: true,
  // teams.js's mainOverrideLogoUrl), not the plain CDN wishbone-C; the WPA
  // band was still defaulting to the base mark and needs the same swap to
  // match.
  113: { main: 'main-recolor' },
}

// Which (team, treatment)s have opted OUT of tiling the same mark the
// resolution chain below would otherwise pick, in favor of a separately
// uploaded WPA-only PNG (Team Identity Lab's "Use Logo Art" checkbox,
// WpaPreview.jsx) — `wpa-tuning.json`'s own per-treatment `ownArt` field,
// same store as this file's other per-treatment reads (one dimension, one
// file — see the WPA_TUNING doc above). Absent/false is the default: tile
// whatever wpaLogoFor already resolved before this feature existed.
export const WPA_OWN_ART = byTreatment(WPA_TUNING, (f) => f.ownArt)

// Which (team, treatment)s tile the club's wordmark instead of their usual
// mark — the MLB counterpart to MiLB's MILB_WPA_WORDMARK_OVERRIDES
// (lib/milbColors.js). Absent/false is the default, same convention as
// WPA_OWN_ART above; every club's CDN wordmark already resolves via
// teamLogoUrl(teamId, 'wordmark') (teams.js's LOGO_VARIANTS), so this needs
// no separate art-procurement step the way ownArt does.
export const WPA_WORDMARK_OVERRIDES = byTreatment(WPA_TUNING, (f) => f.wpaWordmark)

export function wpaWordmarkOn(teamId, treatment) {
  return Boolean(WPA_WORDMARK_OVERRIDES[teamId]?.[treatment])
}

// The shared body of wpaLogoFor/wpaLogoWithFallback below. `allowOwnArt` is
// false only on the fallback's OWN retry after a miss — if it stayed true, a
// club whose uploaded WPA art 404s would "fall back" to re-resolving the
// exact same missing URL and loop, the precise silent-blank-band failure this
// whole chain exists to prevent (see wpaLogoWithFallback's doc below).
function resolveMark(teamId, treatment, allowOwnArt) {
  // Checked first, same top priority MiLB's own milbWpaMarkUrl gives its
  // wordmark toggle — it says "tile THIS mark, full stop", ahead of even
  // ownArt's uploaded WPA-only file. Gated on `allowOwnArt` (not a retry) for
  // the same reason ownArt is below: a missing wordmark on 'main' itself
  // would otherwise re-resolve to that same missing URL on the fallback's
  // retry and loop, the exact silent-blank-band failure this chain exists to
  // prevent.
  if (allowOwnArt && wpaWordmarkOn(teamId, treatment)) return { src: teamLogoUrl(teamId, 'wordmark'), recolor: null }
  if (allowOwnArt && WPA_OWN_ART[teamId]?.[treatment]) {
    const src = wpaArtUrl(teamId, treatment)
    // Uploaded WPA art is procured art with its own colors, same footing as
    // every other curated treatment PNG (Alternate, City Connect, …) — never
    // gated through LOGO_COLOR_OVERRIDES, which is scoped to the stock CDN
    // base mark specifically (see that table's own doc comment above).
    if (src) return { src, recolor: null }
  }
  const markVariant = WPA_MARK_SOURCE_OVERRIDES[teamId]?.[treatment] ?? (treatment === 'main' ? 'base' : treatment)
  const src = teamLogoUrl(teamId, markVariant)
  const override = LOGO_COLOR_OVERRIDES[teamId]
  if (!override || src !== teamLogoUrl(teamId, 'base')) return { src, recolor: null }
  return { src: override.mode === 'swap' ? override.src : src, recolor: override }
}

export function wpaLogoFor(teamId, treatment = 'main') {
  return resolveMark(teamId, treatment, true)
}

// Same, but for a caller that has since learned this treatment's art isn't
// actually there (`artMissing` — a 404, or no URL to try in the first place).
// Falls all the way back to the club's Main mark, which is the stock CDN
// logo and therefore always exists — and, being the base mark again, gets its
// LOGO_COLOR_OVERRIDES recolor back too, exactly as if the club were wearing
// its Main uniform. The retry bypasses `ownArt` (`allowOwnArt: false`) even
// when the miss WAS the uploaded WPA-only file 404ing on `main` itself —
// otherwise this would re-resolve to that same missing URL and the band
// would still paint nothing.
//
// This matters because an SVG <image> inside a <pattern> has no error
// handling of its own: a 404'd href paints NOTHING and the band renders as a
// bare color with no marks on it at all, silently. The slate card's own logo
// has always dropped back to base on a miss (components/TeamLogo.jsx); this
// is the band doing the same thing. Only the MARK falls back — the band keeps
// the treatment's own curated color, since that's a separate table that
// doesn't depend on art being on file.
export function wpaLogoWithFallback(teamId, treatment, artMissing) {
  return resolveMark(teamId, artMissing ? 'main' : treatment, !artMissing)
}

// ---------------------------------------------------------------------------
// Tile geometry
//
// Each tile is one copy of the club's mark, inset by a margin so neighboring
// tiles don't touch — compact and tightly packed rather than sparse.
// `rotate` + `offsetX`/`offsetY` (applied by the caller as the pattern's
// patternTransform) tilt and shift the whole grid off-axis, so the wallpaper
// reads as something the eye stumbles into mid-pattern rather than a grid
// anchored at the plot's top-left corner.
const LOGO_SIZE = WPA_LOGO_DEFAULTS.size
const LOGO_ROTATE = WPA_LOGO_DEFAULTS.rotate
const LOGO_OFFSET_X = WPA_LOGO_DEFAULTS.offsetX
const LOGO_OFFSET_Y = WPA_LOGO_DEFAULTS.offsetY
// The tile's margins — the gap between one logo and the next tile's logo
// directly beside (paddingX) or above/below (paddingY) it, in the pattern's
// own coordinate system, pre-rotation. The two are independent, so a tile can
// go tall-and-loose or wide-and-tight without the other axis following.
// Negative shrinks the tile smaller than the logo itself, so adjacent tiles'
// marks overlap on purpose — a deliberate choice for a club whose mark wants
// to run tighter than its own footprint.
const LOGO_PADDING_X = WPA_LOGO_DEFAULTS.paddingX
const LOGO_PADDING_Y = WPA_LOGO_DEFAULTS.paddingY
// How far each row is shifted sideways from the one above it, as a percent of
// the tile's own width. 50 staggers alternating rows like brickwork; 0 (the
// default — every club, every treatment) leaves a plain grid, whose columns
// the pattern's own off-axis rotation already breaks up. Tunable per (team,
// treatment) via WPA_LOGO_LAYOUT_OVERRIDES.rowShift, previewed as Team Color
// Lab's "Shift %" field.
const LOGO_ROW_SHIFT = WPA_LOGO_DEFAULTS.rowShift

// Re-exported so this stays the module you import WPA layout defaults from —
// the values themselves live in the dependency-free lib/wpa/wpaDefaults.js leaf, so
// that a caller who wants ONLY these numbers (lib/milbColors.js, which is on the
// eager first-paint path) doesn't drag this module and data/wpa-tuning.json into
// the entry chunk with them. Read wpaDefaults.js before moving them back.
export { WPA_LOGO_DEFAULTS }

// Layout/color FINE-TUNING for a specific (team, treatment) pairing — e.g. a
// wide City Connect wordmark needing more tile room than the standard crest.
// Nested `{ [teamId]: { [treatment]: {...} } }`, same treatment-key vocabulary
// as Team Identity Lab's tiles and api/uniforms.js's JERSEY_TREATMENT_OVERRIDES,
// so a value copied from Team Identity Lab's per-treatment WPA preview pastes
// straight in. NOTE: a per-team rotate/offset override breaks the away/home
// tile grid's shared alignment across the plot seam for THAT team's band
// only — an accepted tradeoff, not a bug.
export const WPA_LOGO_LAYOUT_OVERRIDES = byTreatment(WPA_TUNING, (f) => f.layout)

export function wpaLogoLayout(teamId, treatment) {
  const o = WPA_LOGO_LAYOUT_OVERRIDES[teamId]?.[treatment]
  return {
    size: o?.size ?? LOGO_SIZE,
    rotate: o?.rotate ?? LOGO_ROTATE,
    offsetX: o?.offsetX ?? LOGO_OFFSET_X,
    offsetY: o?.offsetY ?? LOGO_OFFSET_Y,
    paddingX: o?.paddingX ?? LOGO_PADDING_X,
    paddingY: o?.paddingY ?? LOGO_PADDING_Y,
    rowShift: o?.rowShift ?? LOGO_ROW_SHIFT,
  }
}

// A layout turned into the concrete numbers an SVG <pattern> needs:
//   { tileW, tileH, images: [{ x, y }, …] }
// `tileW`/`tileH` are the pattern's own width/height and `images` the logo
// placements inside it, all in pattern-local (pre-rotation) coordinates.
//
// With no row shift — the default everywhere — that's the simple case: one
// logo, one row, tile height is one row's height. When a (team, treatment)
// does opt into a shift, it can't be expressed by moving that single logo
// (every row would shift by the same amount and the grid would just lean), so
// the tile grows to TWO rows tall and carries two placements: the second
// inset sideways by `shift`. Repeating that 2-row tile is what staggers every
// OTHER row, i.e. brickwork.
//
// The shifted row runs off the tile's right edge by design; the caller's
// pattern sets `overflow: visible`, so the neighboring tile to the left
// paints the wrapped remainder into the gap and the rows stay unbroken. (That
// same overflow is what lets a negative padding overlap adjacent tiles' marks
// at all, so this rides on a property the pattern already depends on rather
// than adding a third clipped copy per tile.)
export function wpaTilePlacements(layout) {
  const { size, paddingX, paddingY, rowShift } = { ...WPA_LOGO_DEFAULTS, ...layout }
  // Clamped like rowH below: a pattern whose width or height hits ≤ 0 is
  // silently not rendered at all, so a padding more negative than the mark
  // is tall/wide (typeable in Team Identity Lab's H-Pad/V-Pad fields) must
  // degrade to maximum overlap, not a blank band.
  const tileW = Math.max(1, size + paddingX)
  const rowH = Math.max(1, size + paddingY)
  const insetX = paddingX / 2
  const insetY = paddingY / 2
  // A shift of a whole tile width (or none at all) lands every row back in
  // the same columns — same picture as no shift, at half the draw cost.
  const shift = (tileW * (rowShift % 100)) / 100
  if (!shift) return { tileW, tileH: rowH, images: [{ x: insetX, y: insetY }] }
  return {
    tileW,
    tileH: rowH * 2,
    images: [
      { x: insetX, y: insetY },
      { x: insetX + shift, y: insetY + rowH },
    ],
  }
}
