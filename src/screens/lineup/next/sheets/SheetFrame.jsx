import { useRef } from 'react'
import { ModalPortal } from '../../../../components/ui/ModalPortal.jsx'
import { useDialogFocus } from '../../../../hooks/dialog/useDialogFocus.js'

// The frame of the page's sheets (crest, ballpark, umpire): the app's bottom sheet under a
// scrim, with a house band at the top (navy, never a club's colours: these sheets name no
// club, ADR-0030) and a close button. It is portalled, so a fixed scrim is not inside the strip's
// <dl> or the hero card's stacking context. A tap on the backdrop, the button or Escape closes it
// and focus goes back to the trigger.
export function SheetFrame({ title, label, onClose, children }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  return (
    <ModalPortal>
    <div className="scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet lsheet" role="dialog" aria-modal="true" aria-label={label ?? title}>
        <div className="lsheet__bar sectionhead--band sectionhead--house">
          <h2 className="lsheet__bartitle">{title}</h2>
          <button ref={closeRef} type="button" className="lsheet__close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="lsheet__body">{children}</div>
      </div>
    </div>
    </ModalPortal>
  )
}
