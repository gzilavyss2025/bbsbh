import { useEffect, useMemo, useRef } from 'react'
import { SIDE_X } from '../../../lib/pitcherCard/batted.js'
import { apexLabel, distanceLabel, sideLabel, sidePathFor } from '../../../lib/pitcherCard/contactDraw.js'
import { pitchBeats } from '../../../lib/pitcherCard/contactTimeline.js'
import { SLOW } from '../../../lib/pitcherCard/scene.js'
import { clamp } from '../../../lib/math/number.js'
import { easeOut } from '../../../lib/motion/curves.js'

// THE SIDE VIEW (docs/contact-replay.md §7.1): the batted ball seen from the first-base side, one fixed
// scale for every at-bat (0 to 450 ft over 304 units, never rescaled). It draws through refs, from the
// replay's one clock: AtBatReplay hands `drawers` to PitchScene's `onFrame`, and this adds its draw
// function there. No React state per frame. The flight is the fitted model, so its apex is pencil.
const f1 = (v) => v.toFixed(1)
const q01 = (v) => clamp(v, 0, 1)
const TRACE_STEPS = 60
const EMPTY = { whiff: 'NO CONTACT', foul: 'FOUL · NO FLIGHT DRAWN', inplay: 'NO TRACKING FOR THIS BALL' }

export function SideView({ pitches, drawers }) {
  const n = useRef({})
  const sides = useMemo(() => pitches.map((p) => { const beats = pitchBeats(p, SLOW); return { beats, path: sidePathFor(p, beats) } }), [pitches])

  useEffect(() => {
    const r = n.current
    const vis = (node, on) => node.setAttribute('visibility', on ? 'visible' : 'hidden')
    const marks = [r.trace, r.ball, r.ring, r.ring2, r.sel, r.dist, r.apex]
    let shown = -1
    const draw = (idx, tau, rest) => {
      const p = pitches[idx]
      const { beats, path } = sides[idx]
      if (idx !== shown) {
        shown = idx
        r.root.setAttribute('aria-label', sideLabel(p, path))
        r.empty.textContent = p.swing ? EMPTY[p.swing] : ''
      }
      vis(r.tick400, true)
      if (!path) {
        marks.forEach((m) => vis(m, false))
        vis(r.empty, rest || tau >= (beats.sceneEndMs ?? 0)) // no contact point, no scene end: say so at once
        return
      }
      vis(r.empty, false)
      const { sideStartMs: start, sideMs: ms } = beats
      if (!rest && tau < start) {
        marks.forEach((m) => vis(m, false))
        return
      }
      const u = rest ? 1 : q01((tau - start) / ms)
      const tF = u * path.T
      let d = ''
      for (let i = 0; i <= TRACE_STEPS; i++) {
        const [x, y] = path.pos((tF * i) / TRACE_STEPS)
        d += `${i ? 'L' : 'M'}${f1(x)} ${f1(y)}`
      }
      const [cx, cy] = path.pos(tF)
      r.trace.setAttribute('d', d)
      const since = rest ? Infinity : tau - (start + ms)
      r.trace.setAttribute('opacity', since > 0 ? (1 - 0.4 * q01(since / 1400)).toFixed(2) : 1)
      vis(r.trace, true)
      const { apex } = path
      if (apex && p.hit.launchAngle >= 8 && cx >= apex.x) {
        const lab = apexLabel(apex.x, apex.y, apex.ft)
        r.apexTick.setAttribute('x1', f1(apex.x))
        r.apexTick.setAttribute('x2', f1(apex.x))
        r.apexTick.setAttribute('y1', f1(apex.y + 3))
        r.apexText.setAttribute('x', f1(lab.x))
        r.apexText.setAttribute('y', f1(lab.y))
        r.apexText.setAttribute('text-anchor', lab.anchor)
        r.apexText.textContent = lab.text
        vis(r.apex, true)
      } else vis(r.apex, false)
      r.ball.setAttribute('cx', f1(cx))
      r.ball.setAttribute('cy', f1(cy))
      vis(r.ball, !rest && u < 1)
      if (since < 0) {
        ;[r.ring, r.ring2, r.sel, r.dist].forEach((m) => vis(m, false))
        return
      }
      // The Contact card's landing: a ring from 3 to 15 over 900 ms, a home run's second ring from 3 to 25
      // 140 ms later over 1100 ms, then the resting circle (radius 4.5).
      const ft = p.hit.distance ?? ((path.pos(path.T)[0] - 16) * 450) / 304
      const lx = SIDE_X(ft)
      const t = Number.isFinite(since) ? since : 5000
      const l1 = q01(t / 900)
      const l2 = q01((t - 140) / 1100)
      const put = (node, r_, op) => {
        node.setAttribute('cx', f1(lx))
        node.setAttribute('cy', 80)
        node.setAttribute('r', f1(r_))
        node.setAttribute('opacity', op.toFixed(2))
        vis(node, true)
      }
      put(r.ring, 3 + l1 * 12, t < 900 ? 0.9 * (1 - l1) : 0)
      put(r.ring2, 3 + l2 * 22, p.hr && t > 140 && t < 1240 ? 0.7 * (1 - l2) : 0)
      put(r.sel, 4.5 * (1 + 0.6 * (1 - easeOut(q01(t / 260)))), Math.min(1, t / 160))
      const dl = distanceLabel(ft)
      r.dist.setAttribute('x', f1(dl.x))
      r.dist.setAttribute('y', dl.y)
      r.dist.setAttribute('text-anchor', dl.anchor)
      r.dist.setAttribute('opacity', Math.min(1, t / 220).toFixed(2))
      r.dist.textContent = dl.text
      vis(r.dist, true)
      vis(r.tick400, !dl.hideTick400)
    }
    const set = drawers.current
    set.add(draw)
    return () => set.delete(draw)
  }, [pitches, sides, drawers])

  return (
    <svg ref={(el) => { n.current.root = el }} className="pside" viewBox="0 -30 336 130" role="img">
      <text className="pside__title" x="8" y="-17">SIDE VIEW · GREEN POST IS THE FENCE</text>
      <line className="pside__ground" x1="8" y1="80" x2="328" y2="80" />
      {[100, 200, 300, 400].map((ft) => <line key={ft} className="pside__tick" x1={f1(SIDE_X(ft))} y1="80" x2={f1(SIDE_X(ft))} y2="84" />)}
      {[200, 400].map((ft) => <text key={ft} ref={ft === 400 ? (el) => { n.current.tick400 = el } : undefined} className="pside__axis" x={f1(SIDE_X(ft))} y="96" textAnchor="middle">{ft} ft</text>)}
      <line className="pside__fence" x1={f1(SIDE_X(400))} y1={f1(80 - (10 * 304) / 450)} x2={f1(SIDE_X(400))} y2="80" />
      <rect className="pside__plate" x="13" y="79" width="6" height="2" />
      <path ref={(el) => { n.current.trace = el }} className="pside__trace" visibility="hidden" />
      <g ref={(el) => { n.current.apex = el }} visibility="hidden">
        <line ref={(el) => { n.current.apexTick = el }} className="pside__drop" />
        <text ref={(el) => { n.current.apexText = el }} className="pside__axis" />
      </g>
      <circle ref={(el) => { n.current.ball = el }} className="pside__ball" r="2.6" visibility="hidden" />
      <circle ref={(el) => { n.current.ring = el }} className="pside__ring" visibility="hidden" />
      <circle ref={(el) => { n.current.ring2 = el }} className="pside__ring pside__ring--thin" visibility="hidden" />
      <circle ref={(el) => { n.current.sel = el }} className="pside__ring" visibility="hidden" />
      <text ref={(el) => { n.current.dist = el }} className="pside__dist" visibility="hidden" />
      <text ref={(el) => { n.current.empty = el }} className="pside__empty" x="168" y="50" textAnchor="middle" visibility="hidden" />
    </svg>
  )
}
