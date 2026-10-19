import { METRICS } from '../../../lib/scout/metrics.js'
import { ledgerRows, ledgerScale, rowTag, versus } from '../edge/edge.js'

// THE PITCH ROWS (#2319): the ledger, one row per pill, drawn on one scale per
// metric. Moved unchanged out of EdgePanel. A row is a pitch pill too: a tap
// selects that pitch, a second tap clears it. Nothing without a hitter side.
export function PitchRows({ board, side, metric, names, sel, onSelect }) {
  if (!board || !side) return null
  const rows = ledgerRows(board.types, side, metric)
  const scale = ledgerScale(rows)
  return (
    <>
      <div className="scout__ledgerhead">
        <span className="scout__ledgertitle">{names.hitter} vs league, {METRICS[metric].label}</span>
        <span className="scout__ledgerkey" aria-hidden="true">
          <span className="scout__keytick" />league
          <span className="scout__keydot" />{names.hitter}
          <span className="scout__keyusage" />usage
        </span>
      </div>
      <div className="scout__ledger" role="group" aria-label={`${METRICS[metric].label} by pitch`}>
        {rows.map((r) => {
          const tag = rowTag(r, names)
          const has = r.value != null && r.league != null && scale
          const a = has ? scale.at(r.value) : 0
          const b = has ? scale.at(r.league) : 0
          return (
            <button
              key={r.code}
              type="button"
              className="scout__lrow"
              data-family={r.family}
              data-tone={tag.tone}
              aria-pressed={sel === r.code}
              aria-label={`${r.name}: ${tag.word}, ${versus(metric, r)}`}
              onClick={() => onSelect(sel === r.code ? null : r.code)}
            >
              <span className="scout__lname">
                <span className="scout__lpitch">{r.name}</span>
                <span className="scout__lsub">{r.pct}% · {r.mph} mph</span>
              </span>
              <span className="scout__lplot" aria-hidden="true">
                <span className="scout__laxis" />
                {has && (
                  <>
                    <span className="scout__lgap" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%` }} />
                    <span className="scout__ltick" style={{ left: `${b}%` }} />
                    <span className="scout__ldot" style={{ left: `${a}%` }} />
                </>
              )}
              <span className="scout__lusage" style={{ width: `${r.pct}%` }} />
            </span>
            <span className="scout__ltag">
              <span className="scout__lword">{tag.word}</span>
              <span className="scout__lvs">{versus(metric, r)}</span>
            </span>
          </button>
        )
      })}
    </div>
    </>
  )
}
