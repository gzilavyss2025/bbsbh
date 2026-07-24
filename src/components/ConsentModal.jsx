import { useEffect, useRef } from 'react'
import { useCopy } from '../copy/copyContext.js'

// The spoiler-consent modal, shared by every opt-in departure from the spoiler
// rule (Scores Unlocked now; Follow Live next). All wording comes from the
// admin-editable copy registry via `group` (e.g. 'scoresUnlocked') — the slots
// title/body/humorLine/changesNote/resetNote/confirm/dismiss. Slots a group
// doesn't define (Scores Unlocked has no changesNote) resolve to '' and are
// skipped, so one component serves both.
//
// Safety-by-default UX: the DISMISS button is rendered first and takes initial
// focus, so an inattentive Enter/tap keeps things sealed; the affirmative is
// second and never auto-focused. Escape and a backdrop tap both dismiss. This
// is the one place a user trades away spoiler protection, so the safe choice is
// always the default one.
//
// `resolveText` is an optional escape hatch: the admin copy panel passes its own
// resolver (built from unsaved edits) to preview the REAL modal with in-progress
// wording. Left undefined, the modal reads the live published copy.
let consentTitleSeq = 0

export function ConsentModal({ group, time, onConfirm, onDismiss, resolveText }) {
  const { t } = useCopy()
  const text = (slot) => (resolveText ? resolveText(slot) : t(`${group}.${slot}`, { time }))

  const sheetRef = useRef(null)
  const dismissRef = useRef(null)
  // Stable unique id for aria-labelledby (avoids a duplicate aria-label + <h2>).
  const titleId = useRef(`consent-title-${(consentTitleSeq += 1)}`).current

  useEffect(() => {
    const trigger = document.activeElement
    dismissRef.current?.focus()
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus()
    }
  }, [])

  // Keydown handled ON the dialog (not window) so we can trap focus and stop the
  // Escape from also reaching any global slate handler. aria-modal="true" is a
  // promise that Tab can't wander into the page behind the scrim — enforce it.
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onDismiss()
      return
    }
    if (e.key !== 'Tab' || !sheetRef.current) return
    const focusable = sheetRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    )
    if (focusable.length === 0) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const humor = text('humorLine')
  const changes = text('changesNote')

  return (
    <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onDismiss()}>
      <div
        ref={sheetRef}
        className="sheet consent"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className="sheet__title consent__title">
          {text('title')}
        </h2>
        <p className="sheet__body consent__body">{text('body')}</p>
        {changes && <p className="sheet__body consent__changes">{changes}</p>}
        {humor && <p className="consent__humor">{humor}</p>}
        <p className="consent__reset">{text('resetNote')}</p>
        <div className="consent__actions">
          <button
            ref={dismissRef}
            type="button"
            className="consent__btn consent__btn--dismiss"
            onClick={onDismiss}
          >
            {text('dismiss')}
          </button>
          <button
            type="button"
            className="consent__btn consent__btn--confirm"
            onClick={onConfirm}
          >
            {text('confirm')}
          </button>
        </div>
      </div>
    </div>
  )
}
