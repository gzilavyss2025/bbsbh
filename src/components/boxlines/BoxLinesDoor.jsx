import { useState } from 'react'
import { BoxLinesSheet } from './BoxLinesSheet.jsx'

// The door to a Box Lines sheet (ADR-0069): the summary line itself, as a real
// button, with the "Box lines ›" label pushed to its far end in the app's
// chevron-link voice. Owns the open bit and mounts the sheet, so a surface that
// wants a door pays one element, not a state hook and a mount of its own —
// which is what keeps the lineup page's change to a handful of lines against
// its file cap. `className` lets the host dress the line in its own row style
// (the Starting pitcher card's mono, dashed-rule `.startercard__careervs`);
// `sheet` is everything BoxLinesSheet needs except the headline, which is
// always this label, verbatim, so the door and the sheet cannot disagree.
export function BoxLinesDoor({ className = '', label, sheet }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`boxlines-door ${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span>{label}</span>
        <span className="boxlines-door__label">Box lines ›</span>
      </button>
      {open && <BoxLinesSheet {...sheet} headline={label} onClose={() => setOpen(false)} />}
    </>
  )
}
