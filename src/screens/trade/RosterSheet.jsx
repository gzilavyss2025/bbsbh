import { useRef } from 'react'
import { useDialogFocus } from '../../hooks/dialog/useDialogFocus.js'
import { ModalPortal } from '../../components/ui/ModalPortal.jsx'
import { IconButton } from '../../components/ui/control/IconButton.jsx'

// A club's roster, opened from its card so the list never pushes the deal
// down the page. The filters and the list come in as children. Same
// .scrim/.sheet contract as the app's other sheets.
export function RosterSheet({ title, onClose, children }) {
  const closeRef = useRef(null)
  useDialogFocus(closeRef, onClose)
  return (
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet tradesheet rostersheet" role="dialog" aria-modal="true" aria-label={title}>
          <div className="tradesheet__head">
            <h2 className="sheet__title">{title}</h2>
            <IconButton ref={closeRef} mark="md" onClick={onClose} label="Close">✕</IconButton>
          </div>
          {children}
        </div>
      </div>
    </ModalPortal>
  )
}
