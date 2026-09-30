import { useRef } from 'react'
import { GameFinder } from './GameFinder.jsx'
import { IconButton } from '../ui/control/IconButton.jsx'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'

// Bottom-sheet wrapper around GameFinder, opened from the footer's "Find a
// past matchup" button so the two team pickers + results list don't have to
// live inline in the footer. Same dialog contract as LogoModal: Escape and a
// backdrop tap close it, focus moves to the close button on open and back to
// the trigger on close.
export function GameFinderModal({ onClose }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div
        className="sheet gamefindersheet"
        role="dialog"
        aria-modal="true"
        aria-label="Find a past matchup"
      >
        <div className="gamefindersheet__head">
          <h2 className="sheet__title">Find a past matchup</h2>
          <IconButton ref={closeRef} onClick={onClose} label="Close">
            ✕
          </IconButton>
        </div>
        <GameFinder />
      </div>
    </div>
  )
}
