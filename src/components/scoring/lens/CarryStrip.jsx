import { AtBatBox } from '../AtBatBox.jsx'
import { cellNote } from '../../../lib/scorecardNotes.js'

// The carry strip's content (ADR-0092): the header and up to three labelled
// copies of boxes that are off the pane's screen. Each is the sheet's own
// AtBatBox, drawn by CSS `zoom` at the sheet's zoom times --lens-carry-scale
// (lens.css), not a second box. `boxes` come from lib/scorecard/carry.js, so
// they are opened boxes only (G8). Where they do not all fit the band, the
// strip wraps and clips the rest: it must not cover the frame.
export function CarryStrip({ boxes, notes, zoom }) {
  return (
    <div className="sc-carry" aria-hidden="true" style={{ '--carry-zoom': zoom }}>
      <p className="sc-carry__head">The order wrapped · carried from below</p>
      <div className="sc-carry__boxes">
        {boxes.map(({ atBatIndex, card, label }) => (
          <figure key={atBatIndex} className="sc-carry__item">
            <figcaption className="sc-carry__label">{label}</figcaption>
            <div className="sc-carry__box">
              <AtBatBox atbat={card} note={cellNote(notes, atBatIndex)} />
            </div>
          </figure>
        ))}
      </div>
    </div>
  )
}
