import { Fragment } from 'react'

// A ranked/tabular ledger — the scorebook-style table used by the player
// page (pitch arsenal, game log, year-by-year) and the standalone top
// prospects page. `rows` are `{ key, cells, allStar?, subRows? }`; `subRows`
// (each `{ key, label, cells }`) render as extra muted, indented rows right
// after their parent — used for a season split across multiple MiLB levels.
export function Ledger({ head, rows, leftCols = 2, total = null, totalLabel = '' }) {
  const cellClass = (i) => (i === 0 ? 'lft yr' : i < leftCols ? 'lft opp' : '')
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={i < leftCols ? 'lft' : ''}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.key}>
              <tr className={r.allStar ? 'is-allstar' : ''}>
                {r.cells.map((c, i) => (
                  <td key={i} className={cellClass(i)}>{c}</td>
                ))}
              </tr>
              {r.subRows?.map((sr) => (
                <tr key={sr.key} className="ledger__subrow">
                  <td className="lft yr" />
                  <td className="lft opp">{sr.label}</td>
                  {sr.cells.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        {total && (
          <tfoot>
            <tr className="is-total">
              {[totalLabel, ...Array(leftCols - 1).fill(''), ...total].map((c, i) => (
                <td key={i} className={cellClass(i)}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
