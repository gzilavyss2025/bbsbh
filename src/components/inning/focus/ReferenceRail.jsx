import { useEffect, useRef, useState } from 'react'
import { useMediaQuery, WIDE_QUERY } from '../../../hooks/useMediaQuery.js'
import { ModalPortal } from '../../ui/ModalPortal.jsx'

// Focus mode's reference band (Margin Notes, Pitchers, defense, lineups,
// rosters) used to fold away behind one button and reflow the at-bat card
// underneath it when opened. This is its replacement: a rail that never
// changes the at-bat's width.
//
//  • WIDE (≥740px, WIDE_QUERY): `children` render inside `<aside
//    className="focusrail">`, a real column `InningViewer`'s focus-mode grid
//    reserves at a fixed width (see 61-focus-mode.css) whether it is open or
//    not — only the panel's own visibility toggles, so opening it can never
//    push the at-bat card. Defaults OPEN (see useFocusMode's `railOpen`) so
//    the lineup/defense reference a hand-scorer needs stays on screen without
//    a tap (ADR-0010) — this is what the folded-by-default first pass got
//    wrong. The flap owns both the trigger and the region it controls
//    (`aria-controls`), rather than splitting that across two components.
//  • NARROW (<740px): a real reserved column doesn't fit next to a phone-width
//    at-bat card, so this renders a trigger instead, opening the SAME
//    `children` in a `.scrim`/`.sheet` bottom sheet via ModalPortal — the same
//    contract HighlightSheet/StrikeZone already use, portalled to <body> for
//    the same reason theirs are: `.turnscene`'s `isolation: isolate` would
//    otherwise trap the dialog under the floating bar (ModalPortal.jsx). This
//    sheet keeps its OWN open/closed state, deliberately not `open` (that's
//    `railOpen`, which defaults true for the wide rail's ADR-0010 fix) — a
//    modal that auto-opens over the whole screen on load is a bug, not a
//    reference surface; the phone sheet always starts closed regardless of
//    what the wide rail's default is.
export function ReferenceRail({ open, onOpen, onClose, turning, children }) {
  const wide = useMediaQuery(WIDE_QUERY)
  return wide ? (
    <WideRail open={open} onOpen={onOpen} onClose={onClose} turning={turning}>
      {children}
    </WideRail>
  ) : (
    <NarrowSheet>{children}</NarrowSheet>
  )
}

function WideRail({ open, onOpen, onClose, turning, children }) {
  return (
    <aside className="focusrail" data-open={open}>
      <button
        type="button"
        className="focusrail__flap"
        aria-expanded={open}
        aria-controls="focusrail-panel"
        aria-disabled={turning || undefined}
        onClick={open ? onClose : onOpen}
      >
        {open ? 'Hide lineups & defense' : 'Show lineups & defense'}
      </button>
      {/* `hidden` rather than a conditional render: the column's width comes
          from the grid track (61-focus-mode.css), never from this content, so
          there's nothing to lose by keeping it mounted while closed — and
          keeping it mounted means reopening never re-fetches or re-derives
          anything the caller already computed. */}
      <div id="focusrail-panel" className="focusrail__panel" hidden={!open}>
        {children}
      </div>
    </aside>
  )
}

function NarrowSheet({ children }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className="btn innings__foldbtn"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Open lineups & defense
      </button>
      {open && <RailSheet onClose={() => setOpen(false)}>{children}</RailSheet>}
    </>
  )
}

function RailSheet({ onClose, children }) {
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
    <ModalPortal>
      <div className="scrim" onClick={(e) => e.target.classList.contains('scrim') && onClose()}>
        <div className="sheet focusrail__sheet" role="dialog" aria-modal="true" aria-label="Lineups & defense">
          <div className="focusrail__sheethead">
            <h2 className="sheet__title">Lineups & Defense</h2>
            <button ref={closeRef} className="sheet__close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
          <div className="focusrail__sheetbody">{children}</div>
        </div>
      </div>
    </ModalPortal>
  )
}
