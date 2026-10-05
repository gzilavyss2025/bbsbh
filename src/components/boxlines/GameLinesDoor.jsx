import '../../styles/boxlines/boxlines.css'
import { useMemo, useRef, useState } from 'react'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { Door } from '../ui/control/Door.jsx'
import { EmptyState } from '../ui/state/EmptyState.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { BoxLineRow } from './BoxLineRow.jsx'

// The door to the GAMES BEHIND A TEAM'S RECORD, on the postseason page: the
// record's own figure ("8-3") as a door, and the sheet it opens, every game
// that figure counts, newest first, each row a link to that game's box score.
// The player Box Lines (BoxLinesSheet.jsx, ADR-0069) answer "which games make
// up his line"; this answers "which games make up their record", with the same
// sheet shell and the same row.
//
// It fetches nothing. The postseason ledger the page already holds carries
// every game (src/api/postseason/records.js's gameRowsFor), so the rows are
// handed in and computed only once the door opens — a board of thirty clubs
// pays for none of them until one is tapped.
//
// SPOILER FOOTING. The page is an open surface (ADR-0034) and its W-L already
// counts these games; the sheet adds the dates and final scores of the same
// games, as the lineup page's Box Lines do. Each row's address leads to the
// box score, which stays sealed behind its own reveal. `rows` arrive trimmed
// to the page's `?d=` cutoff by gameRowsFor.
//
// `face` is the visible text (the figure); `label` is what a screen reader
// hears, and `sheet` carries the heading, note and headline.
export function GameLinesDoor({ face, label, rows, sheet }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Door aria-haspopup="dialog" aria-expanded={open} aria-label={label} onClick={() => setOpen(true)}>
        {face}
      </Door>
      {open && <GameLinesSheet {...sheet} rows={rows} onClose={() => setOpen(false)} />}
    </>
  )
}

// How many games the sheet draws before it asks. A combined list can run to
// a thousand rows (every club's day games, all years), which is a long wait
// for a phone to lay out; a club's own list never reaches it.
const PAGE = 100

const ROUNDS = 'WC Wild Card Series · DS Division Series · LCS League Championship Series · WS World Series.'

// `rows` is a function so the list is built on open, not on every render of
// every row of the table behind it.
function GameLinesSheet({ title, note, headline, rows: makeRows, onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  const all = useMemo(() => makeRows(), [makeRows])
  const [shown, setShown] = useState(PAGE)
  const rows = useMemo(() => all.slice(0, shown), [all, shown])
  // Alternates with each new season down the list (seasonBand's rule), in one pass.
  const bands = useMemo(() => {
    const out = []
    rows.forEach((row, i) => {
      out.push(i > 0 && (row.season !== rows[i - 1].season ? !out[i - 1] : out[i - 1]))
    })
    return out
  }, [rows])
  return (
    <ModalPortal>
      <div
        className="scrim scrim--boxlines"
        onClick={(e) => e.target.classList.contains('scrim') && onClose()}
      >
        <div className="sheet boxlines" role="dialog" aria-modal="true" aria-label={title}>
          <div className="boxlines__head">
            <div>
              <p className="boxlines__note">{note}</p>
              <h2 className="sheet__title boxlines__title">{title}</h2>
            </div>
            <IconButton ref={closeRef} onClick={onClose} label="Close">
              ✕
            </IconButton>
          </div>
          {headline && <p className="boxlines__headline">{headline}</p>}
          {all.length === 0 ? (
            <EmptyState className="boxlines__empty">No games to list.</EmptyState>
          ) : (
            <>
              <ul className="boxlines__rows">
                {rows.map((row, i) => (
                  <BoxLineRow
                    key={`${row.gamePk ?? `${row.date}-${row.opponentId}`}-${row.teamId}`}
                    row={row}
                    showSeason={i === 0 || rows[i - 1].season !== row.season}
                    band={bands[i]}
                  />
                ))}
              </ul>
              {all.length > shown && (
                <Door
                  layout="block"
                  aria-label={`Show ${Math.min(PAGE, all.length - shown)} more games, ${all.length - shown} not yet shown`}
                  onClick={() => setShown(shown + PAGE)}
                >
                  Show {Math.min(PAGE, all.length - shown)} more
                </Door>
              )}
              <p className="boxlines__foot">
                {ROUNDS} Newest first. Each club’s runs come first. Tap a game for its box score.
              </p>
            </>
          )}
        </div>
      </div>
    </ModalPortal>
  )
}
