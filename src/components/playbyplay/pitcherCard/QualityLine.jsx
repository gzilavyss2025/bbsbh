import { useEffect, useMemo, useRef } from 'react'
import { clamp } from '../../../lib/math/number.js'
import { easeStamp } from '../../../lib/motion/curves.js'
import { pitchBeats } from '../../../lib/pitcherCard/contactTimeline.js'
import { SLOW } from '../../../lib/pitcherCard/scene.js'

// THE QUALITY LINE (docs/contact-replay.md §7.2), phase A: the exit velocity of a ball in play, and
// nothing for a whiff, a foul or a take. No waiting figures (§10). Plain text in the DOM, in reading
// order, complete in the rest frame and with no live region (§12). It draws through refs from the
// replay's one clock, like SideView; its min-height keeps the space on every pitch (ADR-0046).
export function QualityLine({ pitches, drawers }) {
  const fig = useRef(null)
  const num = useRef(null)
  const label = useRef(null)
  const beats = useMemo(() => pitches.map((p) => pitchBeats(p, SLOW)), [pitches])

  useEffect(() => {
    let shown = -1
    const draw = (idx, tau, rest) => {
      if (idx !== shown) {
        shown = idx
        const ev = pitches[idx].swing === 'inplay' ? pitches[idx].hit?.exitVelo : null
        num.current.textContent = ev == null ? '' : ev.toFixed(1)
        label.current.textContent = ev == null ? '' : 'mph off the bat'
      }
      const e = easeStamp(rest ? 1 : clamp((tau - beats[idx].figsStartMs) / 220, 0, 1))
      fig.current.style.opacity = e.toFixed(3)
      fig.current.style.transform = `translateY(${(4 * (1 - e)).toFixed(1)}px)`
    }
    const set = drawers.current
    set.add(draw)
    return () => set.delete(draw)
  }, [pitches, beats, drawers])

  return (
    <div className="pqual">
      <div ref={fig} className="pqual__fig">
        <b ref={num} className="pqual__num" />
        <span ref={label} className="pqual__label" />
      </div>
    </div>
  )
}
