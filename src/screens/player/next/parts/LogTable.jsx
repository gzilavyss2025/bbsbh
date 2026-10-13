import '../../../../styles/player-next/both/logtable.css'
import { Table } from '../../../../components/ui/table/Table.jsx'

// THE GAME LOG TABLE (#1851), shared with the batter log (#1890), which passes its own columns.
// One markup, two looks, switched on the CARD's width (logtable.css): a table at 720 px or
// more, one card per row below that.
//
//   columns  [{ key, label, card, className?, cell? }]. `card` places the cell in the card
//            look: 'head' (top left), 'end' (top right), 'cell' (the stat row, with its
//            label above it) or 'foot' (the bottom line). `cell(row)` draws it; without
//            one the cell is row[key].
//   rows     data rows, each with a `key`; a row with a `divider` is a group's heading,
//            with its `note` (a count) beside it.
//   caption  the table's name for a screen reader ("Game log, 2026"); it does not show.
export function LogTable({ columns, rows, caption }) {
  return (
    <div className="logtable">
      <Table frame="bare" density="keep" className="logtable__grid">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`logtable__${c.card} ${c.className ?? ''}`.trim()}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) =>
            r.divider ? (
              <tr key={r.key} className="logtable__div">
                <th colSpan={columns.length} scope="rowgroup">
                  {r.divider} <span className="mono">{r.note}</span>
                </th>
              </tr>
            ) : (
              <tr key={r.key}>
                {columns.map((c) => (
                  <td key={c.key} className={`logtable__${c.card} ${c.className ?? ''}`.trim()}>
                    {c.card === 'cell' && <span className="logtable__lab">{c.label}</span>}
                    {c.cell ? c.cell(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ),
          )}
        </tbody>
      </Table>
    </div>
  )
}
