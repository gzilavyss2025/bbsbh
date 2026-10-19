import { useInViewOnce } from '../../../hooks/scroll/useInViewOnce.js'
import { fmtValue } from '../../../lib/scout/metrics.js'
import { glyphD } from '../../../lib/pitch/pitchGlyph.js'
import { pitchMark } from '../../../lib/pitch/pitchTypes.js'
import { ledgerRows, rowTag, versus } from '../edge/edge.js'

// THE PITCH ROWS (#2319, ADR-0118): one tug-of-war per pitch. A row is a
// button: a tap selects that pitch, a second tap clears it. Contact (xwOBA)
// and Whiff pull a bar from the league centre toward the side that metric
// favors; the swing line favors neither. Fixed metrics, so the Metric control
// does not move these rows. `sides` is the page's { [metric]: hitterSide }.
const SCALE = { xwoba: 0.1, whiff: 0.12 } // a full half-bar, in rate points

// The bar's left and width, in % of the track. Even or too few: no bar.
function pull(metric, row) {
  if (row.value == null || row.league == null || (row.who !== 'hitter' && row.who !== 'pitcher')) return null
  const w = Math.min(Math.abs(row.value - row.league) / SCALE[metric], 1) * 50
  return { left: row.who === 'hitter' ? 50 : 50 - w, width: w }
}

function Pull({ label, metric, row, names }) {
  const tag = rowTag(row, names)
  const bar = pull(metric, row)
  return (
    <span className="scout__pull" data-tone={tag.tone}>
      <span className="scout__pulllabel">{label}</span>
      <span className="scout__pulltrack" aria-hidden="true">
        {bar && <span className="scout__pullbar" style={{ left: `${bar.left}%`, width: `${bar.width}%` }} />}
        <span className="scout__pullmid" />
      </span>
      <span className="scout__pulltag">
        <b className="scout__pullword">{tag.word}</b>
        <span className="scout__pullvs">{versus(metric, row)}</span>
      </span>
    </span>
  )
}

export function PitchRows({ board, sides, names, sel, onSelect }) {
  const [ref, phase] = useInViewOnce(`scout:${names?.pitcher}:${names?.hitter}:pitches`)
  const xw = sides.xwoba
  if (!board || !xw) return null
  const contact = ledgerRows(board.types, xw, 'xwoba')
  const whiff = sides.whiff ? ledgerRows(board.types, sides.whiff, 'whiff') : []
  const swing = sides.swing ? ledgerRows(board.types, sides.swing, 'swing') : []
  return (
    <div className="scout__rows" ref={ref} data-motion={phase} role="group" aria-label="Pitch by pitch">
      <div className="scout__rowshead" aria-hidden="true">
        <span className="scout__rowsp">◀ {names.pitcher}’s side</span>
        <span>League</span>
        <span className="scout__rowsh">{names.hitter}’s side ▶</span>
      </div>
      <button type="button" className="scout__rowall" aria-pressed={sel === null} onClick={() => onSelect(null)}>
        <span>All pitches</span>
        <span className="scout__pullvs">{board.all.n.toLocaleString()} pitches</span>
      </button>
      {contact.map((r, i) => {
        const mark = pitchMark(r.code)
        const sw = swing[i]
        return (
          <button
            key={r.code}
            type="button"
            className="scout__prow"
            data-code={r.code}
            style={{ '--i': i }}
            aria-pressed={sel === r.code}
            onClick={() => onSelect(sel === r.code ? null : r.code)}
          >
            <span className="scout__prowhead">
              <svg className="scout__prowmark" width="16" height="16" viewBox="-11 -11 22 22" aria-hidden="true">
                <path d={glyphD(mark.shape, 7)} style={{ '--pitch': mark.color }} data-ring={mark.ring || undefined} />
              </svg>
              <span className="scout__prowname">{r.name}</span>
              <span className="scout__pullvs">{r.pct}% · {r.mph} mph</span>
            </span>
            <span className="scout__prowuse" aria-hidden="true"><span style={{ width: `${r.pct}%` }} /></span>
            <Pull label="Contact" metric="xwoba" row={r} names={names} />
            {whiff[i] && <Pull label="Whiff" metric="whiff" row={whiff[i]} names={names} />}
            {sw?.value != null && sw.league != null && (
              <span className="scout__prowswing">
                Swings at {fmtValue('swing', sw.value)} · league {fmtValue('swing', sw.league)} · favors neither
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
