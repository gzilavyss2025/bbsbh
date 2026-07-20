import { useEffect, useId, useRef, useState } from 'react'

// A small, self-contained "(i)" info popover for a caveat/definition — lighter
// than UmpireAccuracyModal (a full focus-trapping dialog for rich, navigable
// content). This is a one-off text tip, so it stays a hover/tap popover rather
// than a modal: it opens on hover/focus (CSS) AND on click/tap (this state),
// closes on Escape and outside-click, and its motion is CSS-only so
// prefers-reduced-motion is honoured in the stylesheet.
//
// Used in the navy section mastheads on the lineup pages (LineupStrengthCard,
// BullpenBoard). `label` is the button's accessible name; `children` is the tip.
export function InfoPopover({ label, children, className = '' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const tipId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [open])

  return (
    <span ref={wrapRef} className={`infopop ${className}`}>
      <button
        type="button"
        className="infopop__btn"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={tipId}
        onClick={() => setOpen((v) => !v)}
      >
        i
      </button>
      <span id={tipId} role="tooltip" className="infopop__tip">
        {children}
      </span>
    </span>
  )
}
