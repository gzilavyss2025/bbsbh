import { regionLabel } from '../../../lib/zone/regions.js'

// THE WHERE SECTION'S HOT AND COLD TILES (#1490, #2319 V09), on All + xwOBA (est.)
// only: how much of the pitcher's mix goes where the hitter is hottest, and where he
// is coldest. Pure; test/scout-edge.test.js pins them.
//
// "Hot" is the hitter map's top tone (hi2). "Cold" is both blue tones (lo1 and lo2),
// the canvas's figure (26% for Pivetta vs Chourio). The regions take their names from
// regionLabel, the readout's own words: field sides and inside / away, never "left" or
// "right" (ADR-0093 decision 4).
//
// `stance` is the pitcher board's, `hitterStance` the hitter map's (they differ for a
// switch hitter with the other hand picked). A region name is "inside" or "away" only
// when both maps draw the same stance, as the readout does; otherwise it is the side
// of the field, true on both (regionLabel, stance null).
// Returns `{ hot, cold }`, each `{ share, names, range: [low, high] }` or null when no
// region has that tone, or null when there is nothing to weigh.
export function spotShares({ board, side, stance, hitterStance = stance }) {
  if (!board?.all || board.all.thin || !side?.all) return null
  const named = stance === hitterStance ? stance : null
  const cells = side.all.cells
  const spots = (tones) => {
    const regions = Object.keys(cells).filter((r) => tones.includes(cells[r].tone))
    if (!regions.length) return null
    const values = regions.map((r) => cells[r].value).filter((v) => v != null).sort((a, b) => parseFloat(a) - parseFloat(b))
    return {
      share: regions.reduce((s, r) => s + (board.all.share[r] ?? 0), 0),
      names: regions.map((r) => regionLabel(r, named)),
      range: [values[0], values.at(-1)],
    }
  }
  return { hot: spots(['hi2']), cold: spots(['lo1', 'lo2']) }
}

// The region the page picks at load: where the hitter does the most damage, the one with
// the highest value. A region under its floor has no value, so it is never picked; with
// no region left (or no map) nothing is picked.
export function hottestRegion(cells) {
  const valued = Object.keys(cells ?? {}).filter((r) => cells[r].value != null)
  return valued.reduce((a, b) => (parseFloat(cells[b].value) > parseFloat(cells[a].value) ? b : a), valued[0] ?? null)
}
