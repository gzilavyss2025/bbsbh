import { useLayoutEffect, useMemo, useRef } from 'react'
import { Cluster } from '../../ui/layout/Cluster.jsx'
import { clamp } from '../../../lib/math/number.js'
import { easeStamp } from '../../../lib/motion/curves.js'
import { pitchBeats } from '../../../lib/pitcherCard/contactTimeline.js'
import { qualityFigures } from '../../../lib/pitcherCard/quality.js'
import { SLOW } from '../../../lib/pitcherCard/scene.js'

const STEP_MS = 55 // --stagger-step: the figures rise one after another
const STAMP_MS = 380 // --dur-stamp-in

// THE QUALITY LINE (docs/contact-replay.md §7.2): the figures for the pitch in view, then its verdict
// stamp. `at` is ReplayScene's pitch in view (state, twice a pitch), `bat` the Savant tracking by
// playId (undefined entries mean "waiting"), `mlb` false for a MiLB game (exit velocity only, §10).
// The text is React's, so data arriving re-renders the rest frame and nothing else; the fade-in
// draws through refs from the replay's one clock, like SideView. Plain text in the DOM, in reading
// order, no live region (§12). Its min-height keeps the space on every pitch (ADR-0046).
export function QualityLine({ pitches, drawers, at, bat, mlb, eventType }) {
  const row = useRef(null)
  const stamp = useRef(null)
  const idx = at ? Math.max(0, pitches.findIndex((p) => p.no === at.no)) : pitches.length - 1 // the replay rests on its last pitch
  const { figs, verdict } = useMemo(
    () => qualityFigures(pitches[idx], bat?.get(pitches[idx].playId), { eventType, mlb }),
    [pitches, idx, bat, eventType, mlb],
  )
  const beats = useMemo(() => pitches.map((p) => pitchBeats(p, SLOW, figs.length)), [pitches, figs.length])
  const frame = useRef([idx, 0, true]) // the last frame drawn, redrawn when the text changes

  useLayoutEffect(() => { // before paint: new figures never show one frame at full opacity
    const draw = (i, tau, rest) => {
      frame.current = [i, tau, rest]
      const b = beats[i]
      const e = (from) => easeStamp(rest ? 1 : clamp((tau - from) / 220, 0, 1))
      ;[...row.current.children].forEach((el, k) => {
        const o = e((b.figsStartMs ?? 0) + k * STEP_MS)
        el.style.opacity = o.toFixed(3)
        el.style.transform = `translateY(${(4 * (1 - o)).toFixed(1)}px)`
      })
      if (stamp.current) {
        const o = easeStamp(rest ? 1 : clamp((tau - (b.verdictMs ?? 0)) / STAMP_MS, 0, 1))
        stamp.current.style.opacity = o.toFixed(3)
        stamp.current.style.transform = `rotate(${(-3 - 4 * (1 - o)).toFixed(1)}deg) scale(${(1 + 0.18 * (1 - o)).toFixed(3)})`
      }
    }
    draw(...frame.current)
    const set = drawers.current
    set.add(draw)
    return () => set.delete(draw)
  }, [beats, figs, verdict, drawers])

  return (
    <Cluster className="pqual" gap="base" rowGap="tight">
      <Cluster ref={row} gap="base" rowGap="tight">
        {figs.map((f) => (
          <div key={f.label} className={f.wait ? 'pqual__fig pqual__fig--wait' : 'pqual__fig'}>
            <b className="pqual__num">{f.num}</b>
            <span className="pqual__label">{f.label}</span>
          </div>
        ))}
      </Cluster>
      {verdict && <span ref={stamp} className={`pqual__stamp pqual__stamp--${verdict === 'Hard-luck out' ? 'out' : 'good'}`}>{verdict}</span>}
    </Cluster>
  )
}
