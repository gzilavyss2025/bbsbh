import { useEffect, useRef } from 'react'
import { useState } from 'react'
import { useNav } from '../lib/nav.js'

// The standalone, non-game pages — everything you'd otherwise only reach by
// scrolling to the bottom of the slate's footer (SiteFooter). Kept as a
// single list here so the header menu and footer can't drift.
const MENU_ITEMS = [
  { label: 'Standings', path: '/standings' },
  { label: 'League Leaders', path: '/leaders' },
  { label: 'Top MLB Prospects', path: '/prospects' },
  { label: 'Rehab Assignments', path: '/rehab' },
  { label: 'Umpire Rankings', path: '/umpires' },
  { label: 'Milestone Watch', path: '/milestones' },
  { label: 'Awards History', path: '/awards' },
  { label: 'Postseason History', path: '/postseason-history' },
  { label: 'All Star Game', path: '/all-star-rosters' },
  { label: 'Logo Sheet', path: '/logos' },
  { label: 'About', path: '/about' },
]

// A persistent icon button, sibling to SiteSearchButton, that opens a sheet
// listing the app's standalone pages (standings, leaders, prospects, etc.) —
// otherwise only reachable by scrolling to the bottom of the slate's footer.
// Lives in SiteHeader (every screen except the slate) and the slate's own
// topbar (see GameSelect), to the right of the search trigger.
export function SiteMenuButton({ className = '' }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`sitemenu-btn ${className}`}
        onClick={() => setOpen(true)}
        aria-label="More pages"
      >
        <MenuGlyph />
      </button>
      {open && <SiteMenuModal onClose={() => setOpen(false)} />}
    </>
  )
}

function MenuGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <line x1="2" y1="4.5" x2="16" y2="4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="9" x2="16" y2="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="2" y1="13.5" x2="16" y2="13.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function SiteMenuModal({ onClose }) {
  const navigate = useNav()

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

  const go = (path) => {
    onClose()
    navigate(path)
  }

  return (
    <div
      className="scrim"
      onClick={(e) => e.target.classList.contains('scrim') && onClose()}
    >
      <div
        className="sheet sitemenusheet"
        role="dialog"
        aria-modal="true"
        aria-label="More pages"
      >
        <div className="sitemenusheet__head">
          <h2 className="sheet__title">More</h2>
          <button
            ref={closeRef}
            type="button"
            className="sitesearchsheet__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <ul className="sitemenusheet__list">
          {MENU_ITEMS.map((item) => (
            <li key={item.path}>
              <button
                type="button"
                className="searchbox__item sitemenusheet__item"
                onClick={() => go(item.path)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
