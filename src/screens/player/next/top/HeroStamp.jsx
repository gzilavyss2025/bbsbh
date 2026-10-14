import { useState } from 'react'
import { motionIsReduced } from '../../../../hooks/preferences/motionIsReduced.js'

// The OVR stamp at the right end of the hero row, centred on the photo's height (#2009): an ink
// box, the number over "OVR", that opens and folds the ratings strip. A minor leaguer on the
// Top 100 also wears a paper POT tag above it.
// The press drop is read from motionIsReduced AT the tap (the old OvrTile rule): a reduced-motion
// reader gets no drop, and a page load never plays anything. `taps` keys the face so each tap
// presses again.
export function HeroStamp({ view, open, controls, onToggle }) {
  const [taps, setTaps] = useState(0)
  const pot = view.minor?.pot
  return (
    <div className="pnext-ovr__badge">
      {pot != null && <span className="pnext-ovr__pot">POT <span className="mono">{pot}</span></span>}
      <button
        type="button"
        className="pnext-ovr__stamp"
        aria-expanded={open}
        aria-controls={controls}
        aria-label={`OVR ${view.ovr}, ${view.tier.name} tier. ${open ? 'Fold' : 'Show'} the ratings.`}
        onClick={() => {
          onToggle()
          setTaps((n) => (motionIsReduced() ? 0 : n + 1))
        }}
      >
        <span key={taps} className={`pnext-ovr__face${taps ? ' is-pressed' : ''}`} aria-hidden="true">
          <span className="pnext-ovr__num mono">{view.ovr}</span>
          <span className="pnext-ovr__word">OVR</span>
        </span>
      </button>
    </div>
  )
}
