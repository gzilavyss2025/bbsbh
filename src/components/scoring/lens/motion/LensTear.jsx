import { useState } from 'react'
import { sealTearPolygons } from '../../../../lib/sealTear.js'

// The lens's seal, torn (#724 L7). The reveal has already committed on the
// tap and the box under this is already inked; these are two copies of the
// seal's face, cut along lib/sealTear.js's split line, flying off it
// (styles/motion/scorecard-lens.css). The same split every other seal in the
// app tears along, so this is not a second tear: only its motion is the
// lens's own.
//
// Inside the opened box's cell, not portalled as SealBox's tear is, so the
// halves ride the pane's glide with the box they came off.
//
// The face is the seal's own (box.css draws .sc-lens__tearface with
// .sc-ab__seal), under its own class so nothing that finds the seal finds a
// copy. It holds no data: the face is a constant ("Tap"), and the
// seal never held a result (ADR-0002). aria-hidden, no pointer events. It
// unmounts when its animation ends, and useLensMotion keys it on the tap, so
// it plays once per tap and never again.
export function LensTear({ seed }) {
  const [done, setDone] = useState(false)
  if (done) return null
  const paths = sealTearPolygons(seed)
  return (
    <span className="sc-lens__tear" aria-hidden="true" onAnimationEnd={() => setDone(true)}>
      {['top', 'bottom'].map((half) => (
        <span key={half} className={`sc-lens__tearhalf sc-lens__tearhalf--${half}`} style={{ clipPath: paths[half] }}>
          <span className="sc-lens__tearface">
            <span className="sc-lens__teartext">Tap</span>
          </span>
        </span>
      ))}
    </span>
  )
}
