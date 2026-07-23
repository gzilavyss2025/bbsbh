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
import { LOGO_COLOR_OVERRIDES, wpaLogoFor } from '../src/lib/wpaLogo.js'
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
