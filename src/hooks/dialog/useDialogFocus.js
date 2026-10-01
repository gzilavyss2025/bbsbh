import { useEffect } from 'react'
import { bindEscape, focusIn } from './dialogFocusCore.js'

// The dialog contract shared by the `.scrim`/`.sheet` dialogs: Escape calls
// `onClose`, focus moves to `focusRef` on open, and focus goes back to the
// trigger on close. `focusRef` is the element that takes focus — normally the
// close button. A dialog that also traps Tab, or opens and closes inside one
// mounted component, keeps its own effects instead.
export function useDialogFocus(focusRef, onClose) {
  useEffect(() => bindEscape(onClose), [onClose])
  useEffect(() => focusIn(focusRef.current), [focusRef])
}
