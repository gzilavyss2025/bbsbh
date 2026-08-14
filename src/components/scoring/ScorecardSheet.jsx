import { AtBatBox } from './AtBatBox.jsx'
import { cellNote } from '../../lib/scorecardNotes.js'

// The main scorecard grid, in the #22 sheet's own column order: a sticky
// PLAYER column (each row led by its batting-order number), the Pos. column
// beside it, the innings, and the AB/H/R/RBI summary columns on the right —
// all inside one horizontal scroll (the sheet is wider than a phone by
// design — you swipe it the way you'd slide a paper scorebook across the
// table). The foot row is the #22's own: P · TP · LOB per inning (pitches
// seen, running total, runners stranded) under an amber TOTALS bar for the
// four summary columns. Runs-per-inning live in the sheet's scoreboard block
// (Scorecard.jsx), where the paper sheet keeps them.
//
// Two modes:
//  • Empty template (no `grid`) — nine blank rows over `templateInnings` innings
//    (default 11, the paper sheet's own count); `lineup` (optional,
//    [{ pos, name }]) fills only the left column.
//  • Loaded game (`grid` from api/scorecardGame.js) — one plate appearance per
//    cell. Most innings are one column; an inning where a slot batted around
//    widens into extra columns (the inning number only labels its first). Each
//    slot renders one row per player who occupied it — the starter, then a
//    sub-line for each substitute — so a pinch-hitter gets his own name and
//    line instead of sharing the starter's. The foot row carries that
//    inning's P/TP/LOB once its half is revealed.
//
// `notes` + `onCellTap` are the override layer (lib/scorecardNotes.js): each
// cell renders its own note over the derived marks, and on an editable
// surface tapping a filled cell hands its card up to the notation editor.
//
// `flip` is the TURN HANDOFF, and it rides the sheet rather than a banner
// above it: `{ inning, label, onFlip }` puts a button in that one inning's
// LEADOFF box — the next-due batter's unused cell for the half that just
// ended, never an older one (`leadoffCells`, valued by inning). That box is
// where the reader's eye lands when a half closes and it is empty by
// definition, so the handoff costs the sheet no notation. Every older
// leadoff box stays blank.
const SUMMARY = ['AB', 'H', 'R', 'RBI']
const SLOTS = [1, 2, 3, 4, 5, 6, 7, 8, 9]

// The display rows for one batting-order slot: one per occupant in a loaded
// game (starter first, then each sub as its own sub-line), or a single blank
// row from the pre-pitch lineup for the empty template / a slot nobody batted.
// The slot's leadoff boxes ride the FIRST row — they name an unused box,
// which no occupant's card competes with.
function slotRows(grid, lineup, slotIndex) {
  const slot = grid?.slots?.[slotIndex]
  if (slot?.rows?.length) {
    return slot.rows.map((occ, oi) => ({
      key: occ.id ?? oi,
      pos: occ.pos,
      name: occ.name,
      cells: occ.cells,
      leadoffCells: oi === 0 ? slot.leadoffCells : null,
      ab: occ.ab,
      h: occ.h,
      r: occ.r,
      rbi: occ.rbi,
      isSub: oi > 0,
      // The frontier seal rides the slot's LAST display row — the current
      // occupant is the one due up.
      isLast: oi === slot.rows.length - 1,
      hasStats: true,
    }))
  }
  return [
    {
      key: 'starter',
      pos: lineup[slotIndex]?.pos ?? '',
      name: lineup[slotIndex]?.name ?? '',
      cells: null,
      leadoffCells: grid?.slots?.[slotIndex]?.leadoffCells ?? null,
      isSub: false,
      isLast: true,
      hasStats: false,
    },
  ]
}

export function ScorecardSheet({
  lineup = [],
  grid = null,
  templateInnings = 11,
  notes = null,
  onCellTap = null,
  onFrontierTap = null,
  fresh = null,
  flip = null,
}) {
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
            <th className="sc-sheet__name sc-sheet__corner" scope="col">
              Player
            </th>
            <th className="sc-sheet__pos sc-sheet__corner" scope="col">
              Pos.
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
            slotRows(grid, lineup, i).map((row, ri) => (
              <tr
                key={`${slot}-${row.key}`}
                className={`${row.isSub ? 'sc-sheet__row--sub' : 'sc-sheet__row--slot'}`}
              >
                <td className={`sc-sheet__name ${row.isSub ? 'sc-sheet__name--sub' : ''}`}>
                  {/* The batting-order number leads the starter's name the way
                      the paper sheet preprints it; a sub-line drops it. */}
                  {ri === 0 && !row.isSub && <span className="sc-sheet__slotnum">{slot}</span>}
                  {row.name}
                </td>
                <td className="sc-sheet__pos">{row.pos}</td>
                {columns.map((col) => {
                  const card = col.colIndex != null ? row.cells?.[col.colIndex] ?? null : null
                  // The reveal frontier: the next plate appearance's own box,
                  // face-down. Tapping it is the sheet's play verb — one step
                  // of the same reveal cursor the innings viewer walks.
                  const isFrontier =
                    onFrontierTap != null &&
                    card == null &&
                    row.isLast &&
                    grid?.frontier != null &&
                    grid.frontier.slot === slot &&
                    grid.frontier.colIndex === col.colIndex
                  // The inning this box is the LEADOFF box for, if it is one
                  // — and whether it's the one the turn handoff hangs on this
                  // render.
                  const leadoffInning =
                    col.colIndex != null ? row.leadoffCells?.[col.colIndex] ?? null : null
                  const isFlip = flip != null && leadoffInning != null && leadoffInning === flip.inning
                  return (
                    <td
                      key={col.key}
                      className={`sc-sheet__cell ${col.inningStart ? 'sc-sheet__cell--start' : ''}`}
                    >
                      {isFrontier ? (
                        <button
                          type="button"
                          className="sc-ab__seal"
                          onClick={onFrontierTap}
                          aria-label="Reveal the next at-bat"
                        >
                          <span className="sc-ab__sealtext">Tap</span>
                        </button>
                      ) : isFlip ? (
                        <button
                          type="button"
                          className="sc-ab sc-ab__flip"
                          onClick={flip.onFlip}
                          aria-label={`${flip.label} — flip the sheet`}
                        >
                          <span className="sc-ab__fliptext">
                            {flip.label} <span aria-hidden="true">›</span>
                          </span>
                        </button>
                      ) : (
                        <AtBatBox
                          atbat={card}
                          note={cellNote(notes, card?.atBatIndex)}
                          onEdit={onCellTap && card ? () => onCellTap(card) : null}
                          fresh={Boolean(card && fresh?.has(card.atBatIndex))}
                        />
                      )}
                    </td>
                  )
                })}
                <td className="sc-sheet__sum">{row.hasStats ? row.ab : ''}</td>
                <td className="sc-sheet__sum">{row.hasStats ? row.h : ''}</td>
                <td className="sc-sheet__sum">{row.hasStats ? row.r : ''}</td>
                <td className="sc-sheet__sum">{row.hasStats ? row.rbi : ''}</td>
              </tr>
            )),
          )}
          {/* The #22's foot row: P / TP / LOB under each inning's first
              column (a widened inning's extra columns stay blank, same as
              the header number), the AB/H/R/RBI sums under the amber TOTALS
              bar at the right. Blank until a half is revealed. */}
          <tr className="sc-sheet__totals">
            <td className="sc-sheet__name sc-sheet__ptl">
              <span className="sc-sheet__ptlLabel">P</span>
              <span className="sc-sheet__ptlLabel">TP</span>
              <span className="sc-sheet__ptlLabel">LOB</span>
            </td>
            <td className="sc-sheet__pos" />
            {columns.map((col) => {
              const line = grid && col.inningStart ? grid.perInning?.[col.inning] : null
              return (
                <td
                  key={col.key}
                  className={`sc-sheet__totcell ${col.inningStart ? 'sc-sheet__cell--start' : ''}`}
                >
                  {line && (
                    <span className="sc-sheet__ptl">
                      <span>{line.p}</span>
                      <span>{line.tp}</span>
                      <span>{line.lob}</span>
                    </span>
                  )}
                </td>
              )
            })}
            <td className="sc-sheet__sum sc-sheet__totbar">{grid ? grid.totals.ab : ''}</td>
            <td className="sc-sheet__sum sc-sheet__totbar">{grid ? grid.totals.h : ''}</td>
            <td className="sc-sheet__sum sc-sheet__totbar">{grid ? grid.totals.r : ''}</td>
            <td className="sc-sheet__sum sc-sheet__totbar">{grid ? grid.totals.rbi : ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
