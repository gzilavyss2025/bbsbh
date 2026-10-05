import { memo, useEffect, useMemo, useRef } from 'react'
import { BAR_TOP, SCENE_H, SCENE_W, SLOW, pitcherStage, releasePoint, sceneFrame, stage } from '../../../lib/pitcherCard/scene.js'

const STAGE = stage()
const SEGMENTS = 40 // one per step of the model's path (scene.js N)
const f1 = (v) => v.toFixed(1)

// The behind-the-plate scene. It plays his pitches one at a time, by itself,
// in order of use: the pitch in flight draws a trail that thickens as the ball
// comes closer, then the ball; it holds at the plate, then the next pitch. His
// other pitches stay on as faint lines with an end ring. A navy bar names the
// pitch in flight and its speed. No controls, no tap targets.
//
// PERFORMANCE: one SVG, drawn by setting attributes through refs from a
// requestAnimationFrame loop — no React state per frame. The loop stops while
// the card is off screen (IntersectionObserver) and never starts under
// `prefers-reduced-motion: reduce`, where the first pitch shows at full length.
// `onActive(idx)` fires only when the pitch in flight changes.
//
// THE MATCHUP SCOUT'S EXTRAS (#1490, ADR-0099), all off by default, so the Now
// Pitching card draws exactly as before: `view` 'pitcher' draws from the
// centre-field camera on PitcherStage; `slow` is the slow-motion factor (1 =
// real speed); `zone` [bottom, top] ft draws a real pitch's own zone.
export const PitchScene = memo(function PitchScene({ pitches, lefty, name, onActive, view = 'hitter', slow = SLOW, zone }) {
  const ghostRefs = useRef([])
  const segRefs = useRef([])
  const ballRef = useRef(null)
  const seam1Ref = useRef(null)
  const seam2Ref = useRef(null)
  const barNameRef = useRef(null)
  const barMphRef = useRef(null)
  const sceneRef = useRef(null)

  useEffect(() => {
    let shownIdx = -1
    const draw = (elapsed) => {
      const { idx, progress } = sceneFrame(pitches, elapsed, slow)
      const p = pitches[idx]
      if (idx !== shownIdx) {
        shownIdx = idx
        ghostRefs.current.forEach((g, j) => g?.setAttribute('visibility', j === idx ? 'hidden' : 'visible'))
        segRefs.current.forEach((s) => s?.setAttribute('class', `stroke--${p.family}`))
        if (barNameRef.current) barNameRef.current.textContent = p.name
        if (barMphRef.current) barMphRef.current.textContent = `${p.mph} mph`
        onActive?.(idx)
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
      const [bx, by, px] = cur
      const r = px / 2
      ballRef.current?.setAttribute('cx', f1(bx))
      ballRef.current?.setAttribute('cy', f1(by))
      ballRef.current?.setAttribute('r', r.toFixed(2))
      const seam = (side) =>
        `M${f1(bx + side * r * 0.55)} ${f1(by - r * 0.75)} Q${f1(bx + side * r * 0.1)} ${f1(by)} ` +
        `${f1(bx + side * r * 0.55)} ${f1(by + r * 0.75)}`
      seam1Ref.current?.setAttribute('d', seam(-1))
      seam2Ref.current?.setAttribute('d', seam(1))
    }

    draw(null)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return undefined

    const t0 = performance.now()
    let raf = 0
    const tick = (ts) => {
      draw(Math.max(0, (ts - t0) / 1000))
      raf = requestAnimationFrame(tick)
    }
    const start = () => {
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    const io = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()))
    io.observe(sceneRef.current)
    return () => {
      stop()
      io.disconnect()
    }
  }, [pitches, onActive, slow])

  const [rx, ry] = pitches[0]?.pts[0] ?? releasePoint(lefty, view)
  const hitterStage = useMemo(() => (zone ? stage(zone) : STAGE), [zone])
  const { front: fr, back: bk } = hitterStage
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
      className="pscene"
      role="img"
      aria-label={`${view === 'pitcher' ? 'Centre-field' : 'Behind-the-plate'} drawing of ${name}’s pitches: ${pitches.map((p) => p.name).join(', ')}.`}
    >
      <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} aria-hidden="true" focusable="false">
        {view === 'pitcher' ? <PitcherStage zone={zone} /> : <>
        <rect className="pscene__sky" x="0" y="0" width={SCENE_W} height={SCENE_H} />
        <rect className="pscene__grass" x="0" y={f1(STAGE.horizon)} width={SCENE_W} height={SCENE_H} />
        <ellipse className="pscene__mound" cx={SCENE_W / 2} cy={f1(STAGE.mound.y)} rx={f1(STAGE.mound.rx)} ry="4" />
        <ellipse className="pscene__dirt" cx={SCENE_W / 2} cy={f1(STAGE.dirtCy)} rx="280" ry="180" />
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
              <polyline className={`stroke--${p.family}`} points={p.pts.map((q) => `${f1(q[0])},${f1(q[1])}`).join(' ')} />
              <circle className={`stroke--${p.family} pscene__ring`} cx={f1(end[0])} cy={f1(end[1])} r={f1(end[2] / 2)} />
            </g>
          )
        })}
        <g className="pscene__trail">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <line key={i} ref={(el) => {
                segRefs.current[i] = el
              }} visibility="hidden" />
          ))}
        </g>
        <circle className="pscene__release" cx={f1(rx)} cy={f1(ry)} r="2" />
        <circle ref={ballRef} className="pscene__ball" />
        <path ref={seam1Ref} className="pscene__seam" />
        <path ref={seam2Ref} className="pscene__seam" />
      </svg>
      <div className="pscene__bar" style={{ top: `${(BAR_TOP / SCENE_H) * 100}%` }}>
        <span ref={barNameRef} className="pscene__name" />
        <span ref={barMphRef} className="pscene__mph" />
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
