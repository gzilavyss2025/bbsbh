// The Run value card's pure view (#2013). run-value.json in, the total, the rank, the strip and the part tiles
// out. No React, no fetch. The file ships facts; the totals and places are derived in api/around-the-game/runValue.js.
import { componentBoard, playerRunValue, signed, tone } from '../../../../../api/around-the-game/runValue.js'
import { ordinal } from '../../../../../lib/format.js'

const TOP = 10
const LABEL = { bat: 'Batting', fld: 'Defense', run: 'Baserunning', pit: 'Pitching' } // the table's own label for run says "Running"
const KEYS = { position: ['bat', 'fld', 'run'], pitchers: ['pit'] }
const pct = (n) => +n.toFixed(2)

export function runValueView(data, id, season) {
  const view = playerRunValue(data, id)
  if (!view || (season && Number(data.season) !== Number(season))) return null
  const year = season || data.season
  // A two-way player's mound runs are part of the total, so the card shows them once they are a run or more.
  const keys = view.role === 'position' && Math.abs(view.pit ?? 0) >= 1 ? [...KEYS.position, 'pit'] : KEYS[view.role]
  // A tile's bar is its share of all the runs the parts moved, up or down, so the bars compare with each other.
  const moved = keys.reduce((sum, k) => sum + Math.abs(view[k] ?? 0), 0)
  const parts = keys.map((key) => {
    const raw = view[key]
    const place = componentBoard(data, key, { limit: TOP }).find((r) => r.id === view.id)?.rank ?? null
    return {
      key,
      label: LABEL[key],
      value: signed(raw),
      tone: tone(raw),
      side: (raw ?? 0) < 0 ? 'down' : 'up',
      width: moved ? pct((Math.abs(raw ?? 0) / moved) * 100) : 0,
      place: place ? `${ordinal(place)} in MLB` : '',
    }
  })
  const poolWord = view.role === 'pitchers' ? 'pitchers' : 'position players'
  const ranked = view.rank && view.rank <= TOP
  return {
    total: signed(view.total),
    rank: ranked ? { place: ordinal(view.rank), caption: `${view.tied ? 'tied ' : ''}among ${poolWord}` } : null,
    // Where the rank falls from last (0) to best (100). The strip draws only beside a rank, so it never shows a lesser place.
    strip: ranked ? (view.of > 1 ? pct((1 - (view.rank - 1) / (view.of - 1)) * 100) : 100) : null,
    parts,
    count: `${year} season`,
  }
}
