import { useEffect, useRef } from 'react'
import { GameFinder } from './GameFinder.jsx'

// Bottom-sheet wrapper around GameFinder, opened from the footer's "Find a
// past matchup" button so the two team pickers + results list don't have to
// live inline in the footer. Same dialog contract as LogoModal: Escape and a
// backdrop tap close it, focus moves to the close button on open and back to
// the trigger on close.
export function GameFinderModal({ onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const closeRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    closeRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

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
          <button
            ref={closeRef}
            type="button"
            className="gamefindersheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <GameFinder />
      </div>
    </div>
  )
}
