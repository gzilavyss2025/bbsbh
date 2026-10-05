import { regionLabel } from '../../../lib/zone/regions.js'

// THE ZONES TAB'S CALLOUT (#1490), under the readout, on All + xwOBA (est.)
// only: how much of the pitcher's mix goes where the hitter is hottest, and
// where the pitcher goes most. Pure; test/scout-edge.test.js pins the words.
//
// "Hottest" is the hitter map's top tone (hi2). The regions take their names
// from regionLabel, the readout's own words: field sides and inside / away,
// never "left" or "right" (ADR-0093 decision 4). The last clause is written
// only when the hitter is at league level (tone `mid`) in the pitcher's
// busiest region. Returns sentence parts (edge.js `textOf`), or null.
//
// `stance` is the pitcher board's, `hitterStance` the hitter map's (they differ for a
// switch hitter with the other hand picked). A region name is "inside" or "away" only
// when both maps draw the same stance, as the readout does; otherwise it is the side
// of the field, true on both (regionLabel, stance null).
const COUNT = ['no', 'one', 'two', 'three', 'four', 'five', 'six']
const lower = (s) => s.charAt(0).toLowerCase() + s.slice(1) // caps-js-exempt: a region name inside a sentence
const SPOT = { high: 'above the zone', low: 'below the zone' }
const spotName = (r, stance) => SPOT[r] ?? lower(regionLabel(r, stance))
const pct = (x) => `${Math.round(x * 100)}%`

export function zoneCallout({ board, side, stance, hitterStance = stance, names }) {
  if (!board?.all || board.all.thin || !side?.all) return null
  const named = stance === hitterStance ? stance : null
  const cells = side.all.cells
  const share = board.all.share
  const hot = Object.keys(cells).filter((r) => cells[r].tone === 'hi2')
  const top = Object.keys(share).reduce((a, b) => (share[b] > share[a] ? b : a))
  const parts = []
  if (hot.length) {
    const sum = hot.reduce((s, r) => s + (share[r] ?? 0), 0)
    parts.push(
      `${names.hitter}’s ${COUNT[hot.length] ?? hot.length} hottest ${hot.length === 1 ? 'spot' : 'spots'} (${hot.map((r) => spotName(r, named)).join('; ')}) get `,
      { strong: pct(sum) },
      ` of ${names.pitcher}’s pitches. `,
    )
  }
  parts.push(`His most common spot is ${spotName(top, named)} (`, { strong: pct(share[top]) }, ')')
  parts.push(cells[top]?.tone === 'mid' ? `, where ${names.hitter} is at league level.` : '.')
  return parts
}
