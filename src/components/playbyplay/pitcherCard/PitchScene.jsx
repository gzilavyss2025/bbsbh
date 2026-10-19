import { memo, useEffect, useMemo, useRef } from 'react'
import { drawContact, hideMarks, sceneLabel, swingScene } from '../../../lib/pitcherCard/contactDraw.js'
import { pitchBeats, replayFrame } from '../../../lib/pitcherCard/contactTimeline.js'
import { BAR_TOP, REPLAY_H, SCENE_H, SCENE_W, SLOW, pitcherStage, releasePoint, sceneFrame, stage } from '../../../lib/pitcherCard/scene.js'

const STAGE = stage()
const SEGMENTS = 40 // one per step of the model's path (scene.js N)
const f1 = (v) => v.toFixed(1)

// The behind-the-plate scene. It plays his pitches one at a time, by itself,
// in order of use: the pitch in flight draws a trail that thickens as the ball
// comes closer, then the ball; it holds at the plate, then the next pitch. His
// other pitches stay on as faint lines with an end ring. A navy bar names the
// pitch in flight and its speed. No controls, no tap targets. Every line, ring and
// trail is drawn in the pitch's own `color` (pitchTypes.js), the one its tile wears.
//
// PERFORMANCE: one SVG, drawn by setting attributes through refs from a
// requestAnimationFrame loop — no React state per frame. The loop stops while
// the card is off screen (IntersectionObserver), its clock with it, and never starts under
// `prefers-reduced-motion: reduce`, where the first pitch shows at full length.
// `onActive(idx)` fires only when the pitch in flight changes.
//
// THE MATCHUP SCOUT'S EXTRAS (#1490, ADR-0099), all off by default, so the Now
// Pitching card draws exactly as before: `view` 'pitcher' draws from the
// centre-field camera on PitcherStage; `slow` is the slow-motion factor (1 =
// real speed); `zone` [bottom, top] ft draws a real pitch's own zone.
//
// THE AT-BAT REPLAY'S (AtBatReplay.jsx), off by default too. `atBat` is the
// at-bat's pitch count: it plays the pitches through ONCE and rests, draws the
// projected plate ground in a taller frame (scene.js REPLAY_H), and puts the
// bar under the drawing with a second row, "Pitch N of M" and the call.
// `play` { no } plays that one pitch, then holds it while the others dim;
// `play` { all: true } plays the whole at-bat; a new object replays it. With no
// `play` the replay RESTS on its last pitch at full length, and does so for good
// under reduced motion (the reader steps with `play` { no }); play starts on a tap.
// `onLand(idx)` fires once when a pitch reaches the plate, `onActive(idx)` when
// one is released. The effect restarts once per pick, never per frame.
//
// THE CONTACT REPLAY (docs/contact-replay.md, #1771): in the `atBat` look the loop runs on the
// replay's own clock (contactTimeline.js `replayFrame`, in ms), and a swing pitch also draws the bat,
// the contact and the batted ball (contactDraw.js). Its ball stops at the contact point, not the plate,
// and `onLand` fires at contact. `onFrame(idx, tau, rest)` is a plain callback on EVERY draw: `tau` is ms
// on the pitch's slot, `rest` true for the rest frame (the end state, and all of reduced motion).
export const PitchScene = memo(function PitchScene({ pitches, lefty, name, onActive, onLand, onFrame, view = 'hitter', slow = SLOW, zone, atBat, play }) {
  const ghostRefs = useRef([])
  const segRefs = useRef([])
  const ballRef = useRef(null)
  const seam1Ref = useRef(null)
  const seam2Ref = useRef(null)
  const barNameRef = useRef(null)
  const barMphRef = useRef(null)
  const barStepRef = useRef(null)
  const barCallRef = useRef(null)
  const sceneRef = useRef(null)
  const mk = useRef({ smear: [], segs: [], ticks: [], parts: {} })

  useEffect(() => {
    let shownIdx = -1
    let landedIdx = -1
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // The at-bat replay rests on its last pitch until a tap plays it.
    const resting = atBat != null && (!play || (play.all && reduce))
    const picked = resting ? pitches.length - 1 : play?.no != null ? pitches.findIndex((q) => q.no === play.no) : -1
    const beatsList = atBat != null ? pitches.map((p) => pitchBeats(p, slow)) : null
    const scenes = []
    const draw = (elapsed) => {
      const rf = beatsList && replayFrame(beatsList, elapsed == null ? null : elapsed * 1000, picked >= 0 ? picked : undefined)
      const frame = rf || (picked >= 0 ? sceneFrame([pitches[picked]], elapsed, slow, true) : sceneFrame(pitches, elapsed, slow, false))
      const done = rf ? rf.done : frame.done
      const idx = rf ? rf.idx : picked >= 0 ? picked : frame.idx
      const p = pitches[idx]
      const sw = rf && (scenes[idx] ??= swingScene(p, beatsList[idx]))
      let { progress } = frame
      let ball
      if (sw) ({ progress, ball } = drawContact(mk.current, p, beatsList[idx], sw, rf.tau, slow, done))
      else if (rf) {
        hideMarks(mk.current)
        progress = Math.min(1, rf.tau / (p.T * slow * 1000))
      }
      if (idx !== shownIdx) {
        shownIdx = idx
        ghostRefs.current.forEach((g, j) => {
          g?.setAttribute('visibility', j === idx ? 'hidden' : 'visible')
          g?.classList.toggle('is-dim', picked >= 0)
        })
        segRefs.current.forEach((s) => s?.setAttribute('stroke', p.color))
        if (barNameRef.current) barNameRef.current.textContent = p.name
        if (barMphRef.current) barMphRef.current.textContent = `${p.mph} mph`
        if (barStepRef.current) barStepRef.current.textContent = `Pitch ${p.no} of ${atBat}`
        if (barCallRef.current) barCallRef.current.textContent = p.call || '—'
        if (rf) sceneRef.current?.setAttribute('aria-label', sceneLabel(p))
        onActive?.(idx)
      }
      if ((sw ? rf.tau >= beatsList[idx].contactMs : progress >= 1) && landedIdx !== idx) {
        landedIdx = idx
        onLand?.(idx)
      }
      const m = progress * SEGMENTS
      const whole = Math.floor(m)
      const pts = p.pts
      let cur = pts[SEGMENTS]
      if (whole < SEGMENTS) {
        const t = m - whole
        const a = pts[whole]
        const b = pts[whole + 1]
        cur = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
      }
      segRefs.current.forEach((seg, i) => {
        if (!seg) return
        if (i > whole || (i === whole && whole >= SEGMENTS)) {
          seg.setAttribute('visibility', 'hidden')
          return
        }
        const a = pts[i]
        const b = i < whole ? pts[i + 1] : cur
        seg.setAttribute('visibility', 'visible')
        seg.setAttribute('x1', f1(a[0]))
        seg.setAttribute('y1', f1(a[1]))
        seg.setAttribute('x2', f1(b[0]))
        seg.setAttribute('y2', f1(b[1]))
        seg.setAttribute('stroke-width', (b[2] * 0.62).toFixed(2))
        seg.setAttribute('opacity', i < whole ? (0.25 + 0.6 * (i / SEGMENTS)).toFixed(2) : '0.85')
      })
      const [bx, by, px] = ball ?? cur
      const r = Math.max(0.6, px / 2)
      if (rf) [ballRef, seam1Ref, seam2Ref].forEach((n) => n.current?.setAttribute('visibility', ball === null ? 'hidden' : 'visible'))
      ballRef.current?.setAttribute('cx', f1(bx))
      ballRef.current?.setAttribute('cy', f1(by))
      ballRef.current?.setAttribute('r', r.toFixed(2))
      const seam = (side) =>
        `M${f1(bx + side * r * 0.55)} ${f1(by - r * 0.75)} Q${f1(bx + side * r * 0.1)} ${f1(by)} ` +
        `${f1(bx + side * r * 0.55)} ${f1(by + r * 0.75)}`
      seam1Ref.current?.setAttribute('d', seam(-1))
      seam2Ref.current?.setAttribute('d', seam(1))
      onFrame?.(idx, rf ? rf.tau : (elapsed ?? 0) * 1000, elapsed == null || Boolean(done))
      return done
    }

    // The replay starts at release; the card shows its first pitch whole
    // until the clock runs (and for good under reduced motion).
    draw(atBat != null && !resting && !(reduce && picked >= 0) ? 0 : null)
    if (reduce || resting) return undefined

    // On-screen time only, so a replay scrolled into view starts at its first
    // pitch, not wherever the wall clock got to.
    let t0 = null
    let shown = 0
    let raf = 0
    const tick = (ts) => {
      t0 ??= ts - shown
      shown = ts - t0
      raf = draw(shown / 1000) ? 0 : requestAnimationFrame(tick)
    }
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
      t0 = null
    }
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()))
    io.observe(sceneRef.current)
    return () => {
      stop()
      io.disconnect()
    }
  }, [pitches, onActive, onLand, onFrame, slow, atBat, play])

  const [rx, ry] = pitches[0]?.pts[0] ?? releasePoint(lefty, view)
  const hitterStage = useMemo(() => (zone ? stage(zone) : STAGE), [zone])
  const { front: fr, back: bk } = hitterStage
  const replay = atBat != null
  const H = replay ? REPLAY_H : SCENE_H
  const edges = [
    [fr.x, fr.y, bk.x, bk.y],
    [fr.x + fr.w, fr.y, bk.x + bk.w, bk.y],
    [fr.x, fr.y + fr.h, bk.x, bk.y + bk.h],
    [fr.x + fr.w, fr.y + fr.h, bk.x + bk.w, bk.y + bk.h],
  ]
  const grid = [
    [fr.x + fr.w / 3, fr.y, fr.x + fr.w / 3, fr.y + fr.h],
    [fr.x + (2 * fr.w) / 3, fr.y, fr.x + (2 * fr.w) / 3, fr.y + fr.h],
    [fr.x, fr.y + fr.h / 3, fr.x + fr.w, fr.y + fr.h / 3],
    [fr.x, fr.y + (2 * fr.h) / 3, fr.x + fr.w, fr.y + (2 * fr.h) / 3],
  ]

  return (
    <div
      ref={sceneRef}
      className={replay ? 'pscene pscene--replay' : 'pscene'}
      role="img"
      aria-label={replay ? undefined : `${view === 'pitcher' ? 'Centre-field' : 'Behind-the-plate'} drawing of ${name}’s pitches: ${pitches.map((p) => p.name).join(', ')}.`}
    >
      <svg viewBox={`0 0 ${SCENE_W} ${H}`} aria-hidden="true" focusable="false">
        {view === 'pitcher' ? <PitcherStage zone={zone} /> : <>
        <rect className="pscene__sky" x="0" y="0" width={SCENE_W} height={H} />
        <rect className="pscene__grass" x="0" y={f1(STAGE.horizon)} width={SCENE_W} height={H} />
        <ellipse className="pscene__mound" cx={SCENE_W / 2} cy={f1(STAGE.mound.y)} rx={f1(STAGE.mound.rx)} ry="4" />
        {replay ? <>
          <polygon className="pscene__dirt" points={pts(hitterStage.dirt)} />
          {hitterStage.boxes.map((b, i) => <polygon key={`b${i}`} className="pscene__chalk" points={pts(b)} />)}
          <polygon className="pscene__plate" points={pts(hitterStage.plate)} />
          {hitterStage.drops.map(([a, b], i) => (
            <line key={`d${i}`} className="pscene__drop" x1={f1(a[0])} y1={f1(a[1])} x2={f1(b[0])} y2={f1(b[1])} />
          ))}
        </> : <ellipse className="pscene__dirt" cx={SCENE_W / 2} cy={f1(STAGE.dirtCy)} rx="280" ry="180" />}
        <rect className="pscene__back" x={f1(bk.x)} y={f1(bk.y)} width={f1(bk.w)} height={f1(bk.h)} />
        {edges.map(([x1, y1, x2, y2], i) => (
          <line key={`e${i}`} className="pscene__edge" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} />
        ))}
        <rect className="pscene__front" x={f1(fr.x)} y={f1(fr.y)} width={f1(fr.w)} height={f1(fr.h)} />
        {grid.map(([x1, y1, x2, y2], i) => (
          <line key={`g${i}`} className="pscene__grid" x1={f1(x1)} y1={f1(y1)} x2={f1(x2)} y2={f1(y2)} />
        ))}
        </>}
        {pitches.map((p, j) => {
          const end = p.pts[p.pts.length - 1]
          return (
            <g key={p.code} ref={(el) => {
                ghostRefs.current[j] = el
              }} className="pscene__ghost">
              <polyline stroke={p.color} points={p.pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' ')} />
              <circle className="pscene__ring" stroke={p.color} cx={f1(end[0])} cy={f1(end[1])} r={f1(end[2] / 2)} />
            </g>
          )
        })}
        {replay && <>
          {[0, 1, 2, 3].map((i) => <polygon key={i} ref={(el) => { mk.current.smear[i] = el }} className="pscene__bat" visibility="hidden" />)}
          <polyline ref={(el) => { mk.current.arc = el }} className="pscene__arc" visibility="hidden" />
        </>}
        <g className="pscene__trail">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <line key={i} ref={(el) => {
                segRefs.current[i] = el
              }} visibility="hidden" />
          ))}
        </g>
        {replay && <>
          <polyline ref={(el) => { mk.current.track = el }} className="pscene__track" visibility="hidden" />
          <ellipse ref={(el) => { mk.current.shadow = el }} className="pscene__shadow" visibility="hidden" />
          <line ref={(el) => { mk.current.drop = el }} className="pscene__dropline" visibility="hidden" />
          <g className="pscene__exit">
            {Array.from({ length: 24 }, (_, i) => <line key={i} ref={(el) => { mk.current.segs[i] = el }} visibility="hidden" />)}
          </g>
          <polyline ref={(el) => { mk.current.line = el }} className="pscene__exitline" visibility="hidden" />
          <polygon ref={(el) => { mk.current.bat = el }} className="pscene__bat" visibility="hidden" />
          <circle ref={(el) => { mk.current.cap = el }} className="pscene__bat" visibility="hidden" />
        </>}
        <circle className="pscene__release" cx={f1(rx)} cy={f1(ry)} r="2" />
        <circle ref={ballRef} className="pscene__ball" />
        <path ref={seam1Ref} className="pscene__seam" />
        <path ref={seam2Ref} className="pscene__seam" />
        {replay && <>
          <circle ref={(el) => { mk.current.ring = el }} className="pscene__flash" visibility="hidden" />
          {Array.from({ length: 8 }, (_, i) => <line key={i} ref={(el) => { mk.current.ticks[i] = el }} className="pscene__tick" visibility="hidden" />)}
          <circle ref={(el) => { mk.current.mitt = el }} className="pscene__mitt" visibility="hidden" />
          <g ref={(el) => { mk.current.tag = el }} className="pscene__tag" visibility="hidden">
            <rect ref={(el) => { mk.current.parts.rect = el }} y="6" height="15" rx="2" />
            <text ref={(el) => { mk.current.parts.text = el }} y="17" textAnchor="end" />
          </g>
          <text className="pscene__honest" x="8" y={H - 6}>SWING DRAWN · PATHS MEASURED</text>
        </>}
      </svg>
      <div className="pscene__bar" style={replay ? undefined : { top: `${(BAR_TOP / SCENE_H) * 100}%` }}>
        <span ref={barNameRef} className="pscene__name" />
        <span ref={barMphRef} className="pscene__mph" />
        {replay && <>
          <span ref={barStepRef} className="pscene__step" />
          <span ref={barCallRef} className="pscene__call" />
        </>}
      </div>
    </div>
  )
})

const pts = (list) => list.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ')

// The Pitcher's view: the card's stage seen from centre field (scene.js
// `pitcherStage`). Projected: the plate dirt, the batter's boxes, the plate
// and the zone box. Placed: the mound and rubber at the foot of the frame
// (ADR-0099). Same classes and tokens as the card's stage.
function PitcherStage({ zone }) {
  const s = useMemo(() => pitcherStage(zone), [zone])
  const line = ([a, b], key, className) => (
    <line key={key} className={className} x1={f1(a[0])} y1={f1(a[1])} x2={f1(b[0])} y2={f1(b[1])} />
  )
  return (
    <>
      <rect className="pscene__grass" x="0" y="0" width={SCENE_W} height={SCENE_H} />
      <polygon className="pscene__dirt" points={pts(s.dirt)} />
      {s.boxes.map((b, i) => <polygon key={`b${i}`} className="pscene__chalk" points={pts(b)} />)}
      <polygon className="pscene__plate" points={pts(s.plate)} />
      <polygon className="pscene__back" points={pts(s.back)} />
      {s.edges.map((e, i) => line(e, `e${i}`, 'pscene__edge'))}
      <polygon className="pscene__front" points={pts(s.front)} />
      {s.grid.map((g, i) => line(g, `g${i}`, 'pscene__grid'))}
      <ellipse className="pscene__mound" cx={s.mound.cx} cy={s.mound.cy} rx={s.mound.rx} ry={s.mound.ry} />
      <rect className="pscene__rubber" x={s.rubber.x} y={s.rubber.y} width={s.rubber.w} height={s.rubber.h} />
    </>
  )
}
