import { useEffect, useRef } from 'react'

// The per-dimension "what is this page" explainer, popped from an info button
// beside the title instead of sitting in the page flow permanently — the
// workbench redesign gave every dimension a busier masthead row, and several
// sentences of onboarding copy don't need to cost vertical space on every
// visit. Same dialog contract as LogoModal/UmpireAccuracyModal: dismiss via
// backdrop tap, the close button, or Escape; focus moves to the close button
// on open and back to the trigger on close.
export function LabHintModal({ title, hint, onClose }) {
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
    <div className="scrim scrim--center" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
      <div className="idlabhint" role="dialog" aria-modal="true" aria-label={`About ${title}`}>
        <div className="idlabhint__head">
          <span className="idlabhint__title">{title}</span>
          <button ref={closeRef} className="szmodal__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="idlabhint__body">{hint}</p>
      </div>
    </div>
  )
}
