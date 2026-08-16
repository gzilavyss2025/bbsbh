import { useEffect, useRef, useState } from 'react'
import { ModalPortal } from '../ui/ModalPortal.jsx'
import { atBatMarks } from './AtBatBox.jsx'

// The notation editor: tap a filled at-bat box on the scorecard and pencil
// over what the sheet derived — the outcome box (top-left), the RBI box, and
// the diamond-center fielding chain. Saving writes a per-cell override
// (lib/scorecardNotes.js) that wins at render time on THIS device only;
// "Use the feed's call" erases it. Nothing derived is modified and no tally
// re-reads an override — this is the margin-pencil layer, not a data entry
// tool.
//
// Same dialog contract as BallparkModal/WhatsBrewingModal: backdrop tap,
// close button, or Escape dismisses; focus moves into the sheet on open and
// back to the trigger on close. Portalled (ModalPortal) so it stays above the
// page chrome from either scorecard surface. Docked to the TOP of the screen
// (`.scrim--top`), unlike every other sheet in the app — this one is typed
// into, and a bottom-docked sheet sits exactly where the phone's keyboard
// lands (the ADR-0037 failure mode; see 41a-scorecard-page.css).
export function ScorecardCellEditor({ card, note, onSave, onClear, onClose }) {
  const b = card?.batter ?? {}
  const who = b.last ? `${b.last}${b.first ? `, ${b.first}` : ''}` : b.fullName ?? 'This at-bat'

  // Drafts open on what the box currently SHOWS — the override where one
  // exists, the derived mark otherwise (atBatMarks, the same derivation the
  // box renders from) — so editing is retracing the cell, not starting blank.
  const marks = atBatMarks(card)
  const [outcome, setOutcome] = useState(note?.outcome ?? marks.outcome)
  const [rbi, setRbi] = useState(note?.rbi ?? marks.rbi)
  const [center, setCenter] = useState(note?.center ?? marks.center)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const firstRef = useRef(null)
  useEffect(() => {
    const trigger = document.activeElement
    firstRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  const save = (e) => {
    e.preventDefault()
    onSave({ outcome, rbi, center })
    onClose()
  }

  return (
    <ModalPortal>
      <div
        className="scrim scrim--top"
        onClick={(e) => e.target.classList.contains('scrim') && onClose()}
      >
        <form
          className="sheet sc-editsheet"
          role="dialog"
          aria-modal="true"
          aria-label={`Edit the notation for ${who}`}
          onSubmit={save}
        >
          <h2 className="sc-editsheet__who">{who}</h2>
          <p className="sc-editsheet__hint">
            Pencil your own notation over this box. The sheet keeps its
            tallies from the feed; your marks live on this device only.
          </p>
          <div className="sc-editsheet__grid">
            <label className="sc-editsheet__field">
              <span className="sc-editsheet__label">Outcome</span>
              <input
                ref={firstRef}
                className="sc-editsheet__input"
                value={outcome}
                maxLength={8}
                onChange={(e) => setOutcome(e.target.value)}
              />
            </label>
            <label className="sc-editsheet__field">
              <span className="sc-editsheet__label">RBI</span>
              <input
                className="sc-editsheet__input"
                value={rbi}
                maxLength={2}
                inputMode="numeric"
                onChange={(e) => setRbi(e.target.value)}
              />
            </label>
            <label className="sc-editsheet__field">
              <span className="sc-editsheet__label">Diamond center</span>
              <input
                className="sc-editsheet__input"
                value={center}
                maxLength={10}
                onChange={(e) => setCenter(e.target.value)}
              />
            </label>
          </div>
          <div className="sc-editsheet__actions">
            {note && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  onClear()
                  onClose()
                }}
              >
                Use the feed’s call
              </button>
            )}
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              Pencil it in
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  )
}
