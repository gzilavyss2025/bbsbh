import { useEffect, useState } from 'react'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { LEAD_MS, SETTLE_MS } from './contactFlight.js'

// The clock of one flight (#2073): ms since the tap, from rAF, at most 50ms a frame (a
// background tab does not jump the ball to the end). `shot` changes on every tap, so a
// second tap on the same ball flies it again. Reduced motion, or no ball: Infinity, the
// settled frame, and no loop.
export function useFlightClock(shot, model) {
  const [clock, setClock] = useState({ shot: -1, t: Infinity })
  const reduced = motionIsReduced()
  useEffect(() => {
    if (!model || reduced) return undefined
    const end = LEAD_MS + model.ms + SETTLE_MS
    let t = 0
    let last = performance.now()
    let id = requestAnimationFrame(function tick(now) {
      t += Math.min(50, now - last)
      last = now
      setClock({ shot, t })
      if (t < end) id = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(id)
  }, [shot, model, reduced])
  if (!model || reduced) return Infinity
  // Until the first frame of a new shot, the flight is at its start, not at the last
  // ball's end (no one-frame flash of the landed state).
  return clock.shot === shot ? clock.t : 0
}

// The marks of the flight, drawn over the dots. Decoration: the dot and the panel carry
// the meaning, so the group is hidden from assistive tech and takes no taps.
export function FlightMarks({ frame, home }) {
  const f = frame
  return (
    <g className="fcontact__fx" aria-hidden="true">
      <circle className="fcontact__fx-pulse" cx={home.x} cy={home.y} r={f.pulse.r} opacity={f.pulse.op} />
      <path className="fcontact__fx-track" d={f.track.d} opacity={f.track.op} />
      {f.trace.d && <path className="fcontact__fx-trace" d={f.trace.d} opacity={f.trace.op} />}
      {f.ring && <circle className="fcontact__fx-ring" cx={f.ring.x} cy={f.ring.y} r={f.ring.r} opacity={f.ring.op} />}
      {f.ring2 && <circle className="fcontact__fx-ring2" cx={f.ring2.x} cy={f.ring2.y} r={f.ring2.r} opacity={f.ring2.op} />}
      {f.shadow && <ellipse className="fcontact__fx-shadow" cx={f.shadow.x} cy={f.shadow.y} rx={f.shadow.rx} ry={f.shadow.ry} opacity={f.shadow.op} />}
      {f.drop && <path className="fcontact__fx-drop" d={f.drop.d} opacity={f.drop.op} />}
      {f.ball && <circle className="fcontact__fx-ball" cx={f.ball.x} cy={f.ball.y} r={f.ball.r} />}
      {f.sel && <circle className="fcontact__fx-sel" cx={f.sel.x} cy={f.sel.y} r={f.sel.r} opacity={f.sel.op} />}
    </g>
  )
}
