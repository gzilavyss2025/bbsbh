import { Fragment } from 'react'

// A ranked/tabular ledger — the scorebook-style table used by the player
// page (pitch arsenal, game log, the career register) and the standalone top
// prospects page. `rows` are `{ key, cells, allStar?, className?, onClick?,
// subRows? }`; `className` inks/pencils a row (the register's MLB-vs-MiLB
// tiers), `onClick` makes it a toggle (the register's collapsed climb), and
// `subRows` (each `{ key, label, cells, className? }`) render as extra muted,
// indented rows right after their parent. A footer is either a single `total`
// (+`totalLabel`) or, for split footers like the register's MLB/MiLB totals, a
// `totals` array of `{ label, cells, className? }`.
export function Ledger({ head, rows, leftCols = 2, total = null, totalLabel = '', totals = null }) {
  const cellClass = (i) => (i === 0 ? 'lft yr' : i < leftCols ? 'lft opp' : '')
  const footRows = totals ?? (total ? [{ label: totalLabel, cells: total }] : [])
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
              <tr
                className={[r.allStar && 'is-allstar', r.onClick && 'is-toggle', r.className]
                  .filter(Boolean)
                  .join(' ')}
                onClick={r.onClick}
              >
                {r.cells.map((c, i) => (
                  <td key={i} className={cellClass(i)}>{c}</td>
                ))}
              </tr>
              {r.subRows?.map((sr) => (
                <tr key={sr.key} className={`ledger__subrow ${sr.className ?? ''}`.trim()}>
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
        {footRows.length > 0 && (
          <tfoot>
            {footRows.map((t, ti) => (
              <tr key={ti} className={`is-total ${t.className ?? ''}`.trim()}>
                {[t.label, ...Array(leftCols - 1).fill(''), ...t.cells].map((c, i) => (
                  <td key={i} className={cellClass(i)}>{c}</td>
                ))}
              </tr>
            ))}
          </tfoot>
        )}
      </table>
    </div>
  )
}
