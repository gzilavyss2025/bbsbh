// Unit coverage for the WPA band's logo resolver (lib/wpaLogo.js) — which
// mark tiles a (team, treatment) band, and whether a LOGO_COLOR_OVERRIDES
// entry is allowed to recolor it.
//
// Why the guard exists: the recolor table is keyed by teamId alone, and was
// curated against each club's stock CDN base mark. When the chart learned to
// tile that GAME's real uniform treatment, every non-Main band started
// inheriting its club's base-mark override too — so the Nationals' hand-
// procured Alternate/Alternate 3 roundel PNGs got feFlood'd to solid white
// blobs in Team Color Lab's WPA preview and in the real chart. These pin the
// rule that an override only reaches the art it was verified against.
import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LOGO_COLOR_OVERRIDES,
  WPA_LOGO_DEFAULTS,
  wpaLogoFor,
  wpaLogoLayout,
  wpaLogoWithFallback,
  wpaTilePlacements,
} from '../src/lib/wpaLogo.js'
import { teamLogoUrl } from '../src/lib/teams.js'

// Nationals (120) — a 'flood' club with procured PNGs for three treatments.
const NATIONALS = 120

test('main tiles the CDN base mark and keeps its recolor override', () => {
  const { src, recolor } = wpaLogoFor(NATIONALS, 'main')
  assert.equal(src, teamLogoUrl(NATIONALS, 'base'))
  assert.deepEqual(recolor, LOGO_COLOR_OVERRIDES[NATIONALS])
})

test('a procured treatment PNG renders as-is, never flooded to a flat color', () => {
  for (const treatment of ['alternate', 'alternate-2', 'alternate-3', 'city-connect']) {
    const { src, recolor } = wpaLogoFor(NATIONALS, treatment)
    assert.equal(src, `/team-logos/${treatment}/WSH.png`, `${treatment} tiles its own procured art`)
    assert.equal(recolor, null, `${treatment} art keeps its own colors`)
  }
})

test("a 'swap' override never redirects a treatment away from its own art", () => {
  // Twins (142) — swap mode, pointing at a precomputed base-mark variant.
  const swapped = LOGO_COLOR_OVERRIDES[142]
  assert.equal(swapped.mode, 'swap')
  assert.equal(wpaLogoFor(142, 'main').src, swapped.src)

  const alt = wpaLogoFor(142, 'alternate')
  assert.equal(alt.src, '/team-logos/alternate/MIN.png')
  assert.equal(alt.recolor, null)
})

test('a treatment routed back to the stock CDN mark keeps its override', () => {
  // Royals (118) — ALT2_USES_BASE_LOGO sends Alternate 2 to the plain CDN
  // mark, the exact art the flood was verified against, so it still applies.
  const { src, recolor } = wpaLogoFor(118, 'alternate-2')
  assert.equal(src, teamLogoUrl(118, 'base'))
  assert.deepEqual(recolor, LOGO_COLOR_OVERRIDES[118])
})

test('a club with no override is untouched in every treatment', () => {
  // Brewers (158) — no LOGO_COLOR_OVERRIDES entry.
  assert.equal(wpaLogoFor(158, 'main').recolor, null)
  assert.equal(wpaLogoFor(158, 'main').src, teamLogoUrl(158, 'base'))
  assert.equal(wpaLogoFor(158, 'city-connect').src, '/team-logos/city-connect/MIL.png')
})

test('defaults to main, and degrades to no tile for an unknown club', () => {
  assert.deepEqual(wpaLogoFor(NATIONALS), wpaLogoFor(NATIONALS, 'main'))
  assert.equal(wpaLogoFor(null, 'main').src, null)
  // An unmapped MiLB id has no abbreviation, so there's no procured file to
  // point at — the band just renders its flat color, no broken <image>.
  assert.equal(wpaLogoFor(999999, 'alternate').src, null)
})

// --- missing art -----------------------------------------------------------
//
// An SVG <image> in a <pattern> can't report its own 404 — it silently paints
// nothing, so a club wearing an Alternate nobody has cropped art for yet got
// a bare colored band with no marks on it at all. These pin the drop back to
// the club's Main mark (which is the stock CDN logo, so it always exists).

test('a treatment with no art on file falls back to the base mark', () => {
  // Tigers (116) wear an Alternate in real games but have no alternate/DET.png
  // on disk — that URL resolves fine and then 404s.
  const tried = wpaLogoFor(116, 'alternate')
  assert.equal(tried.src, '/team-logos/alternate/DET.png')
  assert.equal(wpaLogoWithFallback(116, 'alternate', false).src, tried.src, 'tries the treatment first')

  const fellBack = wpaLogoWithFallback(116, 'alternate', true)
  assert.equal(fellBack.src, teamLogoUrl(116, 'base'))
  // Back on the base mark, so its recolor curation applies again — otherwise
  // the Tigers' navy "D" would vanish into their own navy band.
  assert.deepEqual(fellBack.recolor, LOGO_COLOR_OVERRIDES[116])
})

test('falling back keeps a swap override pointed at its precomputed asset', () => {
  const fellBack = wpaLogoWithFallback(142, 'alternate-4', true)
  assert.equal(fellBack.src, LOGO_COLOR_OVERRIDES[142].src)
})

test('a club with no recolor curation falls back to a plain base mark', () => {
  const fellBack = wpaLogoWithFallback(158, 'alternate-4', true)
  assert.equal(fellBack.src, teamLogoUrl(158, 'base'))
  assert.equal(fellBack.recolor, null)
})

// --- tile geometry ---------------------------------------------------------

test('the two paddings size the tile independently on their own axis', () => {
  const wide = wpaTilePlacements({ size: 20, paddingX: 10, paddingY: 4, rowShift: 0 })
  assert.equal(wide.tileW, 30) // size + paddingX
  assert.equal(wide.tileH, 24) // size + paddingY, one row
  assert.deepEqual(wide.images, [{ x: 5, y: 2 }]) // each inset by half its own padding

  const tall = wpaTilePlacements({ size: 20, paddingX: 4, paddingY: 10, rowShift: 0 })
  assert.equal(tall.tileW, 24)
  assert.equal(tall.tileH, 30)
  assert.deepEqual(tall.images, [{ x: 2, y: 5 }])
})

test('a row shift staggers alternating rows by that % of a tile width', () => {
  const { tileW, tileH, images } = wpaTilePlacements({ size: 20, paddingX: 4, paddingY: 4, rowShift: 50 })
  // Two rows per tile — repeating THAT is what makes every other row stagger.
  assert.equal(tileW, 24)
  assert.equal(tileH, 48)
  assert.deepEqual(images, [
    { x: 2, y: 2 },
    { x: 14, y: 26 }, // half a tile width (12) over, one row height (24) down
  ])
})

test('a shift of zero or a whole tile width collapses back to a plain grid', () => {
  const plain = wpaTilePlacements({ size: 20, paddingX: 4, paddingY: 4, rowShift: 0 })
  assert.equal(plain.images.length, 1)
  assert.equal(plain.tileH, 24)
  // 100% lands every row back in the same columns — same picture, half the draws.
  assert.deepEqual(wpaTilePlacements({ size: 20, paddingX: 4, paddingY: 4, rowShift: 100 }), plain)
})

test('a negative padding still leaves a positive tile to repeat', () => {
  // Overlapping marks on purpose: the logo is bigger than its own tile, and
  // the pattern's overflow:visible is what lets neighbors bleed into each
  // other. The tile itself must never collapse to zero/negative height.
  const { tileH } = wpaTilePlacements({ size: 20, paddingX: 4, paddingY: -40, rowShift: 0 })
  assert.ok(tileH >= 1, `tile height stayed positive, got ${tileH}`)
})

test('layout falls back to the shared defaults, row shift off', () => {
  const layout = wpaLogoLayout(NATIONALS, 'main')
  assert.deepEqual(layout, WPA_LOGO_DEFAULTS)
  assert.equal(layout.rowShift, 0, 'bands ship as a plain grid until a team opts in')
  assert.equal(wpaTilePlacements(layout).images.length, 1, 'one logo per tile by default')
  // wpaTilePlacements fills in anything a caller leaves out, so a partial
  // override (say size alone) can't silently drop the shift or a padding.
  assert.deepEqual(wpaTilePlacements({ size: WPA_LOGO_DEFAULTS.size }), wpaTilePlacements(layout))
})
