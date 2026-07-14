import { AtBatBox } from './AtBatBox.jsx'

// The main scorecard grid: batting rows across the game's columns, a sticky
// Pos/Player column on the left and a sticky inning-header row on top, all inside
// one horizontal scroll (the sheet is wider than a phone by design — you swipe it
// the way you'd slide a paper scorebook across the table). Summary columns
// (AB H R RBI) and a TOTALS row close it out.
//
// Two modes:
//  • Empty template (no `grid`) — nine blank rows over 11 innings; `lineup`
//    (optional, [{ pos, name }]) fills only the left column.
//  • Loaded game (`grid` from api/loadScorecard.js) — one plate appearance per
//    cell. Most innings are one column; an inning where a slot batted around
//    widens into extra columns (the inning number only labels its first). The
//    totals row carries the batting team's runs under each inning's first column.
const TEMPLATE_INNINGS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const SUMMARY = ['AB', 'H', 'R', 'RBI']
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

export function ScorecardSheet({ lineup = [], grid = null }) {
  // Normalize both modes to a flat column list: each column knows its header
  // label (an inning number on its first sub-column, else blank), whether it
  // starts an inning (for the divider rule), and its source inning.
  const columns = grid
    ? grid.columns.map((c, ci) => ({
        key: ci,
        colIndex: ci,
        label: c.inningStart ? c.inning : '',
        inningStart: c.inningStart,
        inning: c.inning,
      }))
    : TEMPLATE_INNINGS.map((n) => ({
        key: n,
        colIndex: null,
        label: n,
        inningStart: true,
        inning: n,
      }))

  return (
    <div className="sc-sheet__scroll">
      <table className="sc-sheet">
        <thead>
          <tr>
            <th className="sc-sheet__pos sc-sheet__corner" scope="col">
              Pos
            </th>
            <th className="sc-sheet__name sc-sheet__corner" scope="col">
              Player
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`sc-sheet__inning-h ${col.inningStart ? 'sc-sheet__inning-h--start' : ''}`}
                scope="col"
              >
                {col.label}
              </th>
            ))}
            {SUMMARY.map((s) => (
              <th key={s} className="sc-sheet__sum-h" scope="col">
                {s}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SLOTS.map((slot, i) => {
            const row = grid?.slots?.[i]
            return (
              <tr key={slot}>
                <td className="sc-sheet__pos">{lineup[i]?.pos ?? ''}</td>
                <td className="sc-sheet__name">{lineup[i]?.name ?? ''}</td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`sc-sheet__cell ${col.inningStart ? 'sc-sheet__cell--start' : ''}`}
                  >
                    <AtBatBox atbat={col.colIndex != null ? row?.cells?.[col.colIndex] ?? null : null} />
                  </td>
                ))}
                <td className="sc-sheet__sum">{row ? row.ab : ''}</td>
                <td className="sc-sheet__sum">{row ? row.h : ''}</td>
                <td className="sc-sheet__sum">{row ? row.r : ''}</td>
                <td className="sc-sheet__sum">{row ? row.rbi : ''}</td>
              </tr>
            )
          })}
          <tr className="sc-sheet__totals">
            <td className="sc-sheet__pos" />
            <td className="sc-sheet__name">Totals</td>
            {columns.map((col) => (
              <td
                key={col.key}
                className={`sc-sheet__totcell ${col.inningStart ? 'sc-sheet__cell--start' : ''}`}
              >
                {grid && col.inningStart ? grid.perInning?.[col.inning] ?? '' : ''}
              </td>
            ))}
            <td className="sc-sheet__sum">{grid ? grid.totals.ab : ''}</td>
            <td className="sc-sheet__sum">{grid ? grid.totals.h : ''}</td>
            <td className="sc-sheet__sum">{grid ? grid.totals.r : ''}</td>
            <td className="sc-sheet__sum">{grid ? grid.totals.rbi : ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
