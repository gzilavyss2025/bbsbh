// The React-free core of useDialogFocus.js — the two halves of the dialog
// contract most sheets here keep, split out so they can be tested without a DOM
// or a React renderer (the same split as revealProgressCore.js). Each returns
// its own cleanup, so the hook is just two effects that hand it back.

// Escape calls `onClose`. Listens on `window`, so it fires wherever focus sits.
// `getEl` (optional) returns an element inside this dialog. With it, Escape
// closes this dialog only when it is the topmost one on the page, so a sheet
// opened over another (a player over a roster) closes alone; a dialog whose
// element is not on the page does nothing. Portalled dialogs mount in order,
// so the last [role="dialog"] in the document is the one on top.
function isTopDialog(el) {
  if (!el) return false
  const own = el.closest?.('[role="dialog"]')
  if (!own) return true
  const all = document.querySelectorAll('[role="dialog"]')
  return all[all.length - 1] === own
}

export function bindEscape(onClose, getEl = null) {
  const onKey = (e) => e.key === 'Escape' && (!getEl || isTopDialog(getEl())) && onClose()
  window.addEventListener('keydown', onKey)
  return () => window.removeEventListener('keydown', onKey)
}

// Moves focus into the dialog (`el`, usually the close button — the first and
// safest control) and returns a cleanup that hands it back to whatever held it
// before, so a keyboard or AT user is not left focused under the scrim.
export function focusIn(el) {
  const trigger = document.activeElement
  el?.focus()
  return () => {
    if (trigger instanceof HTMLElement) trigger.focus()
  }
}
