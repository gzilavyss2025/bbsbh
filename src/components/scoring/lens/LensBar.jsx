import { Button } from '../../ui/control/Button.jsx'

// The lens's bottom bar (ADR-0092), fixed under the pane at its final height
// (--lens-bar-h), because the frame's place is measured from the pane and the
// pane ends where this bar starts. Only [Sheet] lives in it for now; the plain
// words, the situation line and the Unwrap / Turn button come next (#724, L4).
//
// [Sheet] leaves the lens for THIS VISIT only: the page holds it in React
// state and stores nothing (ADR-0092 — the phone always opens in the lens).
export function LensBar({ onSheet }) {
  return (
    <div className="sc-lensbar">
      <div className="sc-lensbar__actions">
        <Button className="sc-lensbar__sheet" icon={<GridIcon />} onClick={onSheet}>
          Sheet
        </Button>
      </div>
    </div>
  )
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
