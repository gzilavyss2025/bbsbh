// THE ARRIVAL'S PARTS (ADR-0113, slice 3; docs/motion.md). A card starts as the plain yellow
// card (ink tab, photo, name, badges, logo). When its extra data arrives, a club band wipes
// across its top, the tab fades out, the head makes room and the sections unfold. The class
// list that says which look the card wears, and when it moves, is hooks/motion/useArrival.js;
// the resting looks are styles/pitcher-card/arrival.css and the motion styles/motion/arrival.css.

// The band: 30px of fill and a 3px underline, wiped in left to right. It is the section head's
// band (`.sectionhead--band` draws the ground, the underline, the ink and the ripple and sheen
// texture), so the colours come from the card: a club's triad through --bar-fill, --bar-accent
// and --bar-text, else the house navy. `house` forces the navy whatever the ancestor sets.
// It repeats the tab's words, so it is hidden from assistive technology; the tab stays in the
// DOM as the card's heading.
export function CardBand({ label, house = false }) {
  return (
    <div className={`cardband sectionhead--band${house ? ' sectionhead--house' : ''}`} aria-hidden="true">
      <span className="cardband__label">{label}</span>
    </div>
  )
}

// A section that unfolds (grid rows 0fr -> 1fr) at `delay` ms after the arrival begins. The
// wrapper stays in the DOM from the plain card on, so it has a closed state to open from.
export function Unfold({ open, delay, children }) {
  return (
    <div className="unfold" data-open={open || undefined} style={{ '--unfold-delay': `${delay}ms` }}>
      <div className="unfold__in">{open && children}</div>
    </div>
  )
}
