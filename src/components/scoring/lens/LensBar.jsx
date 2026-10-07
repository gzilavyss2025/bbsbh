import { useEffect, useState } from 'react'
import { Button } from '../../ui/control/Button.jsx'
import { liveLine } from '../../../lib/scorecard/bar.js'

// The lens's bottom bar (ADR-0092), fixed under the pane at its final height
// (--lens-bar-h), because the frame's place is measured from the pane and the
// pane ends where this bar starts. Three rows: line A in plain words, the
// situation (the half's totals at a handoff) with the pitcher button on its
// right, and the buttons.
//
// The state and every word come from useLensBar (lib/scorecard/bar.js has the
// rules). This file only draws them. Its three taps are the page's own,
// behind the page's tap lock: Unwrap is the SAME reveal as the seal under the
// frame (G5), and Turn is the sheet's own flip.
//
// [Sheet] leaves the lens for THIS VISIT only: the page holds it in React
// state and stores nothing (ADR-0092 — the phone always opens in the lens).
//
// `pitcher` is the arm's surname ('' when the feed has none), or null with no
// arm to name; its button opens the pitcher sheet (`onPitcher`). Navy ink, no
// kraft: it lifts no seal.
export function LensBar({ bar, checkedAt, brought = false, refreshing, onSheet, onUnwrap, onTurn, onRefresh, pitcher = null, onPitcher }) {
  const { state, lines, batter } = bar
  return (
    <div className="sc-lensbar">
      {/* Polite, so a reader with a screen reader hears the play they just
          opened. Not at the live edge: that line ticks with the clock. */}
      <p className="sc-lensbar__words" aria-live={state === 'edge' ? 'off' : 'polite'}>
        {state === 'edge' ? <CheckedLine name={batter} checkedAt={checkedAt} brought={brought} /> : lines.lineA}
      </p>
      <div className="sc-lensbar__row">
        <p className="sc-lensbar__situation">{lines.situation}</p>
        {pitcher != null && (
          <Button skin="ghost" className="sc-lensbar__pitcher" onClick={onPitcher}>
            Pitching{pitcher ? <> · <u>{pitcher}</u></> : null} ›
          </Button>
        )}
      </div>
      <div className="sc-lensbar__actions">
        <Button className="sc-lensbar__sheet" icon={<GridIcon />} onClick={onSheet}>
          Sheet
        </Button>
        {state === 'sealed' ? (
          // The one kraft control in the bar: a tap lifts a seal (ADR-0083).
          // Hand-drawn on purpose, not Button: the seal skin stays scoped (ADR-0105).
          <button type="button" className="sc-lensbar__unwrap" onClick={onUnwrap}>
            <span className="sc-lensbar__unwraptext">{lines.label}</span>
          </button>
        ) : state === 'handoff' ? (
          <Button skin="ink" className="sc-lensbar__main" onClick={onTurn}>
            {lines.label}
          </Button>
        ) : state === 'edge' ? (
          <>
            <span className="sc-lensbar__waiting">{lines.label}</span>
            <Button
              className="sc-lensbar__refresh"
              icon="↻"
              busy={refreshing}
              aria-label="Refresh live game data"
              onClick={onRefresh}
            />
          </>
        ) : (
          <Button className="sc-lensbar__main" disabled>
            {lines.label}
          </Button>
        )}
      </div>
    </div>
  )
}

// "Arceneaux is batting · checked 12 s ago". The clock ticks here, in the one
// state that shows it; the poll's own timing is the page's and never changes.
function CheckedLine({ name, checkedAt, brought }) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000)
    return () => clearInterval(id)
  }, [])
  return liveLine(name, now, checkedAt, brought)
}

// The whole-sheet view's way back: a floating navy button over today's sheet.
export function LensBack({ onBack }) {
  return (
    <div className="sc-lensback">
      <Button skin="ink" onClick={onBack}>
        Back to the box
      </Button>
    </div>
  )
}

// A three-by-three grid: the whole sheet, drawn in the button's own ink.
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="1" y="1" width="14" height="14" rx="1" />
      <path d="M1 5.67h14M1 10.33h14M5.67 1v14M10.33 1v14" />
    </svg>
  )
}
