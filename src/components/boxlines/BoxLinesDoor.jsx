import { useState } from 'react'
import { BoxLinesSheet } from './BoxLinesSheet.jsx'

// The door to a Box Lines sheet (ADR-0069): the summary line itself, as a real
// button, with a "See all ›" label pushed to its far end in the app's
// chevron-link voice — the same words every other "open the full list behind
// this summary" door says (ChevronLink.jsx). "Box Lines" is the internal name
// for this drilldown and never appears on the page; what the reader sees is
// the sheet's own vocabulary, "game lines". Owns the open bit and mounts the sheet, so a surface that
// wants a door pays one element, not a state hook and a mount of its own —
// which is what keeps the lineup page's change to a handful of lines against
// its file cap. `className` lets the host dress the line in its own row style
// (the Starting pitcher card's mono, dashed-rule `.startercard__careervs`);
// `sheet` is everything BoxLinesSheet needs except the headline, which is
// always this label, verbatim, so the door and the sheet cannot disagree.
//
// `face` REPLACES THE VISIBLE TEXT and leaves everything else alone. A door on
// a line of its own says its whole career and "See all ›"; a door that is one
// ROW OF A TABLE says the same career in the table's columns, and the words
// "See all" on twenty-five of them is noise where one of them on a line is the
// house's plain promise. Both are the same control in different clothes, so
// the host dresses it and this file goes on owning the only two things a door
// has ever owned: the open bit and the sheet.
//
// `label` then stops being the visible text and goes on being the ONE thing it
// was always for — the sheet's headline, verbatim — and becomes the button's
// accessible name, because a face is columns and a screen reader should hear
// the sentence.
export function BoxLinesDoor({ className = '', label, face = null, sheet }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`boxlines-door ${face ? 'boxlines-door--face ' : ''}${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // A face is a row of columns; the full line is what it says, and it is
        // what a screen reader should read out.
        aria-label={face ? label : undefined}
      >
        {face ?? (
          <>
            <span>{label}</span>
            <span className="boxlines-door__label">See all ›</span>
          </>
        )}
      </button>
      {open && <BoxLinesSheet {...sheet} headline={label} onClose={() => setOpen(false)} />}
    </>
  )
}
