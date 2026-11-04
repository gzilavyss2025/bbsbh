import { useState } from 'react'
import { LazyPanel } from '../state/LazyPanel.jsx'
import { lazyNamed } from '../../../lib/react/lazyNamed.js'

const SiteSearchModal = lazyNamed(() => import('../../chrome/SiteSearch.jsx'), 'SiteSearchModal')

// The site-wide search trigger — a persistent icon button (not an always-open
// input; on a phone-width header there's no room to dock one, and this is the
// mobile-standard pattern anyway) that opens SiteSearchModal. Lives in
// SiteHeader (every screen except the slate) and the slate's own topbar (see
// GameSelect). The button is static; the sheet downloads on the first tap (a
// failed chunk leaves the button inert, as an offline phone would).
export function SiteSearchButton({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`btn btn--ghost sitebar__search ${className}`}
        onClick={() => setOpen(true)}
        aria-label="Search players and teams"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" />
          <line x1="12.5" y1="12.5" x2="17" y2="17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {/* Rendered in place, NOT through ModalPortal: both hosts are already in the root
          stacking context, and the ALL-CAPS invariant is a `#root *` rule — a portal to
          <body> would land the sheet outside it (see the Clerk note in index.css). */}
      {open && (
        <LazyPanel reserve="search">
          <SiteSearchModal onClose={() => setOpen(false)} />
        </LazyPanel>
      )}
    </>
  )
}
