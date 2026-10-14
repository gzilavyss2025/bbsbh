// The Target command module's pure view (#2015). The ledger rows and the miss cloud as plain data.
// No React, no fetch. Both files hold one season of completed games, so nothing here is a score.
import { REFERENCE_RINGS, gloveTargetBias, gloveTargetView } from '../../../../../api/gloveTarget.js'
import { attributionFor, targetCommandRows } from '../../../../../api/targetCommand.js'
import { ordinal } from '../../../../../lib/format.js'
import { pitchMark } from '../../../../../lib/pitch/pitchTypes.js'

const num = (n) => Number(n).toLocaleString('en-US')
const finite = (n) => (Number.isFinite(n) ? n : null)

// The ledger: All pitches first, then most thrown (targetCommandRows). A pitch's mark comes from
// pitchMark(code); All has none. Null under two rows.
export function targetView({ entry, data }) {
  const base = targetCommandRows(entry, data)
  if (!base) return null
  const rows = base.map((r) => ({
    key: r.key,
    label: r.label,
    mark: r.key === 'ALL' ? null : pitchMark(r.key),
    value: r.value,
    mlb: r.baseline ?? '—',
    n: num(entry[r.key][0]),
    pct: ordinal(r.percentile),
    percentile: r.percentile,
    miss: entry[r.key][1],
    league: finite(data?.median?.[r.key]),
  }))
  return {
    rows,
    count: entry.ALL ? `${num(entry.ALL[0])} tracked` : undefined,
    credit: attributionFor(data),
  }
}

// One row's miss cloud, or null when the glove file has no entry for that code (never the All cloud under
// another pitch's name). Dots are in inches in the camera view behind the pitcher: x mirrored, y down.
export function cloudFor(glove, row) {
  const v = glove?.[row.key] ? gloveTargetView(glove, row.key) : null
  if (!v) return null
  const bias = gloveTargetBias(v)
  const lean = bias ? `Leans ${bias.text}` : 'No lean: the cloud sits on the glove'
  const mlb = row.league != null ? ` · MLB ${row.mlb}` : ''
  return {
    mark: row.mark,
    dots: v.dots.map((d) => ({ x: -d.x, y: -d.z, clamped: d.clamped })),
    rings: REFERENCE_RINGS,
    median: row.miss,
    league: row.league,
    lean,
    readout: `${row.value} in median miss${mlb} · ${row.pct} pct · ${v.dots.length} of ${row.n} drawn`,
    aria:
      `${row.label} miss cloud: median ${row.value} inches from the glove` +
      (row.league != null ? `, MLB middle ${row.mlb}` : '') +
      `. ${lean}.`,
  }
}
