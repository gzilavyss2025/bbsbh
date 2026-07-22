// A ranked/tabular ledger — the scorebook-style table used by the player
// page (pitch arsenal, game log, the career register) and the standalone top
// prospects page. `rows` are `{ key, cells, allStar?, className? }`; `className`
// inks/pencils a row (the register's MLB-vs-MiLB tiers). A footer is either a
// single `total` (+`totalLabel`) or, for split footers like the register's
// MLB/MiLB totals, a `totals` array of `{ label, cells, className? }`.
// `hideNarrow` is a set of whole-row column indices (matching `head`) that
// collapse on a phone via CSS — the secondary stat columns the career register
// sheds on a small screen.

export function Ledger({ head, rows, leftCols = 2, total = null, totalLabel = '', totals = null, hideNarrow = [] }) {
  const hide = new Set(hideNarrow)
  const narrow = (i) => (hide.has(i) ? 'col-narrow-hide' : '')
  const cellClass = (i) =>
    [i === 0 ? 'lft yr' : i < leftCols ? 'lft ledger__sub' : '', narrow(i)].filter(Boolean).join(' ')
  const footRows = totals ?? (total ? [{ label: totalLabel, cells: total }] : [])
  return (
    <div className="ledger-wrap">
      <table className="ledger">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={h} className={[i < leftCols ? 'lft' : '', narrow(i)].filter(Boolean).join(' ')}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className={[r.allStar && 'is-allstar', r.className].filter(Boolean).join(' ')}>
              {r.cells.map((c, i) => {
                const span = c && typeof c === 'object' && c.__ledgerSpan
                return (
                  <td
                    key={i}
                    className={span ? `${cellClass(i)} ledger__span`.trim() : cellClass(i)}
                    colSpan={span ? head.length - i : undefined}
                  >
                    {span ? c.value : c}
                  </td>
                )
              })}
            </tr>
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
