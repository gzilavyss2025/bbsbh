import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../../../../components/ui/control/Button.jsx'
import { motionIsReduced } from '../../../../../hooks/preferences/motionIsReduced.js'
import { CAMERAS, ZONE, orbitOf, towardOf, tunnelView, verdictOf } from './flightView.js'
import {
  KEY_TURN, dragTurn, flyStep, isDragStart, isPlainKey, landedLoop, needsFrame, seekLoop, setPlayingLoop, startLoop, stepLoop, stillCam, swingCam, turnView,
} from './flightMotion.js'
import { flightPalette, paintFlight } from './flightPaint.js'
import { PitchGlyph } from './PitchGlyph.jsx'

const SPEEDS = [[1, '1×', 'real speed'], [1 / 3, '⅓×', 'one-third speed'], [1 / 4, '¼×', 'one-quarter speed']]
const inches = (v, d = 1) => `${Math.abs(v).toFixed(d)} in`
const MID = (ZONE.y0 + ZONE.y1) / 2
// A missing figure is a dash with no unit.
const mph = (v) => (v == null ? '—' : `${v.toFixed(1)} mph`)
const rpm = (v) => (v == null ? '—' : `${v.toLocaleString('en-US')} rpm`)

// Writes a DOM property of a ref's element without React: the scrubber and the clock move every frame.
// A field the reader has focus on is left alone.
function setProp(ref, key, value, keepFocus = false) {
  const el = ref.current
  if (el && !(keepFocus && document.activeElement === el)) el[key] = value
}

// Backs the canvas with up to 2 device pixels a CSS pixel and records its CSS size in `box`.
// False while the canvas has no width (hidden), when there is nothing to paint.
function sizeCanvas(cv, box) {
  const r = cv.getBoundingClientRect()
  if (r.width < 2) return false
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  box.W = r.width
  box.H = r.height
  cv.width = Math.round(r.width * dpr)
  cv.height = Math.round(r.height * dpr)
  return true
}

// The flight loop (#2073, board PitchFlight.dc.html): a wait at release, the flight, a hold on the landed
// frame, then again (flightMotion.js), painted on a canvas (flightPaint.js). Each frame paints the canvas and
// writes the scrubber and the clock; React renders only when the Play button's word changes.
// It runs only while the stage is on screen or within 120px of it.
// A reader who asked for less motion gets the landed frame, a camera that snaps, and the scrubber.
// `stage` is the ref of the element it watches; `canvas`, `scrub` and `clock` are the refs it paints, moves and writes. `onCycle` runs when a hold ends: the card moves to the next pitch there.
// `scene`: { items, done, ghost, num } for paintFlight.
function useFlightLoop({ stage, canvas, scrub, clock, end, speed, reduced, onCycle, scene }) {
  const [snap, setSnap] = useState(() => ({
    loop: reduced ? landedLoop() : startLoop(true),
    cam: stillCam(orbitOf('catcher')),
  }))
  // The engine's state for the frame loop and the handlers; `snap` is the same state for the render.
  const eng = useRef(snap)
  const cfg = useRef({ end, speed, onCycle, scene })
  const landT = useRef(new Map())
  const box = useRef({ W: 0, H: 0, pal: null })
  useEffect(() => {
    cfg.current = { end, speed, onCycle, scene }
  })
  // Starts the frame loop if it is idle; the effect below sets it.
  const wake = useRef(null)
  const put = (next) => {
    eng.current = next
    setSnap(next)
    wake.current?.()
  }

  // Paint the frame as the engine holds it. Reads refs only, so every effect can call it.
  const paint = useCallback((now) => {
    const cv = canvas.current
    const b = box.current
    if (!cv || !b.W) return
    b.pal ??= flightPalette(cv)
    const { end: e, scene: sc } = cfg.current
    const { loop, cam } = eng.current
    const s = Math.min(loop.s, e)
    const ctx = cv.getContext('2d')
    ctx.setTransform(cv.width / b.W, 0, 0, cv.height / b.H, 0, 0)
    paintFlight(ctx, { W: b.W, H: b.H, pal: b.pal, view: cam.view, s, now, landT: landT.current, ...sc })
    setProp(scrub, 'value', String(Math.round((s / e) * 1000)), true)
    setProp(clock, 'textContent', `${s.toFixed(2)} s`)
  }, [])

  // After each render (a pick, a mode, a pause, a drag): paint once.
  useEffect(() => {
    paint(performance.now() / 1000)
  })

  // The canvas backs its CSS size at up to 2 device pixels a pixel.
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return undefined
    const fit = () => {
      if (sizeCanvas(cv, box.current)) paint(performance.now() / 1000)
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(fit)
    ro.observe(cv)
    return () => ro.disconnect()
  }, [canvas, paint])

  useEffect(() => {
    wake.current = null
    if (reduced) {
      // A live switch to reduced motion: the landed frame, and the camera where it was going.
      const { loop, cam } = eng.current
      if (loop.playing || cam.tw < 1) put({ loop: landedLoop(), cam: stillCam(cam.to) })
      return undefined
    }
    let vis = true
    const node = stage.current
    const io =
      node && typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver((es) => {
            vis = es.some((e) => e.isIntersecting)
            wake.current?.()
          }, { rootMargin: '120px' })
        : null
    if (io) io.observe(node)
    let raf = 0
    let last = 0
    const frame = (now) => {
      raf = 0
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const cur = eng.current
      const { end: e, speed: v, onCycle: cycle, scene: sc } = cfg.current
      const next = { loop: stepLoop(cur.loop, dt, e, v), cam: flyStep(cur.cam, dt) }
      eng.current = next
      const L = next.loop
      if (L.phase === 'pre') landT.current.clear()
      for (const it of sc.items) if (L.prevS < it.path.T && L.s >= it.path.T) landT.current.set(it.code, now / 1000)
      // React renders only when the Play button's word changes.
      if (L.phase !== cur.loop.phase || L.playing !== cur.loop.playing) setSnap(next)
      if (L.cycled) cycle()
      paint(now / 1000)
      if (needsFrame(vis, next.loop, next.cam)) raf = requestAnimationFrame(frame)
    }
    // Frames run only while there is something to move (needsFrame); anything that changes that calls this.
    wake.current = () => {
      if (raf || !needsFrame(vis, eng.current.loop, eng.current.cam)) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    }
    wake.current()
    return () => {
      wake.current = null
      cancelAnimationFrame(raf)
      if (io) io.disconnect()
    }
  }, [reduced, stage, paint])

  const { loop } = snap
  return {
    phase: loop.phase,
    playing: loop.playing,
    restart: () => {
      landT.current.clear()
      put({ ...eng.current, loop: reduced ? landedLoop() : startLoop(true) })
    },
    setPlaying: (on) => put({ ...eng.current, loop: setPlayingLoop(eng.current.loop, on) }),
    seek: (s) => {
      landT.current.clear()
      put({ ...eng.current, loop: seekLoop(eng.current.loop, s) })
    },
    turn: (yaw, pitch) => put({ ...eng.current, cam: turnView(eng.current.cam, yaw, pitch) }),
    flyTo: (key) => {
      const to = orbitOf(key)
      put({ ...eng.current, cam: reduced ? stillCam(to) : swingCam(eng.current.cam, to) })
    },
  }
}

// The Pitch flight card (#1892, board PitchFlight.dc.html): each pitch type's average path from the mound,
// one at a time or all together, from one of four cameras. `rows` are arsenal rows; only those with a path fly.
export function FlightCard({ rows, season, throws }) {
  const flyers = useMemo(() => rows.filter((r) => r.path), [rows])
  const reduced = motionIsReduced()
  const [mode, setMode] = useState('seq')
  const [i, setI] = useState(0)
  const [on, setOn] = useState(() => new Set(flyers.map((r) => r.code)))
  const [camera, setCamera] = useState('catcher')
  const [speed, setSpeed] = useState(1 / 3)
  const [ghost, setGhost] = useState(true)
  const seq = mode === 'seq'
  const shown = seq ? [flyers[i]] : flyers.filter((r) => on.has(r.code))
  const end = Math.max(0.01, ...shown.map((r) => r.path.T))
  const stage = useRef(null)
  const canvas = useRef(null)
  const scrub = useRef(null)
  const clock = useRef(null)
  const fly = useFlightLoop({
    stage,
    canvas,
    scrub,
    clock,
    end,
    speed,
    reduced,
    // In order, the earlier pitches of the round stay on as faint numbered trails.
    scene: { items: shown, done: seq ? flyers.slice(0, i) : [], ghost: seq && ghost, num: seq ? i + 1 : null },
    // A hold ended: In order moves to the next pitch. The loop has already started over.
    onCycle: () => {
      if (seq && flyers.length > 1) setI((n) => (n + 1) % flyers.length)
    },
  })
  const { playing } = fly
  const p = seq ? flyers[i] : null
  const tunnel = seq ? null : tunnelView(shown)
  // Drag or the arrow keys turn the view (the board's orbit). The loop plays on; no camera preset is pressed after.
  const drag = useRef(null)
  const [dragging, setDragging] = useState(false)
  const turn = (yaw, pitch) => {
    fly.turn(yaw, pitch)
    setCamera('')
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }
  const label = seq
    ? `${p.code} · ${mph(p.velo)} · ${p.path.T.toFixed(2)} s`
    : shown.length ? `${shown.map((r) => r.code).join(' · ')} · together` : 'No pitch selected'
  const left = rows.length - flyers.length
  return (
    <div className="flight">
      <div className="flight__label">
        <b>Pitch flight</b>
        <em>{label}</em>
      </div>
      <div className="flight__row" role="group" aria-label="Show">
        <button type="button" className="pnext-pick" aria-pressed={seq} onClick={() => { setMode('seq'); fly.restart() }}>In order</button>
        <button type="button" className="pnext-pick" aria-pressed={!seq} onClick={() => { setMode('tog'); fly.restart() }}>Together</button>
      </div>
      <div className="flight__row" role="group" aria-label="Pitches">
        {flyers.map((r, n) => (
          <Button
            key={r.code}
            size="control"
            pressed={seq ? n === i : on.has(r.code)}
            aria-label={r.velo == null ? r.mark.name : `${r.mark.name}, ${mph(r.velo)}`}
            onClick={() => {
              if (!seq) {
                setOn((cur) => new Set(cur.has(r.code) ? [...cur].filter((c) => c !== r.code) : [...cur, r.code]))
                return fly.restart()
              }
              setI(n)
              fly.restart()
            }}
          >
            <PitchGlyph mark={r.mark} size={14} />
            {r.code}
          </Button>
        ))}
      </div>
      <div className="flight__row" role="group" aria-label="Camera">
        {CAMERAS.map(([key, name]) => (
          <button key={key} type="button" className="pnext-pick" aria-pressed={camera === key} onClick={() => { setCamera(key); fly.flyTo(key) }}>{name}</button>
        ))}
        <span className="flight__hint" aria-hidden="true">Drag to rotate</span>
      </div>
      <div
        className={`flight__stage flight__turn${dragging ? ' flight__turn--drag' : ''}`}
        ref={stage}
        tabIndex={0}
        role="group"
        aria-label="Pitch flight view. Drag, or use the arrow keys, to turn it."
        onPointerDown={(e) => {
          if (!isDragStart(e)) return
          drag.current = { x: e.clientX, y: e.clientY }
          setDragging(true)
          try {
            e.currentTarget.setPointerCapture(e.pointerId)
          } catch {
            // An old browser without pointer capture still drags while the pointer stays on the stage.
          }
        }}
        onPointerMove={(e) => {
          const at = drag.current
          if (!at) return
          turn(...dragTurn(e.clientX - at.x, e.clientY - at.y))
          drag.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          const m = KEY_TURN[e.key]
          if (!m || !isPlainKey(e)) return
          e.preventDefault()
          turn(m[0], m[1])
        }}
      >
        <canvas
          ref={canvas}
          className="flight__canvas"
          role="img"
          aria-label="The pitches from the mound to the plate, seen from the chosen camera"
        />
      </div>
      <div className="flight__bar">
        {!reduced && <Button size="control" onClick={() => fly.setPlaying(!playing)}>{playing ? 'Pause' : 'Play'}</Button>}
        <input
          ref={scrub}
          className="flight__range"
          type="range"
          min="0"
          max="1000"
          aria-label="Time since release"
          defaultValue="0"
          onChange={(e) => fly.seek((e.target.value / 1000) * end)}
        />
        <output ref={clock} className="flight__clock" />
      </div>
      <div className="flight__bar">
        {seq && <button type="button" className="pnext-pick" aria-pressed={ghost} onClick={() => setGhost(!ghost)}>Gravity path</button>}
        <div className="flight__row" role="group" aria-label="Speed">
          {SPEEDS.map(([v, name]) => (
            <button key={name} type="button" className="pnext-pick" aria-pressed={speed === v} onClick={() => setSpeed(v)}>{name}</button>
          ))}
        </div>
      </div>
      {seq ? <Sequence p={p} throws={throws} /> : <Together t={tunnel} />}
      <p className="flight__note">
        Each path uses his average release point, speed and movement from {rows.reduce((n, r) => n + r.pitches, 0).toLocaleString('en-US')}{' '}
        pitches in {season} regular-season games. Shown at {SPEEDS.find(([v]) => v === speed)[2]}.
        {left > 0 && ` ${left} ${left === 1 ? 'type has' : 'types have'} too few tracked pitches to fly.`}
      </p>
    </div>
  )
}

const Fact = ({ name, value, note }) => (
  <div className="flight__fact">
    <b>{name}</b>
    <em>{value}</em>
    {note && <small>{note}</small>}
  </div>
)

function Sequence({ p, throws }) {
  const { path, landing } = p
  const dx = landing ? landing.x * 12 : null
  const dy = landing ? (landing.h - MID) * 12 : null
  const inZone = landing && Math.abs(landing.x) <= ZONE.x && landing.h >= ZONE.y0 && landing.h <= ZONE.y1
  return (
    <div className="flight__info">
      <p className="flight__ask">{p.mark.name}</p>
      <p className="flight__note">{verdictOf(path, throws)} Thrown {p.pct}% of the time.</p>
      <div className="flight__facts">
        <Fact name="Speed and spin" value={mph(p.velo)} note={`${rpm(p.spin)} · ${path.T.toFixed(2)} s to the plate`} />
        <Fact
          name="Rise vs. gravity-only"
          value={`${path.lift >= 0 ? '+' : '−'}${inches(path.lift)}`}
          note={`Gravity alone would drop it ${inches(path.fall)}. It drops ${inches(path.fall - path.lift)}.`}
        />
        <Fact
          name="Side break"
          value={inches(path.side)}
          note={Math.abs(path.side) < 2 ? 'Almost no side break.' : `Toward ${towardOf(path.side, throws)}.`}
        />
        <Fact
          name="Average landing"
          value={landing ? (inZone ? 'In the zone' : 'Out of the zone') : '—'}
          note={
            landing
              ? `${inches(dx)} ${dx < 0 ? 'left' : 'right'} of center from the catcher's seat, ${inches(dy)} ${dy < 0 ? 'below' : 'above'} the middle. The average zone, and an average path.`
              : 'No location on file for this pitch.'
          }
        />
      </div>
    </div>
  )
}

function Together({ t }) {
  return (
    <div className="flight__info">
      <p className="flight__ask">How far apart do they stay?</p>
      <p className="flight__note">
        All pitches leave from the same spot at once. Gaps are between average paths. A hitter also reads spin and release, so a small gap is not a guarantee.
      </p>
      {t ? (
        <div className="flight__facts">
          <Fact name="Apart at release" value={inches(t.release)} />
          <Fact name="Apart 23.8 ft out" value={inches(t.out)} note="About 175 ms before the plate." />
          <Fact name="Apart at the plate" value={inches(t.plate)} />
          <Fact name="Closest pair, 23.8 ft out" value={t.closest.names} note={`${inches(t.closest.out)} there, ${inches(t.closest.plate)} at the plate`} />
          <Fact name="Widest pair, 23.8 ft out" value={t.widest.names} note={`${inches(t.widest.out)} there, ${inches(t.widest.plate)} at the plate`} />
        </div>
      ) : (
        <p className="flight__note">Select at least two pitches to compare.</p>
      )}
    </div>
  )
}
