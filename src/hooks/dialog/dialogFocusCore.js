// The React-free core of useDialogFocus.js — the two halves of the dialog
// contract most sheets here keep, split out so they can be tested without a DOM
// or a React renderer (the same split as revealProgressCore.js). Each returns
// its own cleanup, so the hook is just two effects that hand it back.

// Escape calls `onClose`. Listens on `window`, so it fires wherever focus sits.
export function bindEscape(onClose) {
  const onKey = (e) => e.key === 'Escape' && onClose()
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
