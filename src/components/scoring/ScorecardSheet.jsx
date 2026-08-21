import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AtBatBox } from './AtBatBox.jsx'
import { cellNote } from '../../lib/scorecardNotes.js'
import { PlayerLink } from '../player/PlayerLink.jsx'

// The main scorecard grid, in the #22 sheet's own column order: a sticky
// PLAYER column (each row led by its batting-order number, closed by the
// player's uniform number), the Pos column beside it, the innings, and the
// AB/H/R/RBI summary columns on the right. The foot row is the #22's own:
// P · WH · FO per inning — pitches this side saw, swings and misses, balls
// fouled off. Runs-per-inning live in the sheet's scoreboard block
// (Scorecard.jsx), where the paper sheet keeps them.
//
// ZOOM, NOT SCROLL BARS. The sheet is wider than a phone by design, and the
// pane used to say so with two scroll bars. It reads as paper now: the pane
// hides its bars and carries a −/+ zoom control instead. You open at full
// size on one region of the sheet and pull BACK to take the whole thing in,
// down to the fit-the-pane zoom, which is the floor. Drawn with CSS `zoom`
// rather than `transform: scale()` on purpose — `zoom` scales LAYOUT, so the
// three sticky edges (the Player/Pos rail, the inning header, the totals
// row) keep sticking to the real pane, which a transform would break.
//
// Two modes:
//  • Empty template (no `grid`) — nine blank rows over `templateInnings` innings
//    (default 11, the paper sheet's own count); `lineup` (optional,
//    [{ pos, name, jersey }]) fills only the left column.
//  • Loaded game (`grid` from api/scorecardGame.js) — one plate appearance per
//    cell. Most innings are one column; an inning where a slot batted around
//    widens into extra columns (the inning number only labels its first).
//
// ONE ROW PER SLOT. However many men batted in a slot, they share its row of
// boxes; the rail STACKS a written line for each (`slot.lines` — his own name,
// position, number, and his own AB/H/R/RBI in the summary columns), the way a
// scorer adds a line under the man he lifted rather than opening a fresh row
// of the grid. A row per occupant was tried first and left a full-height band
// of empty boxes under every starter who was ever pinch-hit for. The handover
// is drawn instead: `subMarks` rules off the box the incoming batter's first
// trip lands in, `pitcherMarks` the box of the first batter a new arm faces.
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
// The foot row's three readings, in the order the sheet prints them — written
// out rather than initialled. P/WH/FO is the printed sheet's own shorthand, but
// it is shorthand for a scorer who already knows the sheet; the words cost the
// rail nothing it was using and stop the line being a riddle on first read.
const FOOT_LABELS = ['Pitches', 'Whiffs', 'Fouls']
// How far the zoom control can pull past full size, and the factor one press
// of −/+ moves. The floor is never fixed: it is whatever fits the pane.
const ZOOM_MAX = 1.5
const ZOOM_STEP = 1.25
// Pane pixels the fit-the-pane floor leaves spare. The at-bat box's out
// circle hangs 8px past its own cell by design (.sc-ab__out, right: -8px), so
// the sheet paints a little wider than the table it is measured from; without
// this the floor still left the last summary column half over the edge.
const FIT_SLACK = 12

// One slot's row: its written lines for the rail (starter first, then each
// substitute), its shared cells, and its two handover marks. A loaded game
// takes them from the grid; the empty template / a slot nobody batted takes a
// single line off the pre-pitch lineup and has no cards at all.
function slotRow(grid, lineup, slotIndex) {
  const slot = grid?.slots?.[slotIndex]
  if (slot?.lines?.length) {
    return {
      lines: slot.lines.map((occ, oi) => ({ key: occ.id ?? oi, ...occ })),
      cells: slot.cells,
      subMarks: slot.subMarks,
      pitcherMarks: slot.pitcherMarks,
      leadoffCells: slot.leadoffCells,
      hasStats: true,
    }
  }
  return {
    lines: [
      {
        key: 'starter',
        pos: lineup[slotIndex]?.pos ?? '',
        name: lineup[slotIndex]?.name ?? '',
        jersey: lineup[slotIndex]?.jersey ?? '',
      },
    ],
    cells: null,
    subMarks: null,
    pitcherMarks: null,
    leadoffCells: slot?.leadoffCells ?? null,
    hasStats: false,
  }
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
  // `onWidth` reports the grid's own drawn width up, so the rest of the sheet
  // can hold to it — Scorecard.jsx caps the header band and footer trio at
  // exactly this, because a printed page's rules stop where its columns stop.
  // KEEP IT STABLE (a useCallback with no deps, as that caller does): it is a
  // dependency of `measure` below, which the ResizeObserver is subscribed with,
  // so a fresh arrow every render re-attaches the observer every render.
  onWidth = null,
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

  // The zoom floor — the zoom at which the WHOLE sheet fits the pane — is
  // measured, not calculated: the table's own laid-out width divided by the
  // zoom it was laid out at, which is a constant no matter which zoom is
  // showing. (A calculation off the --sc-* width tokens was tried and came up
  // short by the grid's per-column hairline borders, so the floor still cut
  // three summary columns off the right edge.) The division is what keeps
  // this from feeding itself; the epsilon below stops a sub-pixel rounding
  // difference from ping-ponging setState. `pick` is the reader's own choice,
  // clamped to the live floor so a rotation can never strand the sheet at a
  // zoom that no longer fits.
  const paneRef = useRef(null)
  const tableRef = useRef(null)
  const [floor, setFloor] = useState(1)
  const [pick, setPick] = useState(null)

  // Full size is the opening view — one region of the sheet, read at the size
  // it was drawn — unless the whole sheet already fits, in which case there is
  // nothing to zoom out of.
  const zoom = Math.min(Math.max(pick ?? 1, floor), ZOOM_MAX)
  const step = (factor) => setPick(Math.min(Math.max(zoom * factor, floor), ZOOM_MAX))

  const measure = useCallback(() => {
    const pane = paneRef.current
    const table = tableRef.current
    if (!pane || !table) return
    const drawn = table.getBoundingClientRect().width
    const natural = drawn / zoom
    if (!natural || !pane.clientWidth) return
    const next = Math.min(1, Math.max(pane.clientWidth - FIT_SLACK, 1) / natural)
    setFloor((was) => (Math.abs(was - next) > 0.005 ? next : was))
    // The DRAWN width, not the natural one: the header holds to the columns as
    // they are being read, so pulling the zoom back pulls the band in with it.
    onWidth?.(drawn)
  }, [zoom, onWidth])
  // No dependency list: the sheet's width also changes when an inning widens
  // or a reveal adds a column, neither of which resizes the pane.
  useLayoutEffect(measure)
  useEffect(() => {
    if (typeof ResizeObserver !== 'function' || !paneRef.current) return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(paneRef.current)
    return () => ro.disconnect()
  }, [measure])

  return (
    <div className="sc-sheet__frame">
      <div className="sc-zoom" role="group" aria-label="Sheet zoom">
        <button
          type="button"
          className="sc-zoom__btn"
          onClick={() => step(1 / ZOOM_STEP)}
          disabled={zoom <= floor + 0.001}
          aria-label="Zoom out"
        >
          −
        </button>
        <span className="sc-zoom__pct">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          className="sc-zoom__btn"
          onClick={() => step(ZOOM_STEP)}
          disabled={zoom >= ZOOM_MAX - 0.001}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="sc-sheet__scroll" ref={paneRef}>
        <table className="sc-sheet" ref={tableRef} style={{ zoom }}>
          <thead>
            <tr>
              <th className="sc-sheet__name sc-sheet__corner" scope="col">
                Player
              </th>
              <th className="sc-sheet__pos sc-sheet__corner" scope="col">
                Pos
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
              const row = slotRow(grid, lineup, i)
              return (
                <tr key={slot} className="sc-sheet__row--slot">
                  <td className="sc-sheet__name">
                    {/* The rail's stack: the starter's written line, then one
                        for each man who took the slot after him. The
                        batting-order number leads the first line the way the
                        paper sheet preprints it and no other; the uniform
                        number closes every line, pinned to the rail's right
                        edge. */}
                    {row.lines.map((line, li) => (
                      <span
                        key={line.key}
                        className={`sc-sheet__line ${li > 0 ? 'sc-sheet__line--sub' : ''}`}
                      >
                        {li === 0 && <span className="sc-sheet__slotnum">{slot}</span>}
                        {/* The name is the link, so the truncation the rail
                            depends on stays on the element that IS the name —
                            PlayerLink passes the class straight through to the
                            button, and falls back to a plain span with the same
                            class when a row has no id to link to. */}
                        <PlayerLink id={line.id} className="sc-sheet__who">
                          {line.name}
                        </PlayerLink>
                        <span className="sc-sheet__jersey">{line.jersey}</span>
                      </span>
                    ))}
                  </td>
                  <td className="sc-sheet__pos">
                    {row.lines.map((line) => (
                      <span key={line.key} className="sc-sheet__posline">
                        {line.pos}
                      </span>
                    ))}
                  </td>
                  {columns.map((col) => {
                    const card = col.colIndex != null ? row.cells?.[col.colIndex] ?? null : null
                    // The reveal frontier: the next plate appearance's own box,
                    // face-down. Tapping it is the sheet's play verb — one step
                    // of the same reveal cursor the innings viewer walks.
                    const isFrontier =
                      onFrontierTap != null &&
                      card == null &&
                      grid?.frontier != null &&
                      grid.frontier.slot === slot &&
                      grid.frontier.colIndex === col.colIndex
                    // The inning this box is the LEADOFF box for, if it is one
                    // — and whether it's the one the turn handoff hangs on this
                    // render.
                    const leadoffInning =
                      col.colIndex != null ? row.leadoffCells?.[col.colIndex] ?? null : null
                    const isFlip = flip != null && leadoffInning != null && leadoffInning === flip.inning
                    // The two handover marks, both ruled off the ARRIVING box:
                    // the incoming batter's number where he takes the slot over,
                    // the incoming pitcher's where his first batter comes up
                    // (api/scorecardGame.js). A double switch can set both on
                    // one box, and they sit on opposite sides of the rule.
                    const subJersey =
                      col.colIndex != null ? row.subMarks?.[col.colIndex] ?? null : null
                    const pitcherJersey =
                      col.colIndex != null ? row.pitcherMarks?.[col.colIndex] ?? null : null
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
                            subJersey={subJersey}
                            pitcherJersey={pitcherJersey}
                          />
                        )}
                      </td>
                    )
                  })}
                  {['ab', 'h', 'r', 'rbi'].map((k) => (
                    <td key={k} className="sc-sheet__sum">
                      {row.hasStats
                        ? row.lines.map((line) => (
                            <span key={line.key} className="sc-sheet__sumline">
                              {line[k]}
                            </span>
                          ))
                        : ''}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          {/* The #22's foot row: PITCHES · WHIFFS · FOULS under each inning's
              first column (a widened inning's extra columns stay blank, same as
              the header number), the AB/H/R/RBI sums under the amber TOTALS bar
              at the right. Blank until a half is revealed.

              A REAL <tfoot>, and that is what makes it pin. It was the last
              <tr> of the tbody with `position: sticky; bottom: 0` on its cells,
              which never engaged: a sticky table CELL is clamped by its own
              ROW, so it can never rise over the rows above it, and the line
              simply scrolled away with the grid. A sticky <tfoot> is the shape
              browsers actually pin to the bottom of a scrollport. Where it is
              unsupported the row still renders in place, unpinned — the same
              thing it did before, so this can only be an improvement. */}
          <tfoot className="sc-sheet__totals">
            <tr>
              <td className="sc-sheet__name sc-sheet__foot">
                <span className="sc-sheet__footlabel">
                  {FOOT_LABELS.map((l, i) => (
                    <span key={l}>
                      {i > 0 && <span className="sc-sheet__footdot" aria-hidden="true"> · </span>}
                      {l}
                    </span>
                  ))}
                </span>
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
                        <span>{line.whiffs}</span>
                        <span>{line.fouls}</span>
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
          </tfoot>
        </table>
      </div>
    </div>
  )
}
