// The Run value card's pure view (#2013). run-value.json in, the tiles, the part rows and the
// sentence out. No React, no fetch. The file ships facts; the totals and places are derived in api/around-the-game/runValue.js.
import { COMPONENTS, componentBoard, playerRunValue, signed, tone } from '../../../../../api/around-the-game/runValue.js'
import { ordinal } from '../../../../../lib/format.js'

const TOP = 10
const LABEL = { bat: 'Batting', fld: 'Defense', run: 'Baserunning', pit: 'Pitching' } // the table's own label for run says "Running"
const CAME = { bat: 'at the plate', fld: 'in the field', run: 'on the bases', pit: 'on the mound' }
const BASE_SCALE = { position: 30, pitchers: 10 }
const KEYS = { position: ['bat', 'fld', 'run'], pitchers: ['pit'] }
const prose = (key) => COMPONENTS.find((c) => c.key === key)?.inProse ?? ''
const round = (n) => Math.round(n ?? 0)

function sentence(view, keys) {
  const total = view.total
  if (Math.abs(total) < 1) return 'A season within a run of average overall.'
  if (total < 0) return 'Below average overall.'
  const best = keys.map((key) => ({ key, v: view[key] ?? 0 })).sort((a, b) => b.v - a.v)[0]
  if (!best || best.v < 1) return 'A season within a run of average overall.'
  if (round(best.v) === round(total)) return `All of it is ${prose(best.key)}: ${round(total)} runs came ${CAME[best.key]}.`
  const lead = best.v * 2 > total ? 'Most of it is' : 'The biggest piece is'
  return `${lead} ${prose(best.key)}: ${round(best.v)} of the ${round(total)} runs came ${CAME[best.key]}.`
}

export function runValueView(data, id, season) {
  const view = playerRunValue(data, id)
  if (!view || (season && Number(data.season) !== Number(season))) return null
  const year = season || data.season
  // A two-way player's mound runs are part of the total, so the card shows them once they are a run or more.
  const keys = view.role === 'position' && Math.abs(view.pit ?? 0) >= 1 ? [...KEYS.position, 'pit'] : KEYS[view.role]
  const scale = Math.max(BASE_SCALE[view.role], Math.ceil(Math.max(...keys.map((k) => Math.abs(view[k] ?? 0))) / 10) * 10)
  const parts = keys.map((key) => {
    const raw = view[key]
    const place = componentBoard(data, key, { limit: TOP }).find((r) => r.id === view.id)?.rank ?? null
    const word = prose(key)
    const line = place
      ? `${ordinal(place)} in MLB in ${word} runs.`
      : `No top-${TOP} place in ${word}${Math.abs(raw ?? 0) < 1 ? ': under a run' : ''}.`
    return {
      key,
      label: LABEL[key],
      value: signed(raw),
      tone: tone(raw),
      side: (raw ?? 0) < 0 ? 'down' : 'up',
      width: +((Math.abs(raw ?? 0) / scale) * 100).toFixed(2),
      line,
    }
  })
  const poolWord = view.role === 'pitchers' ? 'pitchers' : 'position players'
  return {
    total: signed(view.total),
    rank: view.rank && view.rank <= TOP ? { place: ordinal(view.rank), caption: view.tied ? `${poolWord} · tied` : poolWord } : null,
    parts,
    scale,
    sentence: sentence(view, keys),
    of: view.of,
    door: `${view.of} ${poolWord}`,
    foot: `${year} · Baseball Savant · context neutral`,
    count: `${year} season`,
  }
}
