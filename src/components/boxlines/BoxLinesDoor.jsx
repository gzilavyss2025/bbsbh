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
// `chip` MAKES IT ONE OF A ROW instead of a line of its own. The Game lines
// card's seven weekday doors (#1001) are a comparison, and a comparison wants
// its answers side by side; seven full ledger rows would be seven lines of
// nearly the same sentence. A chip prints its own short name and a shortened
// line, so `label` stops being the visible text and goes on being the ONE
// thing it was always for: the sheet's headline, verbatim. Both come from the
// same career stat (careerSplits.js's `chipLine` and `careerSplitLine`), so a
// chip and the sheet it opens cannot disagree about the career — only about
// how much of it they have room to say.
//
// The chip drops the words "See all" and keeps the chevron. Seven of them on
// one row is noise where one of them on a line is the house's plain promise,
// and the chip is small enough that the whole of it reads as the control.
export function BoxLinesDoor({ className = '', label, chip = null, sheet }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`boxlines-door ${chip ? 'boxlines-door--chip ' : ''}${className}`.trim()}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        // A chip's visible text is an abbreviation; the full line is what it
        // stands for, and it is what a screen reader should read out.
        aria-label={chip ? label : undefined}
      >
        {chip ? (
          <>
            <span className="boxlines-door__chipname">
              {chip.name}
              <span aria-hidden="true">›</span>
            </span>
            <span className="boxlines-door__chipline">{chip.line}</span>
          </>
        ) : (
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
