import { AtBatBox } from './AtBatBox.jsx'

// The main scorecard grid: batting rows across the game's columns, a sticky
// Pos/Player column on the left and a sticky inning-header row on top, all inside
// one horizontal scroll (the sheet is wider than a phone by design — you swipe it
// the way you'd slide a paper scorebook across the table). Summary columns
// (AB H R RBI) and a TOTALS row close it out.
//
// Two modes:
//  • Empty template (no `grid`) — nine blank rows over `templateInnings` innings
//    (default 11, but a caller can ask for more so a long extra-inning game
//    still fits the blank sheet); `lineup` (optional, [{ pos, name }]) fills
//    only the left column.
//  • Loaded game (`grid` from api/loadScorecard.js) — one plate appearance per
//    cell. Most innings are one column; an inning where a slot batted around
//    widens into extra columns (the inning number only labels its first). Each
//    slot renders one row per player who occupied it — the starter, then a
//    sub-line for each substitute — so a pinch-hitter gets his own name and
//    line instead of sharing the starter's. The totals row carries the batting
//    team's runs under each inning's first column.
const SUMMARY = ['AB', 'H', 'R', 'RBI']
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// The display rows for one batting-order slot: one per occupant in a loaded
// game (starter first, then each sub as its own sub-line), or a single blank
// row from the pre-pitch lineup for the empty template / a slot nobody batted.
function slotRows(grid, lineup, slotIndex) {
  const slot = grid?.slots?.[slotIndex]
  if (slot?.rows?.length) {
    return slot.rows.map((occ, oi) => ({
      key: occ.id ?? oi,
      pos: occ.pos,
      name: occ.name,
      cells: occ.cells,
      ab: occ.ab,
      h: occ.h,
      r: occ.r,
      rbi: occ.rbi,
      isSub: oi > 0,
      hasStats: true,
    }))
  }
  return [
    {
      key: 'starter',
      pos: lineup[slotIndex]?.pos ?? '',
      name: lineup[slotIndex]?.name ?? '',
      cells: null,
      isSub: false,
      hasStats: false,
    },
  ]
}

export function ScorecardSheet({ lineup = [], grid = null, templateInnings = 11 }) {
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
    : Array.from({ length: templateInnings }, (_, i) => i + 1).map((n) => ({
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
          {SLOTS.map((slot, i) =>
            slotRows(grid, lineup, i).map((row) => (
              <tr
                key={`${slot}-${row.key}`}
                className={`${row.isSub ? 'sc-sheet__row--sub' : 'sc-sheet__row--slot'}`}
              >
                <td className="sc-sheet__pos">{row.pos}</td>
                <td className={`sc-sheet__name ${row.isSub ? 'sc-sheet__name--sub' : ''}`}>
                  {row.name}
                </td>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`sc-sheet__cell ${col.inningStart ? 'sc-sheet__cell--start' : ''}`}
                  >
                    <AtBatBox
                      atbat={col.colIndex != null ? row.cells?.[col.colIndex] ?? null : null}
                    />
                  </td>
                ))}
                <td className="sc-sheet__sum">{row.hasStats ? row.ab : ''}</td>
                <td className="sc-sheet__sum">{row.hasStats ? row.h : ''}</td>
                <td className="sc-sheet__sum">{row.hasStats ? row.r : ''}</td>
                <td className="sc-sheet__sum">{row.hasStats ? row.rbi : ''}</td>
              </tr>
            )),
          )}
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
